import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { BrowserState, Preferences } from '../../shared/ipc'

const DEFAULT_PREFERENCES: Preferences = {
  tabLayout: 'horizontal',
  sidebarVisible: true,
  onboardingCompleted: false,
  welcomeDismissed: false
}

const DEFAULT_STATE: BrowserState = {
  tabs: [],
  activeTabId: null,
  preferences: DEFAULT_PREFERENCES
}

const stateFilePath = join(app.getPath('userData'), 'state.json')

function ensureStateDir(): void {
  mkdirSync(dirname(stateFilePath), { recursive: true })
}

export function loadState(): BrowserState {
  ensureStateDir()

  if (!existsSync(stateFilePath)) {
    return DEFAULT_STATE
  }

  try {
    const raw = readFileSync(stateFilePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<BrowserState>

    return {
      tabs: parsed.tabs ?? [],
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
  writeFileSync(stateFilePath, JSON.stringify(state, null, 2))
}
