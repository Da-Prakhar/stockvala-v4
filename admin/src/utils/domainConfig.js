// Auto-derives all service URLs from the current domain at runtime.
// Same build works for every client — no env vars or rebuild needed.
//
// Convention:  onefx.co.in  →  api.onefx.co.in  /  user.onefx.co.in
// Localhost falls back to VITE_* env vars (for dev).

function rootDomain() {
  const h = window.location.hostname;
  if (h === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
  const parts = h.split('.');
  // Handle second-level TLDs: .co.in, .co.uk, .com.au, .net.in, etc.
  // If second-to-last part is a short country-code SLD, take 3 parts instead of 2.
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
