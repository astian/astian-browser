import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import type { TabsController } from '../browser/tabs'

export function registerBrowserIpc(mainWindow: BrowserWindow, tabs: TabsController): void {
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
  ipcMain.handle(IPC_CHANNELS.SET_CONTENT_VISIBLE, (_event, visible: boolean) =>
    tabs.setContentVisible(visible)
  )

  tabs.onStateChanged((state) => {
    mainWindow.webContents.send(IPC_CHANNELS.STATE_CHANGED, state)
  })
}
