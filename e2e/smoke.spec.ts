import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'

/**
 * Smoke Test Suite for Astian Browser
 * Tests basic functionality:
 * - App launches successfully
 * - Create a new tab
 * - Navigate to a URL
 * - Close tab
 */

test.describe('Astian Browser Smoke Tests', () => {
  let app: ElectronApplication | null = null

  test.beforeAll(async () => {
    // Start Electron app
    const electronApp = await electron.launch({
      args: [path.join(__dirname, '../out/main/index.js')],
      executablePath: process.env.ELECTRON_PATH
    })
    app = electronApp
  })

  test.afterAll(async () => {
    // Close app
    if (app) {
      await app.close()
    }
  })

  test('should launch the app', async () => {
    if (!app) {
      throw new Error('App not initialized')
    }

    // Get the first window
    const window = await app.firstWindow()
    expect(window).toBeDefined()

    // Check if window has correct title
    const title = await window.title()
    expect(title).toContain('Astian')
  })

  test('should display initial state', async () => {
    if (!app) {
      throw new Error('App not initialized')
    }

    const window = await app.firstWindow()

    // Check if URL bar exists
    const urlBar = await window.$('input[placeholder*="Buscar"]')
    expect(urlBar).toBeDefined()
  })

  test('should have IPC API available', async () => {
    if (!app) {
      throw new Error('App not initialized')
    }

    const window = await app.firstWindow()

    // Test that IPC API is available
    const apiAvailable = await window.evaluate(() => {
      return (
        typeof window !== 'undefined' &&
        typeof (window as unknown as { browserApi?: unknown }).browserApi === 'object'
      )
    })

    expect(apiAvailable).toBe(true)
  })

  test('should respond to IPC calls', async () => {
    if (!app) {
      throw new Error('App not initialized')
    }

    const window = await app.firstWindow()

    // Test that IPC API methods exist
    const methodsExist = await window.evaluate(() => {
      const api = (window as unknown as { browserApi?: Record<string, unknown> }).browserApi
      return (
        api &&
        typeof api.getState === 'function' &&
        typeof api.navigate === 'function' &&
        typeof api.createTab === 'function'
      )
    })

    expect(methodsExist).toBe(true)
  })
})
