import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import type { TabsController } from '../browser/tabs'
import type { UpdaterService } from '../services/updater'

export function registerBrowserIpc(
  mainWindow: BrowserWindow,
  tabs: TabsController,
  updater?: UpdaterService
): void {
  ipcMain.handle(IPC_CHANNELS.GET_STATE, () => tabs.getState())
  ipcMain.handle(IPC_CHANNELS.CREATE_TAB, (_event, url?: string, pinned?: boolean) =>
    tabs.createTab(url, pinned)
  )
  ipcMain.handle(IPC_CHANNELS.CLOSE_TAB, (_event, tabId: string) => tabs.closeTab(tabId))
  ipcMain.handle(IPC_CHANNELS.ACTIVATE_TAB, (_event, tabId: string) => tabs.activateTab(tabId))
  ipcMain.handle(IPC_CHANNELS.PIN_TAB, (_event, tabId: string, pinned: boolean) =>
    tabs.pinTab(tabId, pinned)
  )
  ipcMain.handle(IPC_CHANNELS.NAVIGATE, (_event, url: string) => tabs.navigate(url))
  ipcMain.handle(IPC_CHANNELS.GO_BACK, () => tabs.goBack())
  ipcMain.handle(IPC_CHANNELS.GO_FORWARD, () => tabs.goForward())
  ipcMain.handle(IPC_CHANNELS.RELOAD, () => tabs.reload())
  ipcMain.handle(IPC_CHANNELS.UPDATE_PREFERENCES, (_event, patch) => tabs.updatePreferences(patch))
  ipcMain.handle(IPC_CHANNELS.CREATE_PROFILE, (_event, name: string) => tabs.createProfile(name))
  ipcMain.handle(IPC_CHANNELS.SWITCH_PROFILE, (_event, profileId: string) =>
    tabs.switchProfile(profileId)
  )
  ipcMain.handle(IPC_CHANNELS.CREATE_SPACE, (_event, name: string) => tabs.createSpace(name))
  ipcMain.handle(IPC_CHANNELS.SWITCH_SPACE, (_event, spaceId: string) => tabs.switchSpace(spaceId))
  ipcMain.handle(IPC_CHANNELS.ADD_BOOKMARK, (_event, url?: string, title?: string) =>
    tabs.addBookmark(url, title)
  )
  ipcMain.handle(IPC_CHANNELS.REMOVE_BOOKMARK, (_event, bookmarkId: string) =>
    tabs.removeBookmark(bookmarkId)
  )
  ipcMain.handle(IPC_CHANNELS.INSTALL_EXTENSION_FROM_CRX, (_event, filePath: string) =>
    tabs.installExtensionFromCrx(filePath)
  )
  ipcMain.handle(IPC_CHANNELS.ENABLE_EXTENSION, (_event, extensionId: string) =>
    tabs.enableExtension(extensionId)
  )
  ipcMain.handle(IPC_CHANNELS.DISABLE_EXTENSION, (_event, extensionId: string) =>
    tabs.disableExtension(extensionId)
  )
  ipcMain.handle(IPC_CHANNELS.UNINSTALL_EXTENSION, (_event, extensionId: string) =>
    tabs.uninstallExtension(extensionId)
  )
  ipcMain.handle(IPC_CHANNELS.DELETE_HISTORY_ENTRY, (_event, entryId: string) =>
    tabs.deleteHistoryEntry(entryId)
  )
  ipcMain.handle(IPC_CHANNELS.CLEAR_HISTORY, () => tabs.clearHistory())
  ipcMain.handle(IPC_CHANNELS.SET_CONTENT_VISIBLE, (_event, visible: boolean) =>
    tabs.setContentVisible(visible)
  )
  ipcMain.handle(IPC_CHANNELS.SET_CONTENT_BOUNDS, (_event, bounds) => tabs.setContentBounds(bounds))
  // CONFIRM_EXTERNAL_SCHEME is registered in main/index.ts where dialog + shell are available

  // Updater handlers
  if (updater) {
    ipcMain.handle(IPC_CHANNELS.UPDATER_CHECK_FOR_UPDATE, () => updater.checkForUpdates())
    ipcMain.handle(IPC_CHANNELS.UPDATER_QUIT_AND_INSTALL, () => updater.quitAndInstall())
  }

  tabs.onStateChanged((state) => {
    mainWindow.webContents.send(IPC_CHANNELS.STATE_CHANGED, state)
  })
}
