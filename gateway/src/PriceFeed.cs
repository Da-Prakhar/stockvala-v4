using System;
using System.Collections.Concurrent;
using MetaQuotes.MT5CommonAPI;
using MetaQuotes.MT5ManagerAPI;

namespace StockVala.Gateway
{
    class PriceFeed : CIMTTickSink
    {
        private readonly RedisClient    _redis;
        private readonly TickAggregator _agg;

        // Track new symbols on first tick — log them so we know what the server pushes
        private readonly ConcurrentDictionary<string, byte> _logged =
            new ConcurrentDictionary<string, byte>();

        public PriceFeed(RedisClient redis, TickAggregator agg)
        {
            _redis = redis;
            _agg   = agg;
        }

        // Fires on every market tick received from MT5 (push stream)
        public override void OnTick(string symbol, MTTickShort tick)
        {
            // Log the first tick for each new symbol so we can see what comes through
            if (_logged.TryAdd(symbol, 0))
                Console.WriteLine("[Feed] New push symbol: " + symbol
                    + "  bid=" + tick.bid + "  ask=" + tick.ask);

            // Publish to Redis → Node.js → browser
            _redis.PublishTick(symbol, tick.bid, tick.ask, tick.datetime);

            // Also feed the in-memory OHLCV aggregator for /chart endpoint
            _agg.OnTick(symbol, tick.bid, tick.ask, (ulong)tick.datetime);
        }
    }
}
