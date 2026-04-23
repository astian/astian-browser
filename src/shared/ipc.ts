export type TabLayout = 'horizontal' | 'sidebar'

export interface BrowserTab {
  id: string
  url: string
  title: string
  pinned: boolean
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface Preferences {
  tabLayout: TabLayout
  sidebarVisible: boolean
  onboardingCompleted: boolean
  welcomeDismissed: boolean
}

export interface BrowserState {
  tabs: BrowserTab[]
  activeTabId: string | null
  preferences: Preferences
}

export interface BrowserApi {
  getState: () => Promise<BrowserState>
  createTab: (url?: string, pinned?: boolean) => Promise<BrowserState>
  closeTab: (tabId: string) => Promise<BrowserState>
  activateTab: (tabId: string) => Promise<BrowserState>
  pinTab: (tabId: string, pinned: boolean) => Promise<BrowserState>
  navigate: (url: string) => Promise<BrowserState>
  goBack: () => Promise<BrowserState>
  goForward: () => Promise<BrowserState>
  reload: () => Promise<BrowserState>
  updatePreferences: (patch: Partial<Preferences>) => Promise<BrowserState>
  setContentVisible: (visible: boolean) => Promise<void>
  onStateChanged: (listener: (state: BrowserState) => void) => () => void
}

export const IPC_CHANNELS = {
  GET_STATE: 'browser:get-state',
  CREATE_TAB: 'browser:create-tab',
  CLOSE_TAB: 'browser:close-tab',
  ACTIVATE_TAB: 'browser:activate-tab',
  PIN_TAB: 'browser:pin-tab',
  NAVIGATE: 'browser:navigate',
  GO_BACK: 'browser:go-back',
  GO_FORWARD: 'browser:go-forward',
  RELOAD: 'browser:reload',
  UPDATE_PREFERENCES: 'browser:update-preferences',
  SET_CONTENT_VISIBLE: 'browser:set-content-visible',
  STATE_CHANGED: 'browser:state-changed'
} as const
