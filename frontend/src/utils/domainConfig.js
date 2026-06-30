/**
 * domainConfig.js — Runtime URL resolver
 *
 * Auto-derives all service URLs from the current hostname.
 * The SAME build works on any domain — no rebuild needed.
 *
 * Convention (production):
 *   app.yourdomain.com  →  api.yourdomain.com  (backend API + WS)
 *   yourdomain.com      →  yourdomain.com      (landing page)
 *
 * Supports second-level TLDs: .co.in, .co.uk, .com.au, etc.
 * Local dev: falls back to VITE_* env vars (see .env.example).
 */

function rootDomain() {
  const h = window.location.hostname;
  if (h === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
  const parts = h.split('.');
  // Handle second-level TLDs: .co.in, .co.uk, .com.au, .net.in, etc.
  const sld = parts[parts.length - 2];
  const isSLD = parts.length >= 3 && /^(co|com|net|org|gov|edu|ac)$/.test(sld);
  return isSLD ? parts.slice(-3).join('.') : parts.slice(-2).join('.');
}

const root = rootDomain();

export const API_URL = root
  ? `https://api.${root}/api`
  : (import.meta.env.VITE_API_URL || 'http://localhost:5006/api');

export const WS_URL = root
  ? `https://api.${root}`
  : (import.meta.env.VITE_WS_URL || 'http://localhost:5006');

export const LANDING_URL = root
  ? `https://${root}`
  : (import.meta.env.VITE_LANDING_PAGE_URL || 'http://localhost:3000');

export const USER_CRM_URL = root
  ? `https://user.${root}`
  : (import.meta.env.VITE_USER_CRM_URL || 'http://localhost:3001');
