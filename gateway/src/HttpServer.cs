using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using MetaQuotes.MT5CommonAPI;
using MetaQuotes.MT5ManagerAPI;

namespace StockVala.Gateway
{
    /// <summary>
    /// Embedded HTTP REST server  -  replaces the Python bridge.
    ///
    /// Market data endpoints (always available):
    ///   GET /chart/{SYMBOL}?timeframe=M15&amp;count=200
    ///   GET /tick/{SYMBOL}
    ///   GET /symbols
    ///   GET /health
    ///
    /// Account management endpoints (available after MT5 connects):
    ///   GET  /account/{LOGIN}
    ///   GET  /positions/{LOGIN}
    ///   GET  /deals/{LOGIN}?from=&amp;to=
    ///   GET  /orders/{LOGIN}
    ///   GET  /groups
    ///   POST /users                         { first_name, last_name, email, group, leverage, initial_balance, password? }
    ///   POST /balance/deposit               { login, amount, comment? }
    ///   POST /balance/withdraw              { login, amount, comment? }
    ///   POST /balance/credit                { login, amount, comment? }
    ///   PUT  /users/{LOGIN}/leverage        { leverage }
    ///   PUT  /users/{LOGIN}/password        { password, type? }
    ///   PUT  /users/{LOGIN}/disable
    ///   PUT  /users/{LOGIN}/enable
    /// </summary>
    class HttpServer
    {
        private readonly TickAggregator  _agg;
        private readonly HttpListener    _listener;
        private readonly Thread          _thread;
        private volatile bool            _running;
        private volatile CIMTManagerAPI  _manager; // set once MT5 connects; null during reconnect

        // Shared with GatewayApp: serialises ALL CIMTManagerAPI calls.
        // CIMTManagerAPI is not thread-safe — concurrent calls from different
        // ThreadPool workers corrupt internal state and cause hard crashes.
        private readonly SemaphoreSlim   _mgrLock;

        // Symbols whose chart history has been pulled from MT5 (lazy, once each).
        // Backfill runs on the first /chart request for a symbol after each start.
        private readonly HashSet<string> _chartSeeded = new HashSet<string>();
        private readonly object          _seedLock    = new object();
        private const int CHART_HISTORY_DAYS = 30;

        public HttpServer(TickAggregator agg, SemaphoreSlim mgrLock)
        {
            _agg      = agg;
            _mgrLock  = mgrLock;
            _listener = new HttpListener();
            _listener.Prefixes.Add("http://*:" + Config.HttpPort + "/");
            _thread   = new Thread(Listen) { IsBackground = true, Name = "GatewayHttp" };
        }

        /// <summary>
        /// Called by GatewayApp when MT5 connects (manager != null) or
        /// just before a reconnect attempt (manager == null).
        /// Setting null causes all account handlers to return immediately
        /// with {"error":"MT5 not connected"} while the reconnect runs.
        /// </summary>
        public void SetManager(CIMTManagerAPI manager)
        {
            _manager = manager;
            if (manager != null)
                Console.WriteLine("[HTTP] Manager API set - account endpoints ready");
            else
                Console.WriteLine("[HTTP] Manager API cleared - account endpoints suspended");
        }

        // ─── Lazy chart-history backfill ──────────────────────────────────────
        //
        // The TickAggregator builds bars only from live ticks held in memory, so
        // after a gateway restart every chart starts empty. On the first /chart
        // request for a symbol we pull CHART_HISTORY_DAYS of M1 bars straight
        // from the MT5 server (ChartRequest) and seed all timeframes. MT5 stores
        // quote history only as M1; higher timeframes are derived in the aggregator.
        //
        // Runs once per symbol per process lifetime, cached in _chartSeeded.
        // The ChartRequest call goes through _mgrLock like every other manager
        // call, and may block this HTTP request for a second or two on first load.
        private void EnsureChartHistory(string symbol)
        {
            var manager = _manager;
            if (manager == null || string.IsNullOrEmpty(symbol)) return;

            lock (_seedLock)
            {
                if (_chartSeeded.Contains(symbol)) return;
            }

            long epoch = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
            long to    = epoch;
            long from  = epoch - (long)CHART_HISTORY_DAYS * 24 * 60 * 60;

            MTChartBar[] bars = null;
            MTRetCode    res  = MTRetCode.MT_RET_ERROR;

            _mgrLock.Wait();
            try { bars = manager.ChartRequest(symbol, from, to, out res); }
            catch (Exception ex) { Console.WriteLine("[Chart] ChartRequest error " + symbol + ": " + ex.Message); }
            finally { _mgrLock.Release(); }

            if (res == MTRetCode.MT_RET_OK && bars != null && bars.Length > 0)
            {
                var m1 = new List<Bar>(bars.Length);
                foreach (var cb in bars)
                {
                    long vol = (long)(cb.volume != 0 ? cb.volume : cb.tick_volume);
                    m1.Add(new Bar
                    {
                        Time   = cb.datetime,
                        Open   = cb.open,
                        High   = cb.high,
                        Low    = cb.low,
                        Close  = cb.close,
                        Volume = vol,
                    });
                }
                _agg.SeedFromM1Bars(symbol, m1);
                Console.WriteLine("[Chart] Seeded " + bars.Length + " M1 bars for " + symbol);
            }
            else
            {
                Console.WriteLine("[Chart] No history for " + symbol + " (ret=" + res + ")");
            }

            // Mark seeded only when the server answered cleanly; on a hard error
            // leave it unseeded so the next chart request retries.
            if (res == MTRetCode.MT_RET_OK || res == MTRetCode.MT_RET_OK_NONE)
            {
                lock (_seedLock) { _chartSeeded.Add(symbol); }
            }
        }

