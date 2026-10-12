// E2E alur kritis (TECH-SPEC §13). Mode demo (tanpa .env) → tidak butuh server Supabase/AI.
// Jalankan: npm run e2e   (memulai dev server sendiri di port 5199)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'hp', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, testIgnore: /desktop/ },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } }, testMatch: /desktop/ },
  ],
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
