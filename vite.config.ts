/**
 * The Lantern Room — Vite configuration.
 *
 * `iwsdkDev()` is Meta IWSDK's dev plugin. On localhost it injects IWER, the
 * Immersive Web Emulation Runtime, so the experience can be tested with
 * mouse + keyboard (or a connected XR device) without a headset.
 *
 * The plugin reads `iwsdk.config.json` for scene/asset/component/XR settings
 * and serves the `virtual:iwsdk-project` module imported by `src/index.ts`.
 *
 * `base: './'` keeps the production build portable across hosts (GitHub Pages
 * project sites are served from /<repo>/, so relative asset URLs are safest).
 */
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [iwsdkDev()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: false,
    // Screenshot tooling writes Chrome profiles/caches inside the project; do
    // not let the dev server reload on its own artifacts.
    watch: {
      ignored: [
        '**/.chrome-profile/**',
        '**/.chrome-crash/**',
        '**/.npm-cache/**',
        '**/.dev-ps-shim/**',
        '**/screenshots/**',
        '**/.iwsdk/**',
      ],
    },
  },
  preview: { host: '0.0.0.0', port: 4173 },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
    rollupOptions: { input: './index.html' },
  },
  esbuild: { target: 'esnext' },
  // The SDK ships its own Three.js graph; keep one runtime so instanceof
  // checks and component identity stay consistent inside IWSDK.
  resolve: {
    dedupe: ['three', '@pmndrs/uikit', '@pmndrs/uikit-horizon', '@pmndrs/uikit-lucide'],
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    include: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
      '@drawcall/uikitml',
    ],
    esbuildOptions: { target: 'esnext' },
  },
  publicDir: 'public',
  base: './',
});
