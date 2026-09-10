import { defineConfig } from 'vite';

export default defineConfig({
  base: '/counter-strike/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    hmr: { host: 'localhost' },
    cors: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  preview: { host: '0.0.0.0', port: 5173 },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] }
});
