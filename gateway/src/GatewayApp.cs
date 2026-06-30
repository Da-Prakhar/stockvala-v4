using System;
using System.Threading;
using MetaQuotes.MT5CommonAPI;
using MetaQuotes.MT5ManagerAPI;

namespace StockVala.Gateway
{
    class GatewayApp : CIMTManagerSink
    {
        const uint CONNECT_TIMEOUT = 30000;

        private CIMTManagerAPI   _manager;
        private RedisClient      _redis;
        private TickAggregator   _agg;
        private HttpServer       _http;
        private PriceFeed        _priceFeed;
        private TradeRouter      _tradeRouter;
        private PositionSync     _positionSync;
        private SymbolPoller     _poller;

        // ── Lifecycle events ──────────────────────────────────────────
        private ManualResetEvent _stopEvent   = new ManualResetEvent(false);
        // _liveSignal: reset when connected, set when a disconnect is detected
        private ManualResetEvent _liveSignal  = new ManualResetEvent(false);
        private Thread           _connectThread;
        private Thread           _keepAliveThread;
        private volatile bool    _running;
        private volatile bool    _isConnected;

        // ── Shared manager lock ───────────────────────────────────────
        // SemaphoreSlim(1,1): serialises ALL CIMTManagerAPI calls.
        // CIMTManagerAPI is NOT thread-safe; concurrent calls corrupt state.
        // Passed to HttpServer so HTTP handlers and keepalive use the same lock.
        internal readonly SemaphoreSlim _mgrLock = new SemaphoreSlim(1, 1);

        // ── Start ─────────────────────────────────────────────────────

        public bool Start()
        {
            _redis = new RedisClient();
            if (!_redis.Connect()) return false;

            _agg  = new TickAggregator();
            _http = new HttpServer(_agg, _mgrLock);   // share the lock
            _http.Start();

            if (SMTManagerAPIFactory.Initialize(null) != MTRetCode.MT_RET_OK)
            {
                Console.WriteLine("[Manager] Factory init failed");
                return false;
            }

            MTRetCode ret;
            _manager = SMTManagerAPIFactory.CreateManager(
                SMTManagerAPIFactory.ManagerAPIVersion, out ret);
            if (_manager == null || ret != MTRetCode.MT_RET_OK)
            {
                Console.WriteLine("[Manager] CreateManager failed: " + ret);
                return false;
            }

            if (RegisterSink() != MTRetCode.MT_RET_OK)
            {
                Console.WriteLine("[Manager] RegisterSink failed");
                return false;
            }

            _priceFeed    = new PriceFeed(_redis, _agg);
            _positionSync = new PositionSync(_redis);
            _tradeRouter  = new TradeRouter(_manager, _redis);

            _running = true;
            _connectThread = new Thread(ConnectLoop)
                { IsBackground = true, Name = "MT5ConnectLoop" };
            _connectThread.Start();
            return true;
        }

        // ── Stop ──────────────────────────────────────────────────────

        public void Stop()
        {
            _running     = false;
            _isConnected = false;
            _liveSignal.Set();   // unblock ConnectLoop WaitOne so it can exit

            if (_http        != null) _http.Stop();
            if (_poller      != null) _poller.Stop();

            // Interrupt keepalive sleep so it exits promptly
            if (_keepAliveThread != null)
            {
                _keepAliveThread.Interrupt();
                _keepAliveThread.Join(2000);
            }

            if (_tradeRouter != null) _tradeRouter.Stop();

            if (_manager != null)
            {
                try { _manager.TickUnsubscribe(_priceFeed);       } catch { }
                try { _manager.PositionUnsubscribe(_positionSync); } catch { }
                try { _manager.Unsubscribe(this);                  } catch { }
                try { _manager.Disconnect();                       } catch { }
                try { _manager.Dispose();                          } catch { }
            }

            if (_redis != null) _redis.Dispose();
            SMTManagerAPIFactory.Shutdown();
            _stopEvent.Set();
        }

        public void Wait() { _stopEvent.WaitOne(); }

        // ── Connect / reconnect loop ──────────────────────────────────
        // Single long-lived thread.
        //
        // Key design:
        //   - After a successful connect, blocks on _liveSignal.WaitOne().
        //   - OnDisconnect (or the keepalive watchdog) calls _liveSignal.Set()
        //     to unblock and loop back to the next connect attempt.
        //   - No "break" — the loop runs for the lifetime of the process.

