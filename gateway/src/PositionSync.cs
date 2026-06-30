using System.Globalization;
using MetaQuotes.MT5CommonAPI;
using MetaQuotes.MT5ManagerAPI;

namespace StockVala.Gateway
{
    class PositionSync : CIMTPositionSink
    {
        private readonly RedisClient _redis;

        public PositionSync(RedisClient redis) { _redis = redis; }

        public override void OnPositionAdd(CIMTPosition pos)
        {
            _redis.PublishAccountEvent(pos.Login(), "position:open", PositionJson(pos, "open"));
            _redis.AddToMasterSet(pos.Login());
        }

        public override void OnPositionUpdate(CIMTPosition pos)
        {
            _redis.PublishAccountEvent(pos.Login(), "position:update", PositionJson(pos, "update"));
        }

        public override void OnPositionDelete(CIMTPosition pos)
        {
            _redis.PublishAccountEvent(pos.Login(), "position:close", PositionJson(pos, "close"));
        }

        private static string PositionJson(CIMTPosition pos, string evt)
        {
            // C#5: string.Format with InvariantCulture instead of $"" interpolation
            return string.Format(
                CultureInfo.InvariantCulture,
                "{{\"event\":\"{0}\",\"ticket\":{1},\"login\":{2}," +
                "\"symbol\":\"{3}\",\"type\":{4}," +
                "\"volume\":{5},\"price\":{6}," +
                "\"sl\":{7},\"tp\":{8}}}",
                evt,
                pos.Position(),
                pos.Login(),
                pos.Symbol(),
                (int)pos.Action(),
                pos.Volume(),
                pos.PriceOpen(),
                pos.PriceSL(),
                pos.PriceTP());
        }
    }
}
