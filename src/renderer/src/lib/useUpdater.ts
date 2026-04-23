import { useEffect } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc'

interface UpdateAvailableData {
  version: string
  releaseDate: string
}

interface DownloadProgressData {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

interface UpdateDownloadedData {
  version: string
  releaseDate: string
}

interface ErrorData {
  message: string
}

export interface UpdaterState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  version?: string
  progress?: number
  error?: string
}

export interface UpdaterEvents {
  onCheckingForUpdate?: () => void
  onUpdateAvailable?: (version: string, releaseDate: string) => void
  onUpdateNotAvailable?: () => void
  onDownloadProgress?: (percent: number, bytesPerSecond: number) => void
  onUpdateDownloaded?: (version: string) => void
  onError?: (message: string) => void
}

export function useUpdater(events: Partial<UpdaterEvents>): void {
  useEffect(() => {
    const ipcRenderer = window.ipcRenderer

    if (!ipcRenderer) {
      console.warn('[useUpdater] ipcRenderer not available')
      return
    }

    const unsubscribers: Array<() => void> = []

    // Set up listeners for updater events
    if (events.onCheckingForUpdate) {
      const handler = ipcRenderer.on('updater:checking-for-update', () => {
        events.onCheckingForUpdate?.()
      })
      unsubscribers.push(() => handler?.())
    }

    if (events.onUpdateAvailable) {
      const handler = ipcRenderer.on('updater:update-available', (_event, data: unknown) => {
        const typedData = data as UpdateAvailableData
        events.onUpdateAvailable?.(typedData.version, typedData.releaseDate)
      })
      unsubscribers.push(() => handler?.())
    }

    if (events.onUpdateNotAvailable) {
      const handler = ipcRenderer.on('updater:update-not-available', () => {
        events.onUpdateNotAvailable?.()
      })
      unsubscribers.push(() => handler?.())
    }

    if (events.onDownloadProgress) {
      const handler = ipcRenderer.on('updater:download-progress', (_event, data: unknown) => {
        const typedData = data as DownloadProgressData
        events.onDownloadProgress?.(typedData.percent, typedData.bytesPerSecond)
      })
      unsubscribers.push(() => handler?.())
    }

    if (events.onUpdateDownloaded) {
      const handler = ipcRenderer.on('updater:update-downloaded', (_event, data: unknown) => {
        const typedData = data as UpdateDownloadedData
        events.onUpdateDownloaded?.(typedData.version)
      })
      unsubscribers.push(() => handler?.())
    }

    if (events.onError) {
      const handler = ipcRenderer.on('updater:error', (_event, data: unknown) => {
        const typedData = data as ErrorData
        events.onError?.(typedData.message)
      })
      unsubscribers.push(() => handler?.())
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [events])
}

export async function checkForUpdates(): Promise<void> {
  const ipcRenderer = window.ipcRenderer
  if (!ipcRenderer) {
    console.warn('[checkForUpdates] ipcRenderer not available')
    return
  }

  try {
    await ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK_FOR_UPDATE)
  } catch (error) {
    console.error('[checkForUpdates] Failed:', error)
  }
}

export async function quitAndInstallUpdate(): Promise<void> {
  const ipcRenderer = window.ipcRenderer
  if (!ipcRenderer) {
    console.warn('[quitAndInstallUpdate] ipcRenderer not available')
    return
  }

  try {
    await ipcRenderer.invoke(IPC_CHANNELS.UPDATER_QUIT_AND_INSTALL)
  } catch (error) {
    console.error('[quitAndInstallUpdate] Failed:', error)
  }
}
