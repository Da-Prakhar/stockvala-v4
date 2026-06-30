// Auto-derives all service URLs from the current domain at runtime.
// Same build works for every client — no env vars or rebuild needed.
// Convention: neonfx.org → api.neonfx.org / user.neonfx.org

function rootDomain(): string | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hostname;
  if (h === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
  const parts = h.split('.');
  const sld = parts[parts.length - 2];
  const isSLD = parts.length >= 3 && /^(co|com|net|org|gov|edu|ac)$/.test(sld);
  return isSLD ? parts.slice(-3).join('.') : parts.slice(-2).join('.');
}

export function getApiUrl(): string {
  const root = rootDomain();
  return root
    ? `https://api.${root}/api`
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005/api');
}

export function getApiBase(): string {
  return getApiUrl().replace(/\/api\/?$/, '');
}

export function getUserCrmUrl(): string {
  const root = rootDomain();
  return root
    ? `https://user.${root}`
    : (process.env.NEXT_PUBLIC_USER_CRM_URL || 'http://localhost:3001');
}

export function getUploadUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v.startsWith('http')) return v;
  const base = getApiBase();
  const uploadsIdx = v.indexOf('uploads/');
  const rel = uploadsIdx >= 0 ? v.substring(uploadsIdx) : v.replace(/^\//, '');
  return `${base}/${rel}`;
}
