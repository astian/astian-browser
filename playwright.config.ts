import { defineConfig } from '@playwright/test'

/**
 * Playwright configuration for Astian Browser E2E tests
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  // Electron-specific configuration
  webServer: undefined // Don't start a webserver, we're testing Electron
})
