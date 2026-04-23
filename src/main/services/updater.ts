import { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

export interface UpdaterConfig {
  owner: string
  repo: string
  publisherName?: string
}

export class UpdaterService {
  private mainWindow: BrowserWindow | null = null
  private updateCheckInterval: NodeJS.Timeout | null = null
  private checkIntervalMs = 4 * 60 * 60 * 1000 // 4 hours

  constructor(config: UpdaterConfig) {
    // Configure GitHub repository for updates
    if (process.env.DEV_UPDATE_CONFIG_PATH) {
      autoUpdater.updateConfigPath = process.env.DEV_UPDATE_CONFIG_PATH
    }

    autoUpdater.setFeedURL({
      provider: 'github',
      owner: config.owner,
      repo: config.repo
    })

    autoUpdater.allowDowngrade = false
    autoUpdater.allowPrerelease = false

    this.setupListeners()
  }

  private setupListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('[Updater] Checking for updates...')
      this.sendToRenderer('updater:checking-for-update')
    })

    autoUpdater.on('update-available', (info) => {
      console.log('[Updater] Update available:', info.version)
      this.sendToRenderer('updater:update-available', {
        version: info.version,
        releaseDate: info.releaseDate
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      console.log('[Updater] Update not available. Current:', info.version)
      this.sendToRenderer('updater:update-not-available')
    })

    autoUpdater.on('download-progress', (progressObj) => {
      const { bytesPerSecond, percent, transferred, total } = progressObj
      console.log(
        `[Updater] Download progress: ${percent.toFixed(2)}% (${transferred}/${total} bytes)`
      )
      this.sendToRenderer('updater:download-progress', {
        percent,
        bytesPerSecond,
        transferred,
        total
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[Updater] Update downloaded:', info.version)
      this.sendToRenderer('updater:update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate
      })
    })

    autoUpdater.on('error', (error) => {
      // Silently log GitHub "no releases" errors to avoid console spam
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ERR_XML_MISSED_ELEMENT'
      ) {
        console.debug('[Updater] No published releases on GitHub yet')
        return
      }

      console.error('[Updater] Error:', error)
      this.sendToRenderer('updater:error', {
        message: error instanceof Error ? error.message : String(error)
      })
    })
  }

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  public startPeriodicCheck(): void {
    if (this.updateCheckInterval) {
      return
    }

    // Check immediately on app start (with 5 second delay)
    setTimeout(() => {
      this.checkForUpdates().catch((err) => {
        console.debug('[Updater] Initial check failed:', err)
      })
    }, 5000)

    // Then check every 4 hours
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates().catch((err) => {
        console.debug('[Updater] Periodic check failed:', err)
      })
    }, this.checkIntervalMs)
  }

  public stopPeriodicCheck(): void {
    if (this.updateCheckInterval) {
      clearTimeout(this.updateCheckInterval)
      this.updateCheckInterval = null
    }
  }

  public async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      console.error('[Updater] Check failed:', error)
    }
  }

  public quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true)
  }

  private sendToRenderer(channel: string, data?: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }
}

export let updaterService: UpdaterService | null = null

export function initUpdater(config: UpdaterConfig): UpdaterService {
  if (!is.dev) {
    updaterService = new UpdaterService(config)
  } else {
    console.log('[Updater] Skipped in dev mode')
  }
  return updaterService as UpdaterService
}
