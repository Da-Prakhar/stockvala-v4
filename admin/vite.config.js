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

export default defineConfig({
  plugins: [react(), htaccessPlugin()],
  server: {
    port: 3002,
    strictPort: false,
    cors: true,
    historyApiFallback: true,
    proxy: {
      '/api': { target: 'http://localhost:5006', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5006', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5006', changeOrigin: true, ws: true },
    },
  },
  preview: {
    port: 3003,
    strictPort: false,
    historyApiFallback: true,   // SPA routing for `vite preview` (built dist)
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