        public void Start()
        {
            try
            {
                _running = true;
                _listener.Start();
                _thread.Start();
                Console.WriteLine("[HTTP] Server started on port " + Config.HttpPort);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[HTTP] Failed to start: " + ex.Message);
                Console.WriteLine("[HTTP] Run: netsh http add urlacl url=http://*:" + Config.HttpPort + "/ user=Everyone");
                _running = false;
            }
        }

        public void Stop()
        {
            _running = false;
            try { _listener.Stop(); } catch { }
        }

        // â"€â"€â"€ Listener loop â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private void Listen()
        {
            while (_running)
            {
                HttpListenerContext ctx = null;
                try { ctx = _listener.GetContext(); }
                catch
                {
                    if (!_running) break;
                    Thread.Sleep(100);
                    continue;
                }
                ThreadPool.QueueUserWorkItem(Handle, ctx);
            }
        }

        private void Handle(object state)
        {
            var ctx = (HttpListenerContext)state;
            try
            {
                // CORS preflight
                if (ctx.Request.HttpMethod == "OPTIONS")
                {
                    ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                    ctx.Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
                    ctx.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");
                    ctx.Response.StatusCode = 200;
                    ctx.Response.OutputStream.Close();
                    return;
                }

                string json  = Dispatch(ctx.Request);
                byte[] bytes = Encoding.UTF8.GetBytes(json);
                ctx.Response.ContentType     = "application/json; charset=utf-8";
                ctx.Response.ContentLength64 = bytes.Length;
                ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*");
                ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[HTTP] Handle error: " + ex.Message);
            }
            finally
            {
                try { ctx.Response.OutputStream.Close(); } catch { }
            }
        }

        // â"€â"€â"€ Request dispatcher â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private string Dispatch(HttpListenerRequest req)
        {
            string path   = req.Url.AbsolutePath.TrimEnd('/');
            string method = req.HttpMethod.ToUpperInvariant();

            // â"€â"€ Market data (always available) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

            if (path.StartsWith("/chart/", StringComparison.OrdinalIgnoreCase) && method == "GET")
            {
                string symbol    = ResolveSymbol(path.Substring(7).ToUpperInvariant());
                string timeframe = req.QueryString["timeframe"] ?? "M15";
                int count;
                if (!int.TryParse(req.QueryString["count"], out count) || count < 1) count = 200;
                count = Math.Min(count, 500);
                EnsureChartHistory(symbol);   // lazy one-time backfill from MT5
                return BarsToJson(symbol, _agg.GetBars(symbol, timeframe, count));
            }

            if (path.StartsWith("/tick/", StringComparison.OrdinalIgnoreCase) && method == "GET")
            {
                string symbol = ResolveSymbol(path.Substring(6).ToUpperInvariant());
                TickSnap t = _agg.GetLastTick(symbol);
                if (t != null)
                    return string.Format(CultureInfo.InvariantCulture,
                        "{{\"symbol\":\"{0}\",\"bid\":{1},\"ask\":{2},\"time\":{3}}}",
                        symbol, t.Bid, t.Ask, t.Time);
                return string.Format("{{\"symbol\":\"{0}\",\"bid\":0,\"ask\":0,\"error\":\"no data\"}}", symbol);
            }

            if (path.Equals("/symbols", StringComparison.OrdinalIgnoreCase) && method == "GET")
            {
                var syms = _agg.GetSymbols();
                var sb = new StringBuilder("[");
                for (int i = 0; i < syms.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    sb.Append('"').Append(EscapeJson(syms[i])).Append('"');
                }
                sb.Append(']');
                return string.Format("{{\"symbols\":{0},\"total\":{1}}}", sb.ToString(), syms.Count);
            }

            if (path.Equals("/health", StringComparison.OrdinalIgnoreCase) && method == "GET")
            {
                return string.Format(
                    "{{\"status\":\"ok\",\"service\":\"StockVala-Gateway\",\"symbols\":{0},\"mt5\":{1}}}",
                    _agg.GetSymbols().Count,
                    _manager != null ? "true" : "false");
            }

            // â"€â"€ Account / trade management (requires MT5 connection) â"€â"€â"€â"€â"€â"€
            // ALL calls to CIMTManagerAPI must be serialised through _mgrLock.
            // The API is not thread-safe: concurrent calls from ThreadPool workers
            // cause memory corruption and hard crashes.

            // Read body BEFORE acquiring the lock (IO, not manager access)
            string reqBody = null;
            if (method == "POST" || method == "PUT")
                reqBody = ReadBody(req);

            _mgrLock.Wait();
            try
            {
                if (path.StartsWith("/account/", StringComparison.OrdinalIgnoreCase) && method == "GET")
                    return HandleGetAccount(path.Substring(9));

                if (path.StartsWith("/positions/", StringComparison.OrdinalIgnoreCase) && method == "GET")
                    return HandleGetPositions(path.Substring(11));

                if (path.StartsWith("/deals/", StringComparison.OrdinalIgnoreCase) && method == "GET")
                    return HandleGetDeals(path.Substring(7), req.QueryString["from"], req.QueryString["to"]);

                if (path.StartsWith("/orders/", StringComparison.OrdinalIgnoreCase) && method == "GET")
                    return HandleGetOrders(path.Substring(8));

                if (path.Equals("/groups", StringComparison.OrdinalIgnoreCase) && method == "GET")
                    return HandleGetGroups();

                if (path.Equals("/users", StringComparison.OrdinalIgnoreCase) && method == "POST")
                    return HandleCreateUser(reqBody);

                if (path.Equals("/balance/deposit", StringComparison.OrdinalIgnoreCase) && method == "POST")
                    return HandleBalance(reqBody, "deposit");

                if (path.Equals("/balance/withdraw", StringComparison.OrdinalIgnoreCase) && method == "POST")
                    return HandleBalance(reqBody, "withdraw");

                if (path.Equals("/balance/credit", StringComparison.OrdinalIgnoreCase) && method == "POST")
                    return HandleBalance(reqBody, "credit");

                if (path.Equals("/trade/open", StringComparison.OrdinalIgnoreCase) && method == "POST")
                    return HandleOpenTrade(reqBody);

                if (path.Equals("/trade/close", StringComparison.OrdinalIgnoreCase) && method == "POST")
                    return HandleCloseTrade(reqBody);

                // PUT /users/{LOGIN}/leverage  |  /password  |  /disable  |  /enable
                if (path.StartsWith("/users/", StringComparison.OrdinalIgnoreCase) && method == "PUT")
                {
                    string[] parts = path.Split(new char[]{'/'}, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 3)
                    {
                        string loginStr = parts[1];
                        string action   = parts[2].ToLowerInvariant();
                        if (action == "leverage") return HandleChangeLeverage(loginStr, reqBody);
                        if (action == "password") return HandleChangePassword(loginStr, reqBody);
                        if (action == "disable")  return HandleEnableDisable(loginStr, false);
                        if (action == "enable")   return HandleEnableDisable(loginStr, true);
                    }
                }

                return "{\"error\":\"not found\"}";
            }
            finally { _mgrLock.Release(); }
        }

