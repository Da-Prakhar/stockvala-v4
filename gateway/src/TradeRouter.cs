using System;
using System.Globalization;
using System.Threading;
using MetaQuotes.MT5CommonAPI;
using MetaQuotes.MT5ManagerAPI;

namespace StockVala.Gateway
{
    // Auto-dealer: B-Book fill (internal execution) for every incoming request
    class TradeRouter : CIMTRequestSink
    {
        private readonly CIMTManagerAPI  _manager;
        private readonly RedisClient     _redis;
        private readonly ManualResetEventSlim _requestReady = new ManualResetEventSlim(false);
        private Thread   _dealThread;
        private volatile bool _running;

        public TradeRouter(CIMTManagerAPI manager, RedisClient redis)
        {
            _manager = manager;
            _redis   = redis;
        }

        public void Start()
        {
            RegisterSink();
            _manager.RequestSubscribe(this);
            var ret = _manager.DealerStart();
            Console.WriteLine("[TradeRouter] DealerStart: " + ret);

            _running    = true;
            _dealThread = new Thread(DealLoop) { IsBackground = true };
            _dealThread.Start();
        }

        public void Stop()
        {
            _running = false;
            _requestReady.Set();
            if (_dealThread != null) _dealThread.Join(3000);
            _manager.DealerStop();
            _manager.RequestUnsubscribe(this);
        }

        // C#5: explicit method bodies instead of => expression members
        public override void OnRequestAdd(CIMTRequest request)    { _requestReady.Set(); }
        public override void OnRequestUpdate(CIMTRequest request) { _requestReady.Set(); }
        public override void OnRequestSync()                      { _requestReady.Set(); }

        void DealLoop()
        {
            var request = _manager.RequestCreate();
            var confirm = _manager.DealerConfirmCreate();
            if (request == null || confirm == null) return;

            while (_running)
            {
                _requestReady.Wait();
                _requestReady.Reset();
                if (!_running) break;

                while (_manager.DealerGet(request) == MTRetCode.MT_RET_OK)
                {
                    Console.WriteLine("[Trade] #" + request.ID() + " " + request.Symbol() + " vol=" + request.Volume());

                    MTTickShort tick;
                    confirm.Clear();
                    confirm.ID(request.ID());

                    if (_manager.TickLast(request.Symbol(), request.Group(), out tick) == MTRetCode.MT_RET_OK)
                    {
                        // B-Book: fill at current market price
                        double price = (request.Type() == CIMTOrder.EnOrderType.OP_BUY) ? tick.ask : tick.bid;
                        confirm.Price(price);
                        confirm.TickBid(tick.bid);
                        confirm.TickAsk(tick.ask);
                        confirm.Volume(request.Volume());
                        confirm.Retcode(MTRetCode.MT_RET_REQUEST_DONE);
                    }
                    else
                    {
                        confirm.Retcode(MTRetCode.MT_RET_REQUEST_RETURN);
                    }

                    var ret = _manager.DealerAnswer(confirm);
                    if (ret != MTRetCode.MT_RET_OK)
                        Console.WriteLine("[TradeRouter] Answer failed: " + ret);

                    // C#5: string.Format instead of $"" interpolation
                    var eventJson = string.Format(
                        CultureInfo.InvariantCulture,
                        "{{\"id\":{0},\"symbol\":\"{1}\",\"action\":{2},\"volume\":{3}}}",
                        request.ID(), request.Symbol(), (int)request.Type(), request.Volume());

                    _redis.PublishAccountEvent(request.Login(), "order", eventJson);
                }
            }

            request.Dispose();
            confirm.Dispose();
        }
    }
}
