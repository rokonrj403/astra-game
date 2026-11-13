import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Offline: the whole game (pages, art, fonts, data) is cached on first visit. Today's Sun still asks NASA live and falls back to SAVED.
const pwa = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['icons/*.png'],
  manifest: {
    name: 'ASTRA: Moon base trainer',
    short_name: 'ASTRA',
    description: 'Run a Moon base and keep the crew safe from real solar storms. Uses NASA data. Not made or endorsed by NASA.',
    theme_color: '#0F1B33',
    background_color: '#0F1B33',
    display: 'standalone',
    orientation: 'portrait',
    start_url: './',
    scope: './',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,webp,woff2,png,svg,webmanifest}'],
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
  },
})

export default defineConfig({
  base: './',
  plugins: [react(), ...(process.env.VITEST ? [] : [pwa])],
  test: { environment: 'jsdom', globals: false, include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['./src/test-setup.ts'] },
})