        // â"€â"€â"€ GET /account/{LOGIN} â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private string HandleGetAccount(string loginStr)
        {
            ulong login;
            if (!ulong.TryParse(loginStr, out login))
                return "{\"error\":\"invalid login\"}";

            var manager = _manager;
            if (manager == null)
                return "{\"error\":\"MT5 not connected\"}";

            var user = manager.UserCreate();
            if (user == null)
                return "{\"error\":\"allocation failed\"}";
            try
            {
                var ret = manager.UserGet(login, user);
                if (ret != MTRetCode.MT_RET_OK)
                    return string.Format("{{\"error\":\"user not found\",\"code\":\"{0}\"}}", ret);

                // Start with stored values from UserGet
                double balance    = user.Balance();
                double credit     = user.Credit();
                double equity     = balance + credit;
                double margin     = 0;
                double marginFree = equity;
                double profit     = 0;

                // Upgrade to live values via UserAccountGet (has live P&L, margin, equity)
                var account = manager.UserCreateAccount();
                if (account != null)
                {
                    try
                    {
                        if (manager.UserAccountGet(login, account) == MTRetCode.MT_RET_OK)
                        {
                            balance    = account.Balance();
                            credit     = account.Credit();
                            equity     = account.Equity();
                            margin     = account.Margin();
                            marginFree = account.MarginFree();
                            profit     = account.Profit();
                        }
                    }
                    finally { account.Dispose(); }
                }

                return string.Format(CultureInfo.InvariantCulture,
                    "{{\"login\":{0},\"name\":\"{1}\",\"group\":\"{2}\"," +
                    "\"balance\":{3},\"credit\":{4},\"equity\":{5}," +
                    "\"margin\":{6},\"margin_free\":{7},\"profit\":{8}," +
                    "\"leverage\":{9},\"currency\":\"USD\"," +
                    "\"server\":\"{10}\",\"server_ip\":\"{11}\"}}",
                    user.Login(), EscapeJson(user.Name()), EscapeJson(user.Group()),
                    balance, credit, equity, margin, marginFree, profit, user.Leverage(),
                    EscapeJson(Config.MT5ServerName), EscapeJson(Config.MT5Server));
            }
            finally { user.Dispose(); }
        }

        // â"€â"€â"€ GET /positions/{LOGIN} â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private string HandleGetPositions(string loginStr)
        {
            ulong login;
            if (!ulong.TryParse(loginStr, out login))
                return "{\"positions\":[],\"total\":0}";

            var manager = _manager;
            if (manager == null)
                return "{\"positions\":[],\"total\":0}";

            var posArr = manager.PositionCreateArray();
            if (posArr == null)
                return "{\"positions\":[],\"total\":0}";
            try
            {
                var ret = manager.PositionGet(login, posArr);
                if (ret != MTRetCode.MT_RET_OK)
                    return "{\"positions\":[],\"total\":0}";

                uint total = posArr.Total();
                var sb = new StringBuilder("{\"positions\":[");
                for (uint i = 0; i < total; i++)
                {
                    var pos = posArr.Next(i);
                    if (pos == null) continue;
                    if (i > 0) sb.Append(',');
                    sb.AppendFormat(CultureInfo.InvariantCulture,
                        "{{\"ticket\":{0},\"login\":{1},\"symbol\":\"{2}\"," +
                        "\"type\":{3},\"volume\":{4},\"price_open\":{5}," +
                        "\"price_current\":{6},\"profit\":{7}," +
                        "\"sl\":{8},\"tp\":{9},\"time_create\":{10}}}",
                        pos.Position(), pos.Login(), EscapeJson(pos.Symbol()),
                        (int)pos.Action(),
                        pos.Volume() / 10000.0,
                        pos.PriceOpen(), pos.PriceCurrent(),
                        pos.Profit(),
                        pos.PriceSL(), pos.PriceTP(),
                        pos.TimeCreate());
                }
                sb.Append("],\"total\":");
                sb.Append(total);
                sb.Append("}");
                return sb.ToString();
            }
            finally { posArr.Dispose(); }
        }

