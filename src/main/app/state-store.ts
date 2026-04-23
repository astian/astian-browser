import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { BrowserState, BrowserTab, Preferences } from '../../shared/ipc'

const DEFAULT_PROFILE_ID = 'default'

function normalizeTab(tab: Partial<BrowserTab>): BrowserTab {
  return {
    id: tab.id ?? crypto.randomUUID(),
    profileId: tab.profileId ?? DEFAULT_PROFILE_ID,
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

const DEFAULT_PREFERENCES: Preferences = {
  tabLayout: 'horizontal',
  sidebarVisible: true,
  onboardingCompleted: false,
  welcomeDismissed: false,
  theme: 'light',
  searchEngine: 'astiango',
  adblockEnabled: false
}

const DEFAULT_STATE: BrowserState = {
  tabs: [],
  activeTabId: null,
  preferences: DEFAULT_PREFERENCES
}

function getStateFilePath(): string {
  return join(app.getPath('userData'), 'state.json')
}

function ensureStateDir(): void {
  mkdirSync(dirname(getStateFilePath()), { recursive: true })
}

export function loadState(): BrowserState {
  ensureStateDir()

  const stateFilePath = getStateFilePath()

  if (!existsSync(stateFilePath)) {
    return DEFAULT_STATE
  }

  try {
    const raw = readFileSync(stateFilePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<BrowserState>

    return {
      tabs: (parsed.tabs ?? []).map((tab) => normalizeTab(tab)),
      activeTabId: parsed.activeTabId ?? null,
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...(parsed.preferences ?? {})
      }
    }
  } catch {
    return DEFAULT_STATE
  }
}

export function saveState(state: BrowserState): void {
  ensureStateDir()
  writeFileSync(getStateFilePath(), JSON.stringify(state, null, 2))
}
