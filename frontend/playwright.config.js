// @ts-check
import { defineConfig } from '@playwright/test';

// Support testing against production or local
const isProduction = process.env.TEST_URL?.includes('decideplease.com') ||
                     process.env.TEST_PRODUCTION === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    headless: true,
    viewport: { width: 1280, height: 720 },
    // Slower actions for production testing
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  // Only start local dev server if not testing production
  ...(isProduction ? {} : {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  }),
});