        // â"€â"€â"€ GET /deals/{LOGIN}?from=&to= â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private string HandleGetDeals(string loginStr, string fromStr, string toStr)
        {
            ulong login;
            if (!ulong.TryParse(loginStr, out login))
                return "{\"deals\":[],\"total\":0}";

            var manager = _manager;
            if (manager == null)
                return "{\"deals\":[],\"total\":0}";

            // Default time range: last 90 days
            long nowSec  = (long)(DateTime.UtcNow - new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalSeconds;
            long fromSec = nowSec - 90L * 86400L;
            long toSec   = nowSec;
            if (fromStr != null) long.TryParse(fromStr, out fromSec);
            if (toStr   != null) long.TryParse(toStr,   out toSec);

            var dealArr = manager.DealCreateArray();
            if (dealArr == null)
                return "{\"deals\":[],\"total\":0}";
            try
            {
                // DealRequest(login, from, to, dealArr) confirmed via reflection
                var ret = manager.DealRequest(login, fromSec, toSec, dealArr);
                if (ret != MTRetCode.MT_RET_OK)
                    return "{\"deals\":[],\"total\":0}";

                uint total = dealArr.Total();
                var sb = new StringBuilder("{\"deals\":[");
                for (uint i = 0; i < total; i++)
                {
                    var deal = dealArr.Next(i);
                    if (deal == null) continue;
                    if (i > 0) sb.Append(',');
                    sb.AppendFormat(CultureInfo.InvariantCulture,
                        "{{\"ticket\":{0},\"login\":{1},\"symbol\":\"{2}\"," +
                        "\"action\":{3},\"volume\":{4},\"price\":{5}," +
                        "\"profit\":{6},\"comment\":\"{7}\",\"time\":{8}}}",
                        deal.Deal(), deal.Login(), EscapeJson(deal.Symbol()),
                        deal.Action(),
                        deal.Volume() / 10000.0,
                        deal.Price(), deal.Profit(),
                        EscapeJson(deal.Comment()), deal.Time());
                }
                sb.Append("],\"total\":");
                sb.Append(total);
                sb.Append("}");
                return sb.ToString();
            }
            finally { dealArr.Dispose(); }
        }

        // â"€â"€â"€ GET /orders/{LOGIN} â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private string HandleGetOrders(string loginStr)
        {
            ulong login;
            if (!ulong.TryParse(loginStr, out login))
                return "{\"orders\":[],\"total\":0}";

            var manager = _manager;
            if (manager == null)
                return "{\"orders\":[],\"total\":0}";

            var orderArr = manager.OrderCreateArray();
            if (orderArr == null)
                return "{\"orders\":[],\"total\":0}";
            try
            {
                // OrderGetOpen(login, orderArr) confirmed via reflection
                var ret = manager.OrderGetOpen(login, orderArr);
                if (ret != MTRetCode.MT_RET_OK)
                    return "{\"orders\":[],\"total\":0}";

                uint total = orderArr.Total();
                var sb = new StringBuilder("{\"orders\":[");
                for (uint i = 0; i < total; i++)
                {
                    var ord = orderArr.Next(i);
                    if (ord == null) continue;
                    if (i > 0) sb.Append(',');
                    sb.AppendFormat(CultureInfo.InvariantCulture,
                        "{{\"ticket\":{0},\"login\":{1},\"symbol\":\"{2}\"," +
                        "\"type\":{3},\"volume\":{4},\"price\":{5}," +
                        "\"sl\":{6},\"tp\":{7},\"comment\":\"{8}\",\"time\":{9}}}",
                        ord.Order(), ord.Login(), EscapeJson(ord.Symbol()),
                        (int)ord.Type(),
                        ord.VolumeInitial() / 10000.0,
                        ord.PriceOrder(), ord.PriceSL(), ord.PriceTP(),
                        EscapeJson(ord.Comment()), ord.TimeSetup());
                }
                sb.Append("],\"total\":");
                sb.Append(total);
                sb.Append("}");
                return sb.ToString();
            }
            finally { orderArr.Dispose(); }
        }

        // â"€â"€â"€ GET /groups â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private string HandleGetGroups()
        {
            var manager = _manager;
            if (manager == null)
                return "{\"groups\":[]}";

            var grp = manager.GroupCreate();
            if (grp == null)
                return "{\"groups\":[]}";

            var sb = new StringBuilder("{\"groups\":[");
            try
            {
                uint total = manager.GroupTotal();
                bool first = true;
                for (uint i = 0; i < total; i++)
                {
                    if (manager.GroupNext(i, grp) != MTRetCode.MT_RET_OK) continue;
                    if (!first) sb.Append(',');
                    first = false;
                    sb.AppendFormat("{{\"name\":\"{0}\"}}", EscapeJson(grp.Group()));
                }
            }
            finally { grp.Dispose(); }
            sb.Append("]}");
            return sb.ToString();
        }

        // â"€â"€â"€ POST /users â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private string HandleCreateUser(string body)
        {
            var manager = _manager;
            if (manager == null)
                return "{\"error\":\"MT5 not connected\"}";

            string firstName   = ParseJsonString(body, "first_name") ?? "Client";
            string lastName    = ParseJsonString(body, "last_name")  ?? "";
            string group       = ParseJsonString(body, "group")      ?? Config.DefaultGroup;
            int    leverage    = ParseJsonInt(body,    "leverage");
            double initBalance = ParseJsonDouble(body, "initial_balance");
            string password    = ParseJsonString(body, "password");
            ulong  reqLogin    = ParseJsonUlong(body,  "login");   // optional sequential-login hint
            if (leverage < 1) leverage = 100;
            if (string.IsNullOrEmpty(password)) password = GeneratePassword();
            string investorPassword = GeneratePassword();  // separate read-only password

            var user = manager.UserCreate();
            if (user == null)
                return "{\"error\":\"UserCreate allocation failed\"}";
            try
            {
                user.Name(firstName + " " + lastName);
                user.Group(group);
                user.Leverage((uint)leverage);
                // Enable trading rights: ENABLED(1) | PASSWORD(2) | EXPERT(8) = 11
                user.Rights((CIMTUser.EnUsersRights)11);
                // Suggest a specific login if the caller requested one (MT5 may ignore it)
                if (reqLogin > 0) user.Login(reqLogin);

                // UserAdd(user, tradingPassword, investorPassword)
                var ret = manager.UserAdd(user, password, investorPassword);
                if (ret != MTRetCode.MT_RET_OK)
                    return string.Format("{{\"error\":\"UserAdd failed: {0}\"}}", ret);

                ulong newLogin = user.Login();
                Console.WriteLine("[HTTP] Created MT5 account: login=" + newLogin + " group=" + group + " rights=11");

                // Apply initial balance if requested
                if (initBalance > 0)
                    DoBalanceOp(manager, newLogin, group, initBalance, "Initial deposit");

                return string.Format(CultureInfo.InvariantCulture,
                    "{{\"login\":{0},\"group\":\"{1}\"," +
                    "\"password\":\"{2}\",\"trading_password\":\"{2}\",\"investor_password\":\"{3}\"," +
                    "\"name\":\"{4} {5}\",\"balance\":{6},\"leverage\":{7}," +
                    "\"server\":\"{8}\",\"server_ip\":\"{9}\",\"success\":true}}",
                    newLogin, EscapeJson(group),
                    EscapeJson(password), EscapeJson(investorPassword),
                    EscapeJson(firstName), EscapeJson(lastName), initBalance, leverage,
                    EscapeJson(Config.MT5ServerName), EscapeJson(Config.MT5Server));
            }
            finally { user.Dispose(); }
        }

        // â"€â"€â"€ POST /balance/deposit|withdraw|credit â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private string HandleBalance(string body, string opType)
        {
            var manager = _manager;
            if (manager == null)
                return "{\"error\":\"MT5 not connected\"}";

            ulong  login   = ParseJsonUlong(body,  "login");
            double amount  = ParseJsonDouble(body, "amount");
            string comment = ParseJsonString(body, "comment") ?? opType;

            if (login == 0)   return "{\"error\":\"login required\"}";
            if (amount <= 0)  return "{\"error\":\"amount must be positive\"}";

            // Withdrawal and debit: negate
            if (opType == "withdraw") amount = -amount;

            // Lookup user's group for balance call
            string group = "";
            var user = manager.UserCreate();
            try { if (manager.UserGet(login, user) == MTRetCode.MT_RET_OK) group = user.Group(); }
            finally { user.Dispose(); }

            var ret = DoBalanceOp(manager, login, group, amount, comment);
            if (ret != MTRetCode.MT_RET_OK)
                return string.Format(CultureInfo.InvariantCulture,
                    "{{\"error\":\"balance op failed: {0}\"}}", ret);

            return string.Format(CultureInfo.InvariantCulture,
                "{{\"success\":true,\"login\":{0},\"amount\":{1},\"type\":\"{2}\"}}",
                login, Math.Abs(amount), opType);
        }

        private static MTRetCode DoBalanceOp(CIMTManagerAPI manager, ulong login, string group, double amount, string comment)
        {
            // DealerBalance(login, value, type, comment, ref dealId) confirmed via reflection
            ulong dealId;
            return manager.DealerBalance(
                login,
                amount,
                (uint)CIMTDeal.EnDealAction.DEAL_BALANCE,
                comment,
                out dealId);
        }

        // â"€â"€â"€ PUT /users/{LOGIN}/leverage â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private string HandleChangeLeverage(string loginStr, string body)
        {
            ulong login;
            if (!ulong.TryParse(loginStr, out login)) return "{\"error\":\"invalid login\"}";
            var manager = _manager;
            if (manager == null) return "{\"error\":\"MT5 not connected\"}";

            int leverage = ParseJsonInt(body, "leverage");
            if (leverage < 1) return "{\"error\":\"invalid leverage\"}";

            var user = manager.UserCreate();
            if (user == null) return "{\"error\":\"allocation failed\"}";
            try
            {
                if (manager.UserGet(login, user) != MTRetCode.MT_RET_OK)
                    return "{\"error\":\"user not found\"}";
                user.Leverage((uint)leverage);
                var ret = manager.UserUpdate(user);
                if (ret != MTRetCode.MT_RET_OK)
                    return string.Format("{{\"error\":\"UserUpdate failed: {0}\"}}", ret);
                return string.Format("{{\"success\":true,\"login\":{0},\"leverage\":{1}}}", login, leverage);
            }
            finally { user.Dispose(); }
        }

        // â"€â"€â"€ PUT /users/{LOGIN}/password â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private string HandleChangePassword(string loginStr, string body)
        {
            ulong login;
            if (!ulong.TryParse(loginStr, out login)) return "{\"error\":\"invalid login\"}";
            var manager = _manager;
            if (manager == null) return "{\"error\":\"MT5 not connected\"}";

            string newPass  = ParseJsonString(body, "password");
            string passType = ParseJsonString(body, "type") ?? "main";
            if (string.IsNullOrEmpty(newPass)) return "{\"error\":\"password required\"}";

            bool investor = passType == "investor";
            var ret = manager.UserPasswordChange(
                investor ? CIMTUser.EnUsersPasswords.USER_PASS_INVESTOR
                         : CIMTUser.EnUsersPasswords.USER_PASS_MAIN,
                login, newPass);
            if (ret != MTRetCode.MT_RET_OK)
                return string.Format("{{\"error\":\"PasswordChange failed: {0}\"}}", ret);
            return string.Format("{{\"success\":true,\"login\":{0}}}", login);
        }

        // â"€â"€â"€ PUT /users/{LOGIN}/disable|enable â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private string HandleEnableDisable(string loginStr, bool enable)
        {
            ulong login;
            if (!ulong.TryParse(loginStr, out login)) return "{\"error\":\"invalid login\"}";
            var manager = _manager;
            if (manager == null) return "{\"error\":\"MT5 not connected\"}";

            var user = manager.UserCreate();
            if (user == null) return "{\"error\":\"allocation failed\"}";
            try
            {
                if (manager.UserGet(login, user) != MTRetCode.MT_RET_OK)
                    return "{\"error\":\"user not found\"}";

                if (enable)
                {
                    // Set full trading rights: ENABLED(1) | PASSWORD(2) | EXPERT(8) = 11
                    user.Rights((CIMTUser.EnUsersRights)11);
                }
                else
                {
                    // Disable: clear only the ENABLED bit, preserve others
                    uint rights = (uint)user.Rights();
                    rights = rights & ~1u;
                    user.Rights((CIMTUser.EnUsersRights)rights);
                }

                var ret = manager.UserUpdate(user);
                if (ret != MTRetCode.MT_RET_OK)
                    return string.Format("{{\"error\":\"UserUpdate failed: {0}\"}}", ret);

                // On enable: generate and set a fresh investor password, return it
                string investorPw = null;
                if (enable)
                {
                    investorPw = GeneratePassword();
                    manager.UserPasswordChange(
                        CIMTUser.EnUsersPasswords.USER_PASS_INVESTOR,
                        login, investorPw);
                }

                return investorPw != null
                    ? string.Format(
                        "{{\"success\":true,\"login\":{0},\"enabled\":true,\"investor_password\":\"{1}\"}}",
                        login, EscapeJson(investorPw))
                    : string.Format(
                        "{{\"success\":true,\"login\":{0},\"enabled\":false}}",
                        login);
            }
            finally { user.Dispose(); }
        }

        // â"€â"€â"€ Symbol resolution â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
        // Resolves a generic name (e.g. "BTCUSD") to the actual MT5 symbol
        // that has live tick data (e.g. "BTCUSD.#").
        // Priority: exact match â†’ suffixed with .# â†’ first prefix match

        private string ResolveSymbol(string requested)
        {
            if (string.IsNullOrEmpty(requested)) return requested;

            // 1. Prefer .# suffix FIRST — client accounts trade on .# symbols.
            //    Plain symbols (XAUUSD, EURUSD) are provider feeds only.
            string withHash = requested + ".#";
            if (_agg.GetLastTick(withHash) != null) return withHash;

            // 2. Exact match (only if no .# version exists)
            if (_agg.GetLastTick(requested) != null) return requested;

            // 3. Try with .pro suffix
            string withPro = requested + ".pro";
            if (_agg.GetLastTick(withPro) != null) return withPro;

            // 4. Prefix match  -  e.g. "XAUUSD" matches "XAUUSD.#"
            var syms = _agg.GetSymbols();
            string upper = requested.ToUpperInvariant();
            foreach (string s in syms)
            {
                if (s.ToUpperInvariant().StartsWith(upper)) return s;
            }

            // Nothing found  -  return original so error message is meaningful
            return requested;
        }

        // â"€â"€â"€ POST /trade/open â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
        // Body: { login, symbol, action ("buy"|"sell"), volume, sl?, tp?, comment? }
        // Returns: { deal_id, position_ticket, price, volume, symbol, action }

        private string HandleOpenTrade(string body)
        {
            var manager = _manager;
            if (manager == null)
                return "{\"error\":\"MT5 not connected\"}";

            ulong  login   = ParseJsonUlong(body,  "login");
            string symbol  = ResolveSymbol(ParseJsonString(body, "symbol") ?? "");
            string action  = (ParseJsonString(body, "action") ?? "buy").ToLowerInvariant();
            double volume  = ParseJsonDouble(body, "volume");
            string comment = ParseJsonString(body, "comment") ?? "CRM Trade";

            if (login == 0 || string.IsNullOrEmpty(symbol) || volume <= 0)
                return "{\"error\":\"login, symbol and volume are required\"}";

            bool isBuy = action != "sell";

            // Price from tick aggregator (populated by live tick stream)
            TickSnap tick = _agg.GetLastTick(symbol);
            double price = (tick != null) ? (isBuy ? tick.Ask : tick.Bid) : 0;
            if (price <= 0)
                return string.Format("{{\"error\":\"no tick data for {0}\"}}", EscapeJson(symbol));

            var deal = manager.DealCreate();
            if (deal == null)
                return "{\"error\":\"DealCreate allocation failed\"}";

            // DealPerform can block indefinitely if the MT5 server is slow or
            // the trade queue is backed up.  Running it on a background thread
            // gives us a 5 s safety valve: if it times out we release the
            // manager lock so other HTTP requests are not held up forever.
            // The background thread is still running after timeout; we mark
            // dealOwned=false so the finally block does not double-dispose.
            bool dealOwned = true;
            try
            {
                deal.Login(login);
                deal.Symbol(symbol);
                deal.Action((uint)(isBuy
                    ? CIMTDeal.EnDealAction.DEAL_BUY
                    : CIMTDeal.EnDealAction.DEAL_SELL));
                deal.Volume((ulong)(volume * 10000.0));
                deal.Price(price);
                deal.Comment(comment);

                MTRetCode dealRet = MTRetCode.MT_RET_ERROR;
                ulong     dealId  = 0;
                ulong     posId   = 0;

                var dt = new Thread(() =>
                {
                    try
                    {
                        dealRet = manager.DealPerform(deal);
                        if (dealRet == MTRetCode.MT_RET_OK)
                        {
                            dealId = deal.Deal();
                            posId  = deal.PositionID();
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("[HTTP] DealPerform exception: " + ex.Message);
                    }
                }) { IsBackground = true };
                dt.Start();

                if (!dt.Join(5000))
                {
                    dealOwned = false;
                    Console.WriteLine("[HTTP] DealPerform timed out - login=" + login + " " + action + " " + symbol);
                    return "{\"error\":\"order timed out - please check your positions\"}";
                }

                if (dealRet != MTRetCode.MT_RET_OK)
                    return string.Format("{{\"error\":\"DealPerform failed: {0}\"}}", dealRet);

                Console.WriteLine(string.Format(CultureInfo.InvariantCulture,
                    "[HTTP] Trade open: login={0} {1} {2} {3} @ {4} deal={5} pos={6}",
                    login, action, volume, symbol, price, dealId, posId));

                return string.Format(CultureInfo.InvariantCulture,
                    "{{\"deal_id\":{0},\"position_ticket\":{1},\"price\":{2}," +
                    "\"volume\":{3},\"symbol\":\"{4}\",\"action\":\"{5}\"," +
                    "\"message\":\"{6} {3} {4} at {2}\"}}",
                    dealId, posId > 0 ? posId : dealId, price,
                    volume, EscapeJson(symbol), action,
                    isBuy ? "Bought" : "Sold");
            }
            finally { if (dealOwned) deal.Dispose(); }
        }

        // â"€â"€â"€ POST /trade/close â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
        // Body: { login, ticket, comment?, volume?, symbol? }
        // Returns: { deal_id, ticket, close_price, volume }

        private string HandleCloseTrade(string body)
        {
            var manager = _manager;
            if (manager == null)
                return "{\"error\":\"MT5 not connected\"}";

            ulong  login   = ParseJsonUlong(body,  "login");
            ulong  ticket  = ParseJsonUlong(body,  "ticket");
            double volume  = ParseJsonDouble(body, "volume");
            string symbol  = ResolveSymbol(ParseJsonString(body, "symbol") ?? "");
            string comment = ParseJsonString(body, "comment") ?? "CRM Close";

            if (login == 0 || ticket == 0)
                return "{\"error\":\"login and ticket required\"}";

            // Look up the position to find direction and symbol
            bool   isLong      = true;
            double closeVolume = volume;

            var posArr = manager.PositionCreateArray();
            if (posArr != null)
            {
                try
                {
                    if (manager.PositionGet(login, posArr) == MTRetCode.MT_RET_OK)
                    {
                        uint total = posArr.Total();
                        for (uint i = 0; i < total; i++)
                        {
                            var pos = posArr.Next(i);
                            if (pos == null || pos.Position() != ticket) continue;
                            isLong      = ((uint)pos.Action() == 0); // 0 = BUY
                            if (string.IsNullOrEmpty(symbol)) symbol = pos.Symbol();
                            if (closeVolume <= 0) closeVolume = pos.Volume() / 10000.0;
                            break;
                        }
                    }
                }
                finally { posArr.Dispose(); }
            }

            if (string.IsNullOrEmpty(symbol))
                return "{\"error\":\"position not found  -  provide symbol\"}";
            if (closeVolume <= 0)
                return "{\"error\":\"volume required\"}";

            // Closing price: sell long at bid, buy back short at ask
            TickSnap tick = _agg.GetLastTick(symbol);
            double closePrice = (tick != null) ? (isLong ? tick.Bid : tick.Ask) : 0;

            var deal = manager.DealCreate();
            if (deal == null)
                return "{\"error\":\"DealCreate allocation failed\"}";

            bool dealOwned = true;
            try
            {
                deal.Login(login);
                deal.Symbol(symbol);
                deal.PositionID(ticket);
                // Opposite of position direction to close
                deal.Action((uint)(isLong
                    ? CIMTDeal.EnDealAction.DEAL_SELL
                    : CIMTDeal.EnDealAction.DEAL_BUY));
                deal.Volume((ulong)(closeVolume * 10000.0));
                if (closePrice > 0) deal.Price(closePrice);
                deal.Comment(comment);

                MTRetCode dealRet = MTRetCode.MT_RET_ERROR;
                ulong     dealId  = 0;

                var dt = new Thread(() =>
                {
                    try
                    {
                        dealRet = manager.DealPerform(deal);
                        if (dealRet == MTRetCode.MT_RET_OK)
                            dealId = deal.Deal();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("[HTTP] DealPerform(close) exception: " + ex.Message);
                    }
                }) { IsBackground = true };
                dt.Start();

                if (!dt.Join(5000))
                {
                    dealOwned = false;
                    Console.WriteLine("[HTTP] DealPerform(close) timed out - login=" + login + " ticket=" + ticket);
                    return "{\"error\":\"close timed out - please check your positions\"}";
                }

                if (dealRet != MTRetCode.MT_RET_OK)
                    return string.Format("{{\"error\":\"DealPerform close failed: {0}\"}}", dealRet);

                Console.WriteLine(string.Format(CultureInfo.InvariantCulture,
                    "[HTTP] Trade close: login={0} ticket={1} deal={2} price={3}",
                    login, ticket, dealId, closePrice));

                return string.Format(CultureInfo.InvariantCulture,
                    "{{\"deal_id\":{0},\"ticket\":{1},\"close_price\":{2}," +
                    "\"volume\":{3},\"message\":\"Position {1} closed\"}}",
                    dealId, ticket, closePrice, closeVolume);
            }
            finally { if (dealOwned) deal.Dispose(); }
        }

        // â"€â"€â"€ JSON helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private static string BarsToJson(string symbol, IList<Bar> bars)
        {
            var sb = new StringBuilder(bars.Count * 80 + 64);
            sb.Append("{\"symbol\":\"").Append(symbol).Append("\",\"candles\":[");
            for (int i = 0; i < bars.Count; i++)
            {
                if (i > 0) sb.Append(',');
                Bar b = bars[i];
                sb.AppendFormat(CultureInfo.InvariantCulture,
                    "{{\"time\":{0},\"open\":{1},\"high\":{2},\"low\":{3},\"close\":{4},\"volume\":{5}}}",
                    b.Time, b.Open, b.High, b.Low, b.Close, b.Volume);
            }
            sb.Append("],\"count\":").Append(bars.Count).Append('}');
            return sb.ToString();
        }

        // â"€â"€â"€ Request body reader â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

        private static string ReadBody(HttpListenerRequest req)
        {
            try
            {
                using (var reader = new StreamReader(req.InputStream, req.ContentEncoding ?? Encoding.UTF8))
                    return reader.ReadToEnd();
            }
            catch { return "{}"; }
        }

        // â"€â"€â"€ Simple JSON value extractors (no external library needed) â"€â"€â"€â"€

        private static string ParseJsonString(string json, string key)
        {
            if (json == null) return null;
            var m = Regex.Match(json,
                "\"" + Regex.Escape(key) + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");
            if (!m.Success) return null;
            return m.Groups[1].Value
                .Replace("\\\"", "\"").Replace("\\\\", "\\")
                .Replace("\\/", "/").Replace("\\n", "").Replace("\\r", "");
        }

        private static double ParseJsonDouble(string json, string key)
        {
            if (json == null) return 0;
            var m = Regex.Match(json,
                "\"" + Regex.Escape(key) + "\"\\s*:\\s*(-?[0-9]+\\.?[0-9]*)");
            double v;
            return (m.Success && double.TryParse(m.Groups[1].Value,
                NumberStyles.Any, CultureInfo.InvariantCulture, out v)) ? v : 0;
        }

        private static ulong ParseJsonUlong(string json, string key)
        {
            if (json == null) return 0;
            var m = Regex.Match(json,
                "\"" + Regex.Escape(key) + "\"\\s*:\\s*([0-9]+)");
            ulong v;
            return (m.Success && ulong.TryParse(m.Groups[1].Value, out v)) ? v : 0;
        }

        private static int ParseJsonInt(string json, string key)
        {
            if (json == null) return 0;
            var m = Regex.Match(json,
                "\"" + Regex.Escape(key) + "\"\\s*:\\s*(-?[0-9]+)");
            int v;
            return (m.Success && int.TryParse(m.Groups[1].Value, out v)) ? v : 0;
        }

        private static string EscapeJson(string s)
        {
            if (s == null) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"")
                    .Replace("\r", "").Replace("\n", "");
        }

        private static readonly Random _rng = new Random();
        private static string GeneratePassword()
        {
            // 10-char password: upper + lower + digits + special (satisfies MT5 complexity rules)
            const string upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
            const string lower   = "abcdefghjkmnpqrstuvwxyz";
            const string digits  = "23456789";
            const string special = "!@#$";
            const string all     = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
            char[] pw = new char[10];
            pw[0] = upper[_rng.Next(upper.Length)];
            pw[1] = lower[_rng.Next(lower.Length)];
            pw[2] = digits[_rng.Next(digits.Length)];
            pw[3] = special[_rng.Next(special.Length)];
            for (int i = 4; i < 10; i++) pw[i] = all[_rng.Next(all.Length)];
            // Shuffle so required chars aren't always at positions 0-3
            for (int i = pw.Length - 1; i > 0; i--)
            {
                int j = _rng.Next(i + 1);
                char tmp = pw[i]; pw[i] = pw[j]; pw[j] = tmp;
            }
            return new string(pw);
        }
    }
}
