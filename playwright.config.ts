import { defineConfig } from '@playwright/test'

/** Phone check: every screen at 360x740 (a small Android phone), using the Chrome already on the machine. */
const LIVE = process.env.ASTRA_URL // set to test a deployed copy, e.g. the Pages URL; unset = local preview

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  reporter: 'list',
  use: {
    baseURL: LIVE ?? 'http://127.0.0.1:4173/',
    channel: 'chrome',
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    // Steady screenshots, and a check that the game still works with every animation off.
    reducedMotion: 'reduce',
  },
  webServer: LIVE ? undefined : {
    command: 'npm run build && npx vite preview --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
