import sys, os as _os
_here = _os.path.dirname(_os.path.abspath(__file__))
while _here in sys.path:
    sys.path.remove(_here)

import json, time, signal, logging, re

logging.basicConfig(level=logging.INFO, format="%(asctime)s [MCX] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

MT5_LOGIN    = 2232002
MT5_PASSWORD = "Raja@123"
MT5_SERVER   = "176.126.66.38:443"
MT5_PATH     = r"C:\Program Files\MetaTrader 5\terminal64.exe"

REDIS_HOST = "195.250.31.123"
REDIS_PORT = 6379
REDIS_PASS = "StockVala@Redis2024"

INCLUDE_PATH = ["MCX","NSE","BSE","NCDEX","INDIA","COMEX","OIL","METAL"]
INCLUDE_PFX  = [
    "GOLD","SILVER","CRUDE","NATURALGAS","COPPER","ZINC","LEAD",
    "ALUMINIUM","NICKEL","COTTON","NIFTY","BANKNIFTY","FINNIFTY",
    "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","SBIN",
    "BHARTIARTL","ITC","TATAMOTORS","WIPRO","ADANIENT",
]

POLL_INTERVAL   = 1
RE_RESOLVE_SECS = 300

MONTH_RE = re.compile(r"(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{0,2}$", re.IGNORECASE)
BASE_MAP  = {"NIFTY": "NIFTY50"}

def base_name(sym):
    b = MONTH_RE.sub("", sym.upper())
    return BASE_MAP.get(b, b)

def should_include(s):
    p = (s.path or "").upper()
    n = (s.name or "").upper()
    for kw in INCLUDE_PATH:
        if kw in p: return True
    for px in INCLUDE_PFX:
        if n.startswith(px): return True
    return False

def discover(mt5):
    syms = mt5.symbols_get()
    if not syms:
        log.error("symbols_get() returned nothing - check MT5 connection")
        return []
    log.info("Server total symbols: %d", len(syms))
    cats = {}
    for s in syms:
        top = (s.path or "Other").split("\\")[0]
        cats[top] = cats.get(top, 0) + 1
    for cat, cnt in sorted(cats.items(), key=lambda x: -x[1])[:10]:
        log.info("  '%s': %d", cat, cnt)
    chosen = []
    for s in syms:
        if should_include(s):
            if not s.visible:
                mt5.symbol_select(s.name, True)
            chosen.append(s.name)
    log.info("Selected %d symbols", len(chosen))
    return chosen

def main():
    try:
        import MetaTrader5 as mt5
    except ImportError:
        log.error("pip install MetaTrader5"); raise SystemExit(1)
    try:
        import redis as redislib
    except ImportError:
        log.error("pip install redis"); raise SystemExit(1)

    r = redislib.Redis(host=REDIS_HOST, port=REDIS_PORT, password=REDIS_PASS,
                       decode_responses=True, socket_connect_timeout=5)
    try:
        r.ping()
        log.info("Redis OK  %s:%d", REDIS_HOST, REDIS_PORT)
    except Exception as e:
        log.error("Redis failed: %s", e); raise SystemExit(1)

    log.info("Connecting MT5 login=%d server=%s", MT5_LOGIN, MT5_SERVER)
    if not mt5.initialize(path=MT5_PATH, login=MT5_LOGIN, password=MT5_PASSWORD, server=MT5_SERVER):
        log.error("MT5 init failed: %s", mt5.last_error()); raise SystemExit(1)

    acct = mt5.account_info()
    log.info("Connected: %d %s %s", acct.login, acct.name, acct.server)

    poll_list = discover(mt5)
    if not poll_list:
        log.error("No symbols matched"); mt5.shutdown(); raise SystemExit(1)

    running = [True]
    def _stop(sig, frame):
        log.info("Stopping..."); running[0] = False
    signal.signal(signal.SIGINT,  _stop)
    signal.signal(signal.SIGTERM, _stop)

    elapsed = 0
    log.info("Feed running. Ctrl+C to stop.")
    while running[0]:
        published = 0
        for sym in poll_list:
            try:
                tick = mt5.symbol_info_tick(sym)
                if tick and tick.bid > 0:
                    d = json.dumps({"bid": tick.bid, "ask": tick.ask, "t": tick.time})
                    r.set("price:" + sym, d)
                    r.publish("tick:" + sym, d)
                    bn = base_name(sym)
                    if bn != sym:
                        r.set("price:" + bn, d)
                        r.publish("tick:" + bn, d)
                    published += 1
            except Exception as e:
                log.warning("Poll error %s: %s", sym, e)
        if elapsed % 30 == 0:
            log.info("Heartbeat - %d/%d live", published, len(poll_list))
        time.sleep(POLL_INTERVAL)
        elapsed += 1
        if elapsed % RE_RESOLVE_SECS == 0:
            log.info("Re-scanning...")
            nl = discover(mt5)
            if nl: poll_list = nl

    mt5.shutdown()
    log.info("Done.")

if __name__ == "__main__":
    main()
