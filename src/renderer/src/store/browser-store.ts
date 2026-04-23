import { create } from 'zustand'
import type { BrowserState } from '@shared/ipc'

interface BrowserStore {
  state: BrowserState | null
  setState: (state: BrowserState) => void
}

export const useBrowserStore = create<BrowserStore>((set) => ({
  state: null,
  setState: (state) => set({ state })
}))
