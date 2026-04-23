import type { BrowserApi } from '../shared/ipc'

interface IpcRendererApi {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => () => void
}

declare global {
  interface Window {
    browserApi: BrowserApi
    ipcRenderer: IpcRendererApi
  }
}