        void ConnectLoop()
        {
            while (_running)
            {
                // Before each attempt, tell HttpServer not to use the manager.
                // Then drain any in-flight HTTP handler by acquiring + releasing
                // the lock (a handler holds the lock while executing).
                _http.SetManager(null);
                _mgrLock.Wait(); _mgrLock.Release();

                // Ensure the manager is cleanly disconnected before retrying
                try { _manager.Disconnect(); } catch { }

                Console.WriteLine("[Manager] Connecting to " + Config.MT5Server + " ...");

                var ret = _manager.Connect(
                    Config.MT5Server,
                    Config.MT5LoginId,
                    Config.MT5Password,
                    null,
                    CIMTManagerAPI.EnPumpModes.PUMP_MODE_SYMBOLS   |
                    CIMTManagerAPI.EnPumpModes.PUMP_MODE_GROUPS    |
                    CIMTManagerAPI.EnPumpModes.PUMP_MODE_USERS     |
                    CIMTManagerAPI.EnPumpModes.PUMP_MODE_ORDERS    |
                    CIMTManagerAPI.EnPumpModes.PUMP_MODE_POSITIONS |
                    (CIMTManagerAPI.EnPumpModes)0x80,   // PUMP_MODE_QUOTES
                    CONNECT_TIMEOUT);

                if (ret != MTRetCode.MT_RET_OK)
                {
                    Console.WriteLine("[Manager] Connect failed: " + ret + " - retry in 5s");
                    Thread.Sleep(5000);
                    continue;
                }

                Console.WriteLine("[Manager] Connected. Setting up subscriptions...");

                // Subscribe under lock - no HTTP handler can race here
                _mgrLock.Wait();
                try
                {
                    _manager.Subscribe(this);

                    var regRet   = _priceFeed.RegisterSink();
                    var tickRet  = _manager.TickSubscribe(_priceFeed);
                    Console.WriteLine("[PriceFeed] RegisterSink=" + regRet + "  TickSubscribe=" + tickRet);

                    _positionSync.RegisterSink();
                    _manager.PositionSubscribe(_positionSync);
                }
                finally { _mgrLock.Release(); }

                _tradeRouter.Start();

                _poller = new SymbolPoller(_manager, _agg, _redis, _mgrLock);
                _poller.Start();

                // Arm the disconnect signal, enable HTTP access, start keepalive
                _liveSignal.Reset();
                _isConnected = true;
                _http.SetManager(_manager);   // re-enable account endpoints

                _keepAliveThread = new Thread(KeepaliveLoop)
                    { IsBackground = true, Name = "MT5Keepalive" };
                _keepAliveThread.Start();

                Console.WriteLine("[Manager] LIVE - keepalive started");

                // Block until OnDisconnect fires or keepalive detects a drop
                _liveSignal.WaitOne();
                _isConnected = false;

                // Disable HTTP access immediately so no new calls hit the dead manager
                _http.SetManager(null);
                Console.WriteLine("[Manager] Disconnected - cleaning up before reconnect");

                // Stop dependent services
                try { if (_poller != null) { _poller.Stop(); _poller = null; } } catch { }
                try { _tradeRouter.Stop(); } catch { }

                // Unsubscribe under lock
                _mgrLock.Wait();
                try
                {
                    try { _manager.TickUnsubscribe(_priceFeed);       } catch { }
                    try { _manager.PositionUnsubscribe(_positionSync); } catch { }
                    try { _manager.Unsubscribe(this);                  } catch { }
                }
                finally { _mgrLock.Release(); }

                if (!_running) break;

                // Re-register sink for the next connection attempt
                try { RegisterSink(); } catch { }

                Console.WriteLine("[Manager] Reconnecting in 3s...");
                Thread.Sleep(3000);
            }
        }

        // ── Keepalive watchdog ────────────────────────────────────────
        // Wakes every 30 s and calls SymbolTotal() as a lightweight heartbeat.
        // If the call throws (manager died silently) or returns 0, we signal
        // ConnectLoop to reconnect.  Silent TCP drops never fire OnDisconnect,
        // so this is the safety net that catches them.

        void KeepaliveLoop()
        {
            while (_running && _isConnected)
            {
                try { Thread.Sleep(30000); }
                catch (ThreadInterruptedException) { return; }

                if (!_running || !_isConnected) return;

                _mgrLock.Wait();
                try
                {
                    uint syms = _manager.SymbolTotal();
                    Console.WriteLine("[Keepalive] heartbeat ok - symbols=" + syms);
                    if (syms == 0)
                    {
                        Console.WriteLine("[Keepalive] SymbolTotal=0 - possible silent disconnect, reconnecting");
                        _isConnected = false;
                        _liveSignal.Set();
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine("[Keepalive] manager error: " + ex.Message + " - reconnecting");
                    _isConnected = false;
                    _liveSignal.Set();
                }
                finally { _mgrLock.Release(); }
            }
        }

        // ── CIMTManagerSink callbacks ─────────────────────────────────

        public override void OnDisconnect()
        {
            Console.WriteLine("[Manager] OnDisconnect callback - signaling reconnect");
            _isConnected = false;
            _liveSignal.Set();   // wakes _liveSignal.WaitOne() in ConnectLoop
        }
    }
}
