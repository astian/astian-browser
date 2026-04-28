import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type {
  BookmarkEntry,
  BrowserProfile,
  BrowserSpace,
  BrowserState,
  BrowserTab,
  HistoryEntry,
  InstalledExtension,
  Preferences
} from '../../shared/ipc'

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

const DEFAULT_PREFERENCES: Preferences = {
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

const DEFAULT_PROFILE: BrowserProfile = {
  id: DEFAULT_PROFILE_ID,
  name: 'Default',
  createdAt: Date.now()
}

const DEFAULT_SPACE: BrowserSpace = {
  id: 'default-space',
  profileId: DEFAULT_PROFILE_ID,
  name: 'General',
  createdAt: Date.now()
}

const DEFAULT_STATE: BrowserState = {
  tabs: [],
  activeTabId: null,
  profiles: [DEFAULT_PROFILE],
  spaces: [DEFAULT_SPACE],
  activeProfileId: DEFAULT_PROFILE_ID,
  activeSpaceId: DEFAULT_SPACE.id,
  history: [],
  bookmarks: [],
  extensions: [],
  preferences: DEFAULT_PREFERENCES
}

function normalizeProfiles(items: unknown): BrowserProfile[] {
  if (!Array.isArray(items)) {
    return [DEFAULT_PROFILE]
  }

  const normalized = items
    .map((item) => item as Partial<BrowserProfile>)
    .filter((item) => Boolean(item.id))
    .map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      name: item.name ?? 'Profile',
      createdAt: item.createdAt ?? Date.now()
    }))

  return normalized.length > 0 ? normalized : [DEFAULT_PROFILE]
}

function normalizeSpaces(items: unknown, profiles: BrowserProfile[]): BrowserSpace[] {
  const profileIds = new Set(profiles.map((profile) => profile.id))
  if (!Array.isArray(items)) {
    return [DEFAULT_SPACE]
  }

  const normalized = items
    .map((item) => item as Partial<BrowserSpace>)
    .filter(
      (item): item is BrowserSpace =>
        Boolean(item.id) &&
        Boolean(item.profileId) &&
        Boolean(item.name) &&
        profileIds.has(item.profileId as string)
    )
    .map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      profileId: item.profileId ?? DEFAULT_PROFILE_ID,
      name: item.name ?? 'Space',
      createdAt: item.createdAt ?? Date.now()
    }))

  if (normalized.length > 0) {
    return normalized
  }

  return [DEFAULT_SPACE]
}

function normalizeHistory(items: unknown): HistoryEntry[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item) => item as Partial<HistoryEntry>)
    .filter((item) => Boolean(item.url))
    .map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      url: item.url ?? 'about:blank',
      title: item.title ?? item.url ?? 'Untitled',
      visitedAt: item.visitedAt ?? Date.now()
    }))
}

function normalizeBookmarks(items: unknown): BookmarkEntry[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item) => item as Partial<BookmarkEntry>)
    .filter((item) => Boolean(item.url))
    .map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      url: item.url ?? 'about:blank',
      title: item.title ?? item.url ?? 'Untitled',
      createdAt: item.createdAt ?? Date.now()
    }))
}

function normalizeExtensions(items: unknown): InstalledExtension[] {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item) => item as Partial<InstalledExtension>)
    .filter((item) => Boolean(item.id) && Boolean(item.path))
    .map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      name: item.name ?? 'Extension',
      version: item.version ?? '0.0.0',
      path: item.path ?? ''
    }))
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
    const profiles = normalizeProfiles(parsed.profiles)
    const spaces = normalizeSpaces(parsed.spaces, profiles)
    const activeProfileId =
      parsed.activeProfileId && profiles.some((profile) => profile.id === parsed.activeProfileId)
        ? parsed.activeProfileId
        : profiles[0]!.id
    const profileSpaces = spaces.filter((space) => space.profileId === activeProfileId)
    const activeSpaceId =
      parsed.activeSpaceId && profileSpaces.some((space) => space.id === parsed.activeSpaceId)
        ? parsed.activeSpaceId
        : (profileSpaces[0]?.id ?? spaces[0]!.id)

    return {
      tabs: (parsed.tabs ?? []).map((tab) => normalizeTab(tab)),
      activeTabId: parsed.activeTabId ?? null,
      profiles,
      spaces,
      activeProfileId,
      activeSpaceId,
      history: normalizeHistory(parsed.history),
      bookmarks: normalizeBookmarks(parsed.bookmarks),
      extensions: normalizeExtensions(parsed.extensions),
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
