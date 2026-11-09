import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', viewport: { width: 1440, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: { command: 'node scripts/build.mjs && node scripts/serve.mjs 4173', url: 'http://localhost:4173/GanttCrew.html', reuseExistingServer: !process.env.CI },
});
