using System;
using System.Globalization;
using StackExchange.Redis;

namespace StockVala.Gateway
{
    class RedisClient : IDisposable
    {
        private ConnectionMultiplexer _conn;
        private IDatabase            _db;
        private ISubscriber          _pub;

        public bool Connect()
        {
            try
            {
                var opts = ConfigurationOptions.Parse(Config.RedisHost);
                if (!string.IsNullOrEmpty(Config.RedisPassword))
                    opts.Password = Config.RedisPassword;
                opts.AbortOnConnectFail = false;

                _conn = ConnectionMultiplexer.Connect(opts);
                _db   = _conn.GetDatabase();
                _pub  = _conn.GetSubscriber();

                Console.WriteLine("[Redis] Connected to " + Config.RedisHost);
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine("[Redis] Connect failed: " + ex.Message);
                return false;
            }
        }

        // Push price tick — key: price:EURUSD  value: {"bid":1.1,"ask":1.1001,"t":timestamp}
        public void PublishTick(string symbol, double bid, double ask, long time)
        {
            try
            {
                // C#5: string.Format with InvariantCulture (no $"" interpolation; dots not commas)
                var json = string.Format(
                    CultureInfo.InvariantCulture,
                    "{{\"bid\":{0},\"ask\":{1},\"t\":{2}}}",
                    bid, ask, time);

                _db.StringSet("price:" + symbol, json, flags: CommandFlags.FireAndForget);
                _pub.Publish(RedisChannel.Literal("tick:" + symbol), json, CommandFlags.FireAndForget);
            }
            catch { /* non-critical, fire and forget */ }
        }

        public void PublishAccountEvent(ulong account, string eventType, string json)
        {
            try
            {
                // C#5: concatenation instead of $"" interpolation
                _pub.Publish(
                    RedisChannel.Literal("account:" + account + ":" + eventType),
                    json,
                    CommandFlags.FireAndForget);
            }
            catch { }
        }

        public void AddToMasterSet(ulong accountId)
        {
            try { _db.SetAdd("copy:masters:connected", accountId.ToString(), CommandFlags.FireAndForget); }
            catch { }
        }

        public void Dispose()
        {
            // C#5: explicit null check instead of ?. null-conditional
            if (_conn != null) _conn.Dispose();
        }
    }
}
