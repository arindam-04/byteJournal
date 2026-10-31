import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true }, '/uploads': { target: 'http://127.0.0.1:4000', changeOrigin: true }, '/sitemap.xml': { target: 'http://127.0.0.1:4000', changeOrigin: true }, '/feed.xml': { target: 'http://127.0.0.1:4000', changeOrigin: true }, '/robots.txt': { target: 'http://127.0.0.1:4000', changeOrigin: true } }
  }
});
