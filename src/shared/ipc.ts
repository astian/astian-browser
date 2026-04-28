export type TabLayout = 'horizontal' | 'sidebar'
export type Theme = 'dark' | 'light'
export type SearchEngine = 'astiango' | 'google' | 'duckduckgo' | 'bing'
export type AppCommand = 'toggle-command-palette' | 'new-tab'

export const SEARCH_ENGINES: Record<SearchEngine, { name: string; url: string }> = {
  astiango: { name: 'AstianGO', url: 'https://astiango.com/?q=' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' }
}

export interface BrowserTab {
  id: string
  profileId: string
  spaceId: string
  url: string
  title: string
  pinned: boolean
  loading: boolean
  sleeping: boolean
  lastActiveAt: number
  canGoBack: boolean
  canGoForward: boolean
}

export interface Preferences {
  tabLayout: TabLayout
  sidebarVisible: boolean
  onboardingCompleted: boolean
  welcomeDismissed: boolean
  theme: Theme
  searchEngine: SearchEngine
  adblockEnabled: boolean
  sleepTabsEnabled: boolean
  appIconGlyph: string
}

export interface BrowserProfile {
  id: string
  name: string
  createdAt: number
}

export interface BrowserSpace {
  id: string
  profileId: string
  name: string
  createdAt: number
}

export interface HistoryEntry {
  id: string
  url: string
  title: string
  visitedAt: number
}

export interface BookmarkEntry {
  id: string
  url: string
  title: string
  createdAt: number
}

export interface InstalledExtension {
  id: string
  name: string
  version: string
  path: string
}

export interface BrowserState {
  tabs: BrowserTab[]
  activeTabId: string | null
  profiles: BrowserProfile[]
  spaces: BrowserSpace[]
  activeProfileId: string
  activeSpaceId: string
  history: HistoryEntry[]
  bookmarks: BookmarkEntry[]
  extensions: InstalledExtension[]
  preferences: Preferences
}

export interface ExternalSchemeRequest {
  url: string
  scheme: string
}

export interface ContentBounds {
  x: number
  y: number
  width: number
  height: number
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
  createProfile: (name: string) => Promise<BrowserState>
  switchProfile: (profileId: string) => Promise<BrowserState>
  createSpace: (name: string) => Promise<BrowserState>
  switchSpace: (spaceId: string) => Promise<BrowserState>
  addBookmark: (url?: string, title?: string) => Promise<BrowserState>
  removeBookmark: (bookmarkId: string) => Promise<BrowserState>
  installExtensionFromCrx: (filePath: string) => Promise<BrowserState>
  setContentVisible: (visible: boolean) => Promise<void>
  setContentBounds: (bounds: ContentBounds) => Promise<void>
  confirmExternalScheme: (url: string) => Promise<boolean>
  onStateChanged: (listener: (state: BrowserState) => void) => () => void
  onExternalScheme: (listener: (req: ExternalSchemeRequest) => void) => () => void
  onAppCommand: (listener: (command: AppCommand) => void) => () => void
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
  CREATE_PROFILE: 'browser:create-profile',
  SWITCH_PROFILE: 'browser:switch-profile',
  CREATE_SPACE: 'browser:create-space',
  SWITCH_SPACE: 'browser:switch-space',
  ADD_BOOKMARK: 'browser:add-bookmark',
  REMOVE_BOOKMARK: 'browser:remove-bookmark',
  INSTALL_EXTENSION_FROM_CRX: 'browser:install-extension-from-crx',
  SET_CONTENT_VISIBLE: 'browser:set-content-visible',
  SET_CONTENT_BOUNDS: 'browser:set-content-bounds',
  STATE_CHANGED: 'browser:state-changed',
  CONFIRM_EXTERNAL_SCHEME: 'browser:confirm-external-scheme',
  EXTERNAL_SCHEME_REQUEST: 'browser:external-scheme-request',
  APP_COMMAND: 'browser:app-command',
  // Updater channels
  UPDATER_CHECK_FOR_UPDATE: 'updater:check-for-update',
  UPDATER_QUIT_AND_INSTALL: 'updater:quit-and-install'
} as const
