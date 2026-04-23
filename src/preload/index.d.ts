import { ElectronAPI } from '@electron-toolkit/preload'
import type { BrowserApi } from '../shared/ipc'

declare global {
  interface Window {
    electron: ElectronAPI
    browserApi: BrowserApi
  }
}
