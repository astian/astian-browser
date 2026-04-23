import { contextBridge, ipcRenderer } from 'electron'
import type { BrowserApi, ExternalSchemeRequest } from '../shared/ipc'
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
  setContentVisible: (visible) => ipcRenderer.invoke(IPC_CHANNELS.SET_CONTENT_VISIBLE, visible),
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
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('browserApi', browserApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.browserApi = browserApi
}
