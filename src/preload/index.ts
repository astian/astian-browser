import { contextBridge, ipcRenderer } from 'electron'
import type { AppCommand, BrowserApi, ExternalSchemeRequest } from '../shared/ipc'
import { IPC_CHANNELS } from '../shared/ipc'

const browserApi: BrowserApi = {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.GET_STATE),
  createTab: (url, pinned) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_TAB, url, pinned),
  closeTab: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.CLOSE_TAB, tabId),
  activateTab: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.ACTIVATE_TAB, tabId),
  pinTab: (tabId, pinned) => ipcRenderer.invoke(IPC_CHANNELS.PIN_TAB, tabId, pinned),
  navigate: (url) => ipcRenderer.invoke(IPC_CHANNELS.NAVIGATE, url),
  goBack: () => ipcRenderer.invoke(IPC_CHANNELS.GO_BACK),
  goForward: () => ipcRenderer.invoke(IPC_CHANNELS.GO_FORWARD),
  reload: () => ipcRenderer.invoke(IPC_CHANNELS.RELOAD),
  updatePreferences: (patch) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_PREFERENCES, patch),
  createProfile: (name) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_PROFILE, name),
  switchProfile: (profileId) => ipcRenderer.invoke(IPC_CHANNELS.SWITCH_PROFILE, profileId),
  createSpace: (name) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_SPACE, name),
  switchSpace: (spaceId) => ipcRenderer.invoke(IPC_CHANNELS.SWITCH_SPACE, spaceId),
  addBookmark: (url, title) => ipcRenderer.invoke(IPC_CHANNELS.ADD_BOOKMARK, url, title),
  removeBookmark: (bookmarkId) => ipcRenderer.invoke(IPC_CHANNELS.REMOVE_BOOKMARK, bookmarkId),
  installExtensionFromCrx: (filePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.INSTALL_EXTENSION_FROM_CRX, filePath),
  enableExtension: (extensionId) => ipcRenderer.invoke(IPC_CHANNELS.ENABLE_EXTENSION, extensionId),
  disableExtension: (extensionId) => ipcRenderer.invoke(IPC_CHANNELS.DISABLE_EXTENSION, extensionId),
  uninstallExtension: (extensionId) => ipcRenderer.invoke(IPC_CHANNELS.UNINSTALL_EXTENSION, extensionId),
  deleteHistoryEntry: (entryId) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_HISTORY_ENTRY, entryId),
  clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_HISTORY),
  setContentVisible: (visible) => ipcRenderer.invoke(IPC_CHANNELS.SET_CONTENT_VISIBLE, visible),
  setContentBounds: (bounds) => ipcRenderer.invoke(IPC_CHANNELS.SET_CONTENT_BOUNDS, bounds),
  confirmExternalScheme: (url) => ipcRenderer.invoke(IPC_CHANNELS.CONFIRM_EXTERNAL_SCHEME, url),
  onStateChanged: (listener): (() => void) => {
    const subscription = (_event: unknown, state: Parameters<typeof listener>[0]): void =>
      listener(state)
    ipcRenderer.on(IPC_CHANNELS.STATE_CHANGED, subscription)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.STATE_CHANGED, subscription)
    }
  },
  onExternalScheme: (listener): (() => void) => {
    const subscription = (_event: unknown, req: ExternalSchemeRequest): void => listener(req)
    ipcRenderer.on(IPC_CHANNELS.EXTERNAL_SCHEME_REQUEST, subscription)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EXTERNAL_SCHEME_REQUEST, subscription)
    }
  },
  onAppCommand: (listener): (() => void) => {
    const subscription = (_event: unknown, command: AppCommand): void => listener(command)
    ipcRenderer.on(IPC_CHANNELS.APP_COMMAND, subscription)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.APP_COMMAND, subscription)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('browserApi', browserApi)
    contextBridge.exposeInMainWorld('ipcRenderer', {
      invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
      on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => {
        ipcRenderer.on(channel, listener)
        return () => ipcRenderer.removeListener(channel, listener)
      }
    })
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.browserApi = browserApi
  // @ts-ignore (define in dts)
  window.ipcRenderer = {
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => {
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  }
}
