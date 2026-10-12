/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      devOptions: { enabled: false, type: 'module' },
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      manifest: {
        name: 'Hamzi — Plan Tracker Pribadi',
        short_name: 'Hamzi',
        lang: 'id',
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#027A48',
        background_color: '#FAFBFA',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Catat pengeluaran', url: '/keuangan?quick=expense', icons: [{ src: '/icons/sc-expense.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Tambah tugas', url: '/rencana?quick=task', icons: [{ src: '/icons/sc-task.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Mulai belajar', url: '/tumbuh?quick=timer', icons: [{ src: '/icons/sc-timer.png', sizes: '96x96', type: 'image/png' }] },
          { name: 'Chat Hamzi', url: '/chat', icons: [{ src: '/icons/sc-chat.png', sizes: '96x96', type: 'image/png' }] },
        ],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [{ name: 'files', accept: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] }],
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@common': fileURLToPath(new URL('./supabase/functions/_shared/common', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: ['tests/unit/setup.ts'],
  },
});
