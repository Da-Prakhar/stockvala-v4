import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'fs';

const htaccessPlugin = () => ({
  name: 'htaccess',
  closeBundle() {
    const content = [
      'Options -MultiViews',
      'RewriteEngine On',
      'RewriteBase /',
      'RewriteCond %{REQUEST_FILENAME} !-f',
      'RewriteCond %{REQUEST_FILENAME} !-d',
      'RewriteRule ^ index.html [QSA,L]',
      '',
    ].join('\n');
    writeFileSync('dist/.htaccess', content);
    console.log('✓ .htaccess written to dist/');
  },
});

export default defineConfig({
  plugins: [react(), htaccessPlugin()],
  server: {
    port: 3000,
    host: true,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    target: 'esnext',
  },
  esbuild: {
    target: 'esnext',
  },
});
