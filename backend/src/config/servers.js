/**
 * servers.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Parses multi-server MT5 gateway config from environment variables.
 *
 * Single-server (backward compat — nothing to change in .env):
 *   MT5_GATEWAY_URL=http://VPS1_IP:8081
 *   MT5_SERVER_NAME=StockVala-Server1        ← optional, auto-read from gateway /health
 *
 * Multi-server (add to .env alongside the single-server vars):
 *   MT5_SERVERS=server1,server2
 *   MT5_SERVER1_GATEWAY=http://VPS1_IP:8081
 *   MT5_SERVER1_NAME=StockVala-Server1
 *   MT5_SERVER2_GATEWAY=http://VPS2_IP:8081
 *   MT5_SERVER2_NAME=StockVala-Server2
 *
 * Returns an array of server descriptors:
 *   [{ id, gatewayUrl, serverName }]
 *
 * The `serverName` must match exactly the value stored in Mt5Account.serverName
 * (set at account-creation time from the gateway's Config.MT5ServerName).
 */

function parseServers() {
  const list = [];

  const ids = (process.env.MT5_SERVERS || '').split(',').map(s => s.trim()).filter(Boolean);

  if (ids.length > 0) {
    // ── Multi-server mode ──────────────────────────────────────────────────
    for (const id of ids) {
      const upper = id.toUpperCase();
      const gatewayUrl  = process.env[`MT5_${upper}_GATEWAY`];
      const serverName  = process.env[`MT5_${upper}_NAME`] || id;
      if (!gatewayUrl) {
        console.warn(`[Servers] MT5_${upper}_GATEWAY not set — skipping server "${id}"`);
        continue;
      }
      list.push({ id, gatewayUrl, serverName });
    }
  }

  // ── Always include the legacy single-server entry (backward compat) ─────
  // Even in multi-server mode, MT5_GATEWAY_URL acts as a default/fallback.
  const legacyUrl  = process.env.MT5_GATEWAY_URL;
  const legacyName = process.env.MT5_SERVER_NAME || 'default';

  if (legacyUrl) {
    // Don't duplicate if already in the list (same URL)
    const alreadyListed = list.some(s => s.gatewayUrl === legacyUrl);
    if (!alreadyListed) {
      list.unshift({ id: 'default', gatewayUrl: legacyUrl, serverName: legacyName });
    }
  }

  if (list.length === 0) {
    console.warn('[Servers] No MT5 gateway configured — set MT5_GATEWAY_URL in .env');
  }

  return list;
}

// Parsed once at startup
export const MT5_SERVERS = parseServers();

// Map serverName → server descriptor for O(1) lookup in controllers
export const SERVER_BY_NAME = Object.fromEntries(
  MT5_SERVERS.map(s => [s.serverName, s])
);

// The default/fallback server (first in list)
export const DEFAULT_SERVER = MT5_SERVERS[0] || null;

console.log('[Servers] Configured MT5 servers:',
  MT5_SERVERS.map(s => `${s.id}(${s.serverName}) @ ${s.gatewayUrl}`).join(' | ')
);
