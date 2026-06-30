using System;
using System.Collections.Generic;
using System.Threading;
using MetaQuotes.MT5CommonAPI;
using MetaQuotes.MT5ManagerAPI;

namespace StockVala.Gateway
{
    /// <summary>
    /// Polls every symbol configured on the MT5 server once per second.
    /// Symbol list is built dynamically from MT5 at startup (and refreshed
    /// every 5 minutes) — no hardcoded symbol names anywhere.
    ///
    /// Smart polling: symbols that consistently return bid=0 are marked "dead"
    /// and only retried once per minute instead of every second.  This keeps
    /// the MT5 manager lock free for HTTP handlers (account creation etc.)
    /// while still detecting when a dead symbol comes alive.
    ///
    /// For each symbol, TickLast() is called via the Manager API.
    /// If a valid bid is returned, the tick is injected into TickAggregator
    /// (for /chart) and published to Redis (for real-time browser streaming).
    /// </summary>
    class SymbolPoller
    {
        private readonly CIMTManagerAPI _manager;
        private readonly TickAggregator _agg;
        private readonly RedisClient    _redis;
        private readonly SemaphoreSlim  _mgrLock;
        private volatile bool           _running;
        private Thread                  _thread;

        // Symbols that have returned bid=0 for at least one full cycle.
        // Stored as symbol → countdown (seconds until next retry).
        // Using a plain Dictionary accessed only from the poll thread — no concurrency needed.
        private readonly Dictionary<string, int> _deadCountdown = new Dictionary<string, int>();
        private const int DEAD_RETRY_INTERVAL = 60; // retry dead symbols every 60 s

        public SymbolPoller(CIMTManagerAPI manager, TickAggregator agg, RedisClient redis, SemaphoreSlim mgrLock)
        {
            _manager = manager;
            _agg     = agg;
            _redis   = redis;
            _mgrLock = mgrLock;
        }

        public void Start()
        {
            _running = true;
            _thread  = new Thread(PollLoop) { IsBackground = true, Name = "SymbolPoller" };
            _thread.Start();
        }

        public void Stop()
        {
            _running = false;
        }

        // ─── Main poll loop ───────────────────────────────────────────────────

        private void PollLoop()
        {
            Console.WriteLine("[Poller] Started — enumerating all MT5 symbols...");
            IList<string> symbols = LoadAllSymbols();
            Console.WriteLine("[Poller] Loaded " + symbols.Count + " symbols from MT5");

            int refreshTimer = 0;
            while (_running)
            {
                try { PollAll(symbols); }
                catch (Exception ex)
                { Console.WriteLine("[Poller] Poll error: " + ex.Message); }

                Thread.Sleep(1000);

                refreshTimer++;
                if (refreshTimer >= 300) // refresh symbol list every 5 minutes
                {
                    refreshTimer = 0;
                    try
                    {
                        var updated = LoadAllSymbols();
                        if (updated.Count > 0) symbols = updated;
                        Console.WriteLine("[Poller] Symbol list refreshed: " + symbols.Count + " symbols");
                        // Clear dead-symbol cache so the full list is re-checked once
                        _deadCountdown.Clear();
                    }
                    catch (Exception ex)
                    { Console.WriteLine("[Poller] Refresh error: " + ex.Message); }
                }
            }
            Console.WriteLine("[Poller] Stopped.");
        }

        // ─── Enumerate all symbols from MT5 Manager ───────────────────────────

        private IList<string> LoadAllSymbols()
        {
            var list = new List<string>();
            try
            {
                _mgrLock.Wait();
                try
                {
                    uint total = _manager.SymbolTotal();
                    Console.WriteLine("[Poller] MT5 reports " + total + " symbols total");

                    for (uint i = 0; i < total; i++)
                    {
                        var sym = _manager.SymbolCreate();
                        if (sym == null) continue;
                        try
                        {
                            // SymbolNext is the correct index-based enumeration method
                            // (SymbolGet only has a string-name overload in Manager API)
                            MTRetCode ret = _manager.SymbolNext(i, sym);
                            if (ret == MTRetCode.MT_RET_OK)
                            {
                                string name = sym.Symbol();
                                if (!string.IsNullOrEmpty(name))
                                    list.Add(name);
                            }
                        }
                        finally { sym.Dispose(); }
                    }
                }
                finally { _mgrLock.Release(); }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Poller] LoadAllSymbols error: " + ex.Message);
            }

            Console.WriteLine("[Poller] Enumerated " + list.Count + " symbols from MT5 manager");
            return list;
        }

        // ─── Per-second poll ──────────────────────────────────────────────────

        private void PollAll(IList<string> symbols)
        {
            int livePolled = 0;
            int deadSkipped = 0;

            foreach (string sym in symbols)
            {
                if (!_running) return;

                // If symbol is in dead-countdown, decrement and skip until it reaches 0
                int countdown;
                if (_deadCountdown.TryGetValue(sym, out countdown))
                {
                    if (countdown > 1)
                    {
                        _deadCountdown[sym] = countdown - 1;
                        deadSkipped++;
                        continue;
                    }
                    // countdown == 1 or 0: time to retry — remove from dead set and poll
                    _deadCountdown.Remove(sym);
                }

                bool gotData = PollSymbol(sym);
                livePolled++;

                if (!gotData)
                {
                    // No price data — mark as dead, retry in DEAD_RETRY_INTERVAL seconds
                    _deadCountdown[sym] = DEAD_RETRY_INTERVAL;
                }
            }

            // Log summary every ~60 polls (once per minute) so we can track progress
            // Use a simple check: when deadSkipped is large and livePolled is small, log it.
            if (deadSkipped > 0 && livePolled <= 50)
            {
                Console.WriteLine("[Poller] Cycle: polled=" + livePolled + " skipped(dead)=" + deadSkipped);
            }
        }

        private bool PollSymbol(string symbol)
        {
            try
            {
                MTTickShort t;
                MTRetCode ret;
                _mgrLock.Wait();
                try
                {
                    ret = _manager.TickLast(symbol, out t);
                    // TickLast returns 0 for broker-markup symbols (GBPUSD.#) because
                    // MT5 stores prices under the raw feeder name. TickLastRaw reads the
                    // pre-markup price which is stored for all actively fed symbols.
                    if (ret != MTRetCode.MT_RET_OK || t.bid <= 0)
                        ret = _manager.TickLastRaw(symbol, out t);
                }
                finally { _mgrLock.Release(); }

                if (ret == MTRetCode.MT_RET_OK && t.bid > 0)
                {
                    _agg.OnTick(symbol, t.bid, t.ask, (ulong)t.datetime);
                    _redis.PublishTick(symbol, t.bid, t.ask, t.datetime);

                    // Also store under base name (strip broker suffix) so /tick/GBPUSD
                    // resolves even when the MT5 symbol is GBPUSD.#
                    if (symbol.Contains("."))
                    {
                        string baseName = symbol.Substring(0, symbol.LastIndexOf("."));
                        _agg.OnTick(baseName, t.bid, t.ask, (ulong)t.datetime);
                        _redis.PublishTick(baseName, t.bid, t.ask, t.datetime);
                    }
                    return true;  // live data
                }
                return false;  // no data — caller will mark as dead
            }
            catch { return false; /* skip this symbol */ }
        }
    }
}
