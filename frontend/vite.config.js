import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'

// Plugin: auto-write .htaccess after every build (Vite clears dist/ each time)
const htaccessPlugin = () => ({
  name: 'htaccess',
  closeBundle() {
    const content = `Options -MultiViews\nRewriteEngine On\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^ index.html [QSA,L]\n`
    writeFileSync('dist/.htaccess', content)
    console.log('✓ .htaccess written to dist/')
  }
})

// Backend target for the Vite dev proxy.
// Set VITE_PROXY_TARGET in your shell to override (e.g. the VPS):
//   VITE_PROXY_TARGET=http://195.250.31.123:5006 npm run dev
const BACKEND = process.env.VITE_PROXY_TARGET || 'http://localhost:5006'

export default defineConfig({
  plugins: [react(), htaccessPlugin()],
  server: {
    port: 3001,
    strictPort: false,
    open: false,
    proxy: {
      // REST API — forwards /api/* to the VPS backend (no CORS needed)
      '/api': {
        target: BACKEND,
        changeOrigin: true,
      },
      // Uploaded files (logos, avatars, documents stored on the VPS)
      '/uploads': {
        target: BACKEND,
        changeOrigin: true,
      },
      // Socket.IO — proxy WS upgrade so ticks/positions work locally
      '/socket.io': {
        target: BACKEND,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    target: 'esnext'
  },
  esbuild: {
    target: 'esnext',
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  }
})
