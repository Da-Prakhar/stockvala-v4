// CJS Bridge for cPanel/Passenger (which uses require() internally)
// This file must be set as the "Application startup file" in cPanel Node.js App settings.
// Filename: app.cjs (CommonJS extension forces require() compatibility)

console.log('[CJS Bridge] Initializing ES Module handoff...');
console.log('[CJS Bridge] Node Version:', process.version);
console.log('[CJS Bridge] Working Dir:', process.cwd());

import('./index.js').then(() => {
  console.log('[CJS Bridge] Application loaded successfully.');
}).catch(err => {
  console.error('[CJS Bridge] FATAL - Failed to load application:', err);
  process.exit(1);
});
