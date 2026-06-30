using System;
using System.Collections.Generic;
using System.Collections.Concurrent;

namespace StockVala.Gateway
{
    /// <summary>
    /// Builds OHLCV candlestick bars from live MT5 ticks.
    /// Stores the last 500 bars per symbol per timeframe.
    /// Thread-safe — called from PriceFeed (MT5 tick thread) and
    /// read from HttpServer (thread-pool threads) concurrently.
    /// </summary>
    class TickAggregator
    {
        private static readonly int[]    TF_MINS  = { 1, 5, 15, 30, 60, 240, 1440 };
        private static readonly string[] TF_NAMES = { "M1", "M5", "M15", "M30", "H1", "H4", "D1" };
        private const int MAX_BARS = 500;

        // "SYMBOL:tfMin" → BarBuffer
        private readonly ConcurrentDictionary<string, BarBuffer> _bufs =
            new ConcurrentDictionary<string, BarBuffer>();

        // Latest tick per symbol
        private readonly ConcurrentDictionary<string, TickSnap> _ticks =
            new ConcurrentDictionary<string, TickSnap>();

        // Set of known symbols
        private readonly ConcurrentDictionary<string, byte> _symbols =
            new ConcurrentDictionary<string, byte>();

        /// <summary>Called by PriceFeed.OnTick() on every MT5 market tick.</summary>
        public void OnTick(string symbol, double bid, double ask, ulong tsSeconds)
        {
            _ticks[symbol] = new TickSnap { Bid = bid, Ask = ask, Time = tsSeconds };
            _symbols.TryAdd(symbol, 0);

            double mid = (bid + ask) / 2.0;
            long   ts  = (long)tsSeconds;

            for (int i = 0; i < TF_MINS.Length; i++)
            {
                long   tfSecs = (long)TF_MINS[i] * 60L;
                long   bsTime = (ts / tfSecs) * tfSecs;
                string key    = symbol + ":" + TF_MINS[i];

                var buf = _bufs.GetOrAdd(key, _ => new BarBuffer(MAX_BARS));
                buf.AddTick(bsTime, mid);
            }
        }

        /// <summary>
        /// Backfill all timeframes for a symbol from historical M1 bars
        /// (as returned by MT5 ChartRequest). The MT5 server stores quote
        /// history only as M1; every higher timeframe is derived from it here.
        /// Merges with any live bars already built since the gateway started —
        /// live bars win on overlapping timestamps (they reflect realtime ticks).
        /// </summary>
        public void SeedFromM1Bars(string symbol, IList<Bar> m1Bars)
        {
            if (m1Bars == null || m1Bars.Count == 0) return;
            _symbols.TryAdd(symbol, 0);

            for (int i = 0; i < TF_MINS.Length; i++)
            {
                long tfSecs  = (long)TF_MINS[i] * 60L;
                var  buckets = new SortedDictionary<long, Bar>();

                foreach (var m1 in m1Bars)
                {
                    long bs = (m1.Time / tfSecs) * tfSecs;
                    Bar  b;
                    if (buckets.TryGetValue(bs, out b))
                    {
                        if (m1.High > b.High) b.High = m1.High;
                        if (m1.Low  < b.Low)  b.Low  = m1.Low;
                        b.Close   = m1.Close;
                        b.Volume += m1.Volume;
                        buckets[bs] = b;
                    }
                    else
                    {
                        buckets[bs] = new Bar
                        {
                            Time   = bs,
                            Open   = m1.Open,
                            High   = m1.High,
                            Low    = m1.Low,
                            Close  = m1.Close,
                            Volume = m1.Volume,
                        };
                    }
                }

                string key = symbol + ":" + TF_MINS[i];
                var buf = _bufs.GetOrAdd(key, _ => new BarBuffer(MAX_BARS));
                buf.SeedBars(buckets);
            }
        }

        public TickSnap GetLastTick(string symbol)
        {
            TickSnap t;
            return _ticks.TryGetValue(symbol, out t) ? t : null;
        }

        public IList<string> GetSymbols()
        {
            return new List<string>(_symbols.Keys);
        }

        public IList<Bar> GetBars(string symbol, string timeframe, int count)
        {
            int    tfMin = TfToMinutes(timeframe);
            string key   = symbol + ":" + tfMin;

            BarBuffer buf;
            if (!_bufs.TryGetValue(key, out buf))
                return new List<Bar>();

            return buf.GetLast(count);
        }

        private static int TfToMinutes(string tf)
        {
            switch ((tf ?? "M15").ToUpperInvariant())
            {
                case "M1":  return 1;
                case "M5":  return 5;
                case "M15": return 15;
                case "M30": return 30;
                case "H1":  return 60;
                case "H4":  return 240;
                case "D1":  return 1440;
                default:    return 15;
            }
        }
    }

    // ─── Ring buffer of OHLCV bars ───────────────────────────────────────────

    class BarBuffer
    {
        private readonly Bar[] _ring;
        private readonly int   _cap;
        private int _head;   // index of oldest bar
        private int _count;  // number of valid bars

        public BarBuffer(int capacity)
        {
            _cap  = capacity;
            _ring = new Bar[capacity];
        }

        public void AddTick(long barStart, double mid)
        {
            lock (this)
            {
                int tail = (_head + _count - 1 + _cap) % _cap;

                if (_count > 0 && _ring[tail].Time == barStart)
                {
                    // Update running bar
                    var b = _ring[tail];
                    if (mid > b.High) b.High = mid;
                    if (mid < b.Low)  b.Low  = mid;
                    b.Close  = mid;
                    b.Volume++;
                    _ring[tail] = b;
                }
                else
                {
                    // Open new bar
                    if (_count < _cap) _count++;
                    else               _head = (_head + 1) % _cap; // evict oldest

                    int newTail = (_head + _count - 1 + _cap) % _cap;
                    _ring[newTail] = new Bar
                    {
                        Time   = barStart,
                        Open   = mid,
                        High   = mid,
                        Low    = mid,
                        Close  = mid,
                        Volume = 1,
                    };
                }
            }
        }

        public IList<Bar> GetLast(int count)
        {
            lock (this)
            {
                int n = Math.Min(count, _count);
                var result = new List<Bar>(n);
                for (int i = _count - n; i < _count; i++)
                    result.Add(_ring[(_head + i) % _cap]);
                return result;
            }
        }

        /// <summary>
        /// Merge historical bars (keyed by bar-start time) with the live bars
        /// already in the ring, then keep the most recent capacity bars.
        /// Live bars override historical on matching timestamps.
        /// </summary>
        public void SeedBars(SortedDictionary<long, Bar> historical)
        {
            if (historical == null || historical.Count == 0) return;

            lock (this)
            {
                var merged = new SortedDictionary<long, Bar>(historical);

                // Overlay existing live bars — realtime data wins on overlap
                for (int i = 0; i < _count; i++)
                {
                    var live = _ring[(_head + i) % _cap];
                    merged[live.Time] = live;
                }

                var all = new Bar[merged.Count];
                merged.Values.CopyTo(all, 0);

                int n     = Math.Min(_cap, all.Length);
                int start = all.Length - n;

                _head  = 0;
                _count = n;
                for (int i = 0; i < n; i++)
                    _ring[i] = all[start + i];
            }
        }
    }

    // ─── Value types ─────────────────────────────────────────────────────────

    struct Bar
    {
        public long   Time;
        public double Open;
        public double High;
        public double Low;
        public double Close;
        public long   Volume;
    }

    class TickSnap
    {
        public double Bid;
        public double Ask;
        public ulong  Time;
    }
}
