import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { BrowserTab, Preferences } from '../../shared/ipc'

const DEFAULT_PROFILE_ID = 'default'

function normalizeTab(tab: Partial<BrowserTab>): BrowserTab {
  return {
    id: tab.id ?? crypto.randomUUID(),
    profileId: tab.profileId ?? DEFAULT_PROFILE_ID,
    spaceId: tab.spaceId ?? 'default-space',
    url: tab.url ?? 'https://astiango.com',
    title: tab.title ?? 'New Tab',
    pinned: tab.pinned ?? false,
    loading: tab.loading ?? false,
    sleeping: tab.sleeping ?? false,
    lastActiveAt: tab.lastActiveAt ?? Date.now(),
    canGoBack: tab.canGoBack ?? false,
    canGoForward: tab.canGoForward ?? false
  }
}

export const DEFAULT_PREFERENCES: Preferences = {
  tabLayout: 'horizontal',
  sidebarVisible: true,
  onboardingCompleted: false,
  welcomeDismissed: false,
  theme: 'light',
  searchEngine: 'astiango',
  adblockEnabled: false,
  sleepTabsEnabled: true,
  appIconGlyph: 'A'
}

export interface PersistedShellState {
  tabs: BrowserTab[]
  activeTabId: string | null
  activeProfileId: string
  activeSpaceId: string
  preferences: Preferences
}

const DEFAULT_SHELL_STATE: PersistedShellState = {
  tabs: [],
  activeTabId: null,
  activeProfileId: DEFAULT_PROFILE_ID,
  activeSpaceId: 'default-space',
  preferences: DEFAULT_PREFERENCES
}

export function getStateFilePath(): string {
  return join(app.getPath('userData'), 'state.json')
}

function ensureStateDir(): void {
  mkdirSync(dirname(getStateFilePath()), { recursive: true })
}

export function loadShellState(): PersistedShellState {
  ensureStateDir()

  const stateFilePath = getStateFilePath()
  if (!existsSync(stateFilePath)) {
    return DEFAULT_SHELL_STATE
  }

  try {
    const raw = readFileSync(stateFilePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<PersistedShellState>

    return {
      tabs: (parsed.tabs ?? []).map((tab) => normalizeTab(tab)),
      activeTabId: parsed.activeTabId ?? null,
      activeProfileId: parsed.activeProfileId ?? DEFAULT_PROFILE_ID,
      activeSpaceId: parsed.activeSpaceId ?? 'default-space',
      preferences: { ...DEFAULT_PREFERENCES, ...(parsed.preferences ?? {}) }
    }
  } catch {
    return DEFAULT_SHELL_STATE
  }
}

export function saveShellState(state: PersistedShellState): void {
  ensureStateDir()
  writeFileSync(getStateFilePath(), JSON.stringify(state, null, 2))
}
