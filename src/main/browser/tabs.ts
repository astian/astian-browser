import { BrowserWindow, Session, WebContentsView, session } from 'electron'
import { rm } from 'node:fs/promises'
import { join } from 'path'
import type {
  BookmarkEntry,
  BrowserProfile,
  BrowserSpace,
  BrowserState,
  BrowserTab,
  ContentBounds,
  InstalledExtension,
  Preferences
} from '../../shared/ipc'
import { SEARCH_ENGINES } from '../../shared/ipc'
import { IPC_CHANNELS } from '../../shared/ipc'
import { loadShellState, saveShellState } from '../app/state-store'
import {
  dbGetProfiles,
  dbUpsertProfile,
  dbGetSpaces,
  dbUpsertSpace,
  dbGetHistory,
  dbAddHistoryEntry,
  dbDeleteHistoryEntry,
  dbClearHistory,
  dbGetBookmarks,
  dbUpsertBookmark,
  dbDeleteBookmark,
  dbGetExtensions,
  dbUpsertExtension,
  dbSetExtensionEnabled,
  dbDeleteExtension,
  migrateFromStateJsonIfNeeded
} from '../db/repository'
import { getStateFilePath } from '../app/state-store'
import { installCrxIntoSession } from '../services/extensions'
import { registerAstianProtocolForSession } from '../protocol/astian'

const DEFAULT_PROFILE_ID = 'default'
const DEFAULT_SPACE_ID = 'default-space'
const NEW_TAB_URL =
  process.env['ASTIAN_RESOURCE_MEASURE'] === '1' ? 'astian://newtab' : 'https://astiango.com'
const SHARED_PRELOAD_PATH = join(__dirname, '../../preload/index.js')
const SLEEP_TIMEOUT_MS = 10 * 60 * 1000
const SLEEP_CHECK_INTERVAL_MS = 60 * 1000
const RESERVED_TOP_HEIGHT_HORIZONTAL = 88
const RESERVED_TOP_HEIGHT_SIDEBAR = 48
const RESERVED_SIDEBAR_WIDTH = 224

interface ManagedTab {
  view: WebContentsView | null
  state: BrowserTab
}

export class TabsController {
  private readonly window: BrowserWindow
  private readonly tabs = new Map<string, ManagedTab>()
  private readonly profileSessions = new Map<string, Session>()
  private readonly sleepCheckInterval: NodeJS.Timeout
  private profiles: BrowserProfile[]
  private spaces: BrowserSpace[]
  private history: BrowserState['history']
  private bookmarks: BookmarkEntry[]
  private extensions: InstalledExtension[]
  private preferences: Preferences
  private contentBounds: ContentBounds | null = null
  private activeTabId: string | null
  private activeProfileId: string
  private activeSpaceId: string
  private listeners: Array<(state: BrowserState) => void> = []

  constructor(window: BrowserWindow) {
    this.window = window

    // One-time migration from legacy state.json
    migrateFromStateJsonIfNeeded(getStateFilePath())

    const persisted = loadShellState()
    this.preferences = persisted.preferences
    this.activeTabId = persisted.activeTabId
    this.activeProfileId = persisted.activeProfileId
    this.activeSpaceId = persisted.activeSpaceId

    // Load from DB
    this.profiles = dbGetProfiles()
    this.spaces = dbGetSpaces()

    this.ensureDefaultProfileAndSpace()

    // Load profile-scoped data after active profile is resolved
    this.history = dbGetHistory(this.activeProfileId)
    this.bookmarks = dbGetBookmarks(this.activeProfileId)
    this.extensions = dbGetExtensions(this.activeProfileId)

    if (persisted.tabs.length > 0) {
      const restoredActiveId = this.resolveRestoredActiveTabId(persisted.tabs)
      for (const tab of persisted.tabs) {
        const canWake = tab.id === restoredActiveId
        this.restoreTab(tab, canWake)
      }
      if (restoredActiveId) {
        this.activateTab(restoredActiveId)
      }
    }

    if (this.tabs.size === 0 || this.getTabsInActiveScope().length === 0) {
      this.createTab(NEW_TAB_URL)
    }

    this.syncWindowBackground()

    this.sleepCheckInterval = setInterval(() => this.sleepInactiveTabs(), SLEEP_CHECK_INTERVAL_MS)

    this.window.on('resize', () => {
      if (!this.contentBounds) {
        this.syncActiveViewBounds()
      }
    })
    this.window.on('closed', () => clearInterval(this.sleepCheckInterval))
    this.window.webContents.on('before-input-event', (event, input) => {
      this.handleInputCommand(event, input.control || input.meta, input.key)
    })
  }

  private handleInputCommand(
    event: { preventDefault: () => void },
    hasModifier: boolean,
    key: string
  ): void {
    if (!hasModifier) {
      return
    }

    const normalizedKey = key.toLowerCase()
    if (normalizedKey === 'k') {
      event.preventDefault()
      this.window.webContents.send(IPC_CHANNELS.APP_COMMAND, 'toggle-command-palette')
    }

    if (normalizedKey === 't') {
      event.preventDefault()
      this.window.webContents.send(IPC_CHANNELS.APP_COMMAND, 'new-tab')
    }
  }

  private resolveRestoredActiveTabId(tabs: BrowserTab[]): string | null {
    const scopedTabs = tabs.filter(
      (tab) => tab.profileId === this.activeProfileId && tab.spaceId === this.activeSpaceId
    )
    const activeInScope =
      this.activeTabId && scopedTabs.some((tab) => tab.id === this.activeTabId) ? this.activeTabId : null

    return activeInScope ?? scopedTabs[0]?.id ?? null
  }

  private ensureDefaultProfileAndSpace(): void {
    if (this.profiles.length === 0) {
      const defaultProfile: BrowserProfile = { id: DEFAULT_PROFILE_ID, name: 'Default', createdAt: Date.now() }
      this.profiles = [defaultProfile]
      this.activeProfileId = DEFAULT_PROFILE_ID
      dbUpsertProfile(defaultProfile)
    }

    if (!this.profiles.some((profile) => profile.id === this.activeProfileId)) {
      this.activeProfileId = this.profiles[0]!.id
    }

    if (this.spaces.length === 0) {
      const defaultSpace: BrowserSpace = {
        id: DEFAULT_SPACE_ID,
        profileId: this.activeProfileId,
        name: 'General',
        createdAt: Date.now()
      }
      this.spaces = [defaultSpace]
      this.activeSpaceId = DEFAULT_SPACE_ID
      dbUpsertSpace(defaultSpace)
      return
    }

    const activeProfileSpaces = this.spaces.filter((space) => space.profileId === this.activeProfileId)
    if (activeProfileSpaces.length === 0) {
      const fallbackSpaceId = crypto.randomUUID()
      const fallbackSpace: BrowserSpace = {
        id: fallbackSpaceId,
        profileId: this.activeProfileId,
        name: 'General',
        createdAt: Date.now()
      }
      this.spaces.push(fallbackSpace)
      this.activeSpaceId = fallbackSpaceId
      dbUpsertSpace(fallbackSpace)
      return
    }

    if (!activeProfileSpaces.some((space) => space.id === this.activeSpaceId)) {
      this.activeSpaceId = activeProfileSpaces[0]!.id
    }
  }

  private getTabsInActiveScope(): ManagedTab[] {
    return Array.from(this.tabs.values()).filter(
      (managed) =>
        managed.state.profileId === this.activeProfileId && managed.state.spaceId === this.activeSpaceId
    )
  }

  onStateChanged(listener: (state: BrowserState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((registered) => registered !== listener)
    }
  }

  getState(): BrowserState {
    const tabs = this.getTabsInActiveScope().map((managed) => managed.state)
    return {
      tabs,
      activeTabId: this.activeTabId,
      profiles: this.profiles,
      spaces: this.spaces,
      activeProfileId: this.activeProfileId,
      activeSpaceId: this.activeSpaceId,
      history: this.history,
      bookmarks: this.bookmarks,
      extensions: this.extensions,
      preferences: this.preferences
    }
  }

  createProfile(name: string): BrowserState {
    const profileId = crypto.randomUUID()
    const now = Date.now()
    const profileName = name.trim() || `Perfil ${this.profiles.length + 1}`
    const newProfile: BrowserProfile = { id: profileId, name: profileName, createdAt: now }
    this.profiles.push(newProfile)
    dbUpsertProfile(newProfile)

    const spaceId = crypto.randomUUID()
    const newSpace: BrowserSpace = { id: spaceId, profileId, name: 'General', createdAt: now }
    this.spaces.push(newSpace)
    dbUpsertSpace(newSpace)

    this.activeProfileId = profileId
    this.activeSpaceId = spaceId
    this.activeTabId = null
    this.createTab(NEW_TAB_URL, false, undefined, false, profileId, spaceId)
    this.emit()
    return this.getState()
  }

  switchProfile(profileId: string): BrowserState {
    const profile = this.profiles.find((item) => item.id === profileId)
    if (!profile) {
      return this.getState()
    }

    this.activeProfileId = profile.id
    const profileSpaces = this.spaces.filter((space) => space.profileId === profile.id)
    if (profileSpaces.length === 0) {
      const spaceId = crypto.randomUUID()
      const newSpace: BrowserSpace = { id: spaceId, profileId: profile.id, name: 'General', createdAt: Date.now() }
      this.spaces.push(newSpace)
      dbUpsertSpace(newSpace)
      this.activeSpaceId = spaceId
    } else {
      this.activeSpaceId = profileSpaces[0]!.id
    }

    // Reload history/bookmarks/extensions for new profile from DB
    this.history = dbGetHistory(this.activeProfileId)
    this.bookmarks = dbGetBookmarks(this.activeProfileId)
    this.extensions = dbGetExtensions(this.activeProfileId)

    const scopedTabs = this.getTabsInActiveScope()
    if (scopedTabs.length === 0) {
      this.activeTabId = null
      this.createTab(NEW_TAB_URL, false, undefined, false, this.activeProfileId, this.activeSpaceId)
    } else {
      this.activateTab(scopedTabs[0]!.state.id)
    }

    this.emit()
    return this.getState()
  }

  createSpace(name: string): BrowserState {
    const spaceId = crypto.randomUUID()
    const newSpace: BrowserSpace = {
      id: spaceId,
      profileId: this.activeProfileId,
      name: name.trim() || `Space ${this.spaces.filter((s) => s.profileId === this.activeProfileId).length + 1}`,
      createdAt: Date.now()
    }
    this.spaces.push(newSpace)
    dbUpsertSpace(newSpace)
    this.activeSpaceId = spaceId
    this.activeTabId = null
    this.createTab(NEW_TAB_URL, false, undefined, false, this.activeProfileId, this.activeSpaceId)
    this.emit()
    return this.getState()
  }

  switchSpace(spaceId: string): BrowserState {
    const target = this.spaces.find(
      (space) => space.id === spaceId && space.profileId === this.activeProfileId
    )
    if (!target) {
      return this.getState()
    }

    this.activeSpaceId = target.id
    const scopedTabs = this.getTabsInActiveScope()
    if (scopedTabs.length === 0) {
      this.activeTabId = null
      this.createTab(NEW_TAB_URL, false, undefined, false, this.activeProfileId, this.activeSpaceId)
    } else {
      this.activateTab(scopedTabs[0]!.state.id)
    }

    this.emit()
    return this.getState()
  }

  createTab(
    url = NEW_TAB_URL,
    pinned = false,
    forcedId?: string,
    emit = true,
    profileId = this.activeProfileId,
    spaceId = this.activeSpaceId
  ): BrowserState {
    const state: BrowserTab = {
      id: forcedId ?? crypto.randomUUID(),
      profileId,
      spaceId,
      url,
      title: 'New Tab',
      pinned,
      loading: true,
      sleeping: false,
      lastActiveAt: Date.now(),
      canGoBack: false,
      canGoForward: false
    }

    const managed: ManagedTab = { view: null, state }
    this.tabs.set(state.id, managed)
    this.wakeTab(managed)
    this.activateTab(state.id)

    if (emit) {
      this.emit()
    }

    return this.getState()
  }

  closeTab(tabId: string): BrowserState {
    const tab = this.tabs.get(tabId)
    if (!tab) return this.getState()

    this.detachView(tab)
    this.tabs.delete(tabId)

    if (this.activeTabId === tabId) {
      const next = this.getTabsInActiveScope()[0]
      this.activeTabId = next?.state.id ?? null
      if (next) {
        this.activateTab(next.state.id)
      }
    }

    if (this.getTabsInActiveScope().length === 0) {
      this.createTab(NEW_TAB_URL, false, undefined, false)
    }

    this.emit()
    return this.getState()
  }

  activateTab(tabId: string): BrowserState {
    const target = this.tabs.get(tabId)
    if (!target) {
      return this.getState()
    }

    this.activeProfileId = target.state.profileId
    this.activeSpaceId = target.state.spaceId
    this.activeTabId = tabId
    target.state.lastActiveAt = Date.now()

    if (target.state.sleeping || !target.view) {
      this.wakeTab(target)
    }

    const onboarded = this.preferences.onboardingCompleted

    for (const [id, managed] of this.tabs.entries()) {
      const isActive = id === tabId
      if (!managed.view) {
        continue
      }

      managed.view.setVisible(isActive && onboarded)
      if (isActive && onboarded) {
        this.syncActiveViewBounds()
        managed.view.webContents.focus()
      }
    }

    this.emit()
    return this.getState()
  }

  pinTab(tabId: string, pinned: boolean): BrowserState {
    const tab = this.tabs.get(tabId)
    if (!tab) return this.getState()

    tab.state.pinned = pinned
    this.emit()
    return this.getState()
  }

  navigate(url: string): BrowserState {
    const tab = this.getActiveTab()
    if (!tab) return this.getState()

    const normalized = this.normalizeUrl(url)
    const scheme = extractScheme(normalized)
    if (scheme && !isSafeInternalScheme(scheme)) {
      this.window.webContents.send(IPC_CHANNELS.EXTERNAL_SCHEME_REQUEST, {
        url: normalized,
        scheme
      })
      return this.getState()
    }

    if (!tab.view) {
      this.wakeTab(tab, normalized)
    } else {
      tab.view.webContents.loadURL(normalized)
    }

    return this.getState()
  }

  goBack(): BrowserState {
    const tab = this.getActiveTab()
    if (!tab?.view) return this.getState()

    if (tab.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack()
    }

    return this.getState()
  }

  goForward(): BrowserState {
    const tab = this.getActiveTab()
    if (!tab?.view) return this.getState()

    if (tab.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward()
    }

    return this.getState()
  }

  reload(): BrowserState {
    const tab = this.getActiveTab()
    if (!tab) return this.getState()

    if (!tab.view) {
      this.wakeTab(tab)
      return this.getState()
    }

    tab.view.webContents.reload()
    return this.getState()
  }

  addBookmark(url?: string, title?: string): BrowserState {
    const active = this.getActiveTab()
    const bookmarkUrl = url ?? active?.state.url
    if (!bookmarkUrl) {
      return this.getState()
    }

    const existing = this.bookmarks.find((bookmark) => bookmark.url === bookmarkUrl)
    if (existing) {
      this.bookmarks = this.bookmarks.filter((bookmark) => bookmark.id !== existing.id)
      dbDeleteBookmark(existing.id)
    }

    const newBookmark: BookmarkEntry = {
      id: crypto.randomUUID(),
      url: bookmarkUrl,
      title: title ?? active?.state.title ?? bookmarkUrl,
      createdAt: Date.now()
    }
    this.bookmarks.unshift(newBookmark)
    dbUpsertBookmark(newBookmark, this.activeProfileId)

    this.emit()
    return this.getState()
  }

  removeBookmark(bookmarkId: string): BrowserState {
    this.bookmarks = this.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId)
    dbDeleteBookmark(bookmarkId)
    this.emit()
    return this.getState()
  }

  async installExtensionFromCrx(filePath: string): Promise<BrowserState> {
    const targetSession = this.getProfileSession(this.activeProfileId)
    const beforeIds = new Set(targetSession.getAllExtensions().map((ext) => ext.id))

    await installCrxIntoSession(filePath, targetSession)

    const newExtension = targetSession
      .getAllExtensions()
      .find((extension) => !beforeIds.has(extension.id))

    if (newExtension) {
      const ext: InstalledExtension = {
        id: newExtension.id,
        profileId: this.activeProfileId,
        name: newExtension.name,
        version: newExtension.version,
        path: newExtension.path,
        enabled: true,
        installedAt: Date.now()
      }
      this.extensions = [
        ...this.extensions.filter((item) => item.id !== newExtension.id),
        ext
      ]
      dbUpsertExtension(ext)
    }

    this.emit()
    return this.getState()
  }

  async enableExtension(extensionId: string): Promise<BrowserState> {
    const ext = this.extensions.find((e) => e.id === extensionId)
    if (!ext) return this.getState()

    const targetSession = this.getProfileSession(this.activeProfileId)
    await targetSession.loadExtension(ext.path, { allowFileAccess: true })

    ext.enabled = true
    dbSetExtensionEnabled(extensionId, true)
    this.emit()
    return this.getState()
  }

  disableExtension(extensionId: string): BrowserState {
    const ext = this.extensions.find((e) => e.id === extensionId)
    if (!ext) return this.getState()

    const targetSession = this.getProfileSession(this.activeProfileId)
    targetSession.removeExtension(extensionId)

    ext.enabled = false
    dbSetExtensionEnabled(extensionId, false)
    this.emit()
    return this.getState()
  }

  async uninstallExtension(extensionId: string): Promise<BrowserState> {
    const ext = this.extensions.find((e) => e.id === extensionId)
    if (!ext) return this.getState()

    const targetSession = this.getProfileSession(this.activeProfileId)
    targetSession.removeExtension(extensionId)

    try {
      await rm(ext.path, { recursive: true, force: true })
    } catch {
      // Best-effort delete
    }

    this.extensions = this.extensions.filter((e) => e.id !== extensionId)
    dbDeleteExtension(extensionId)
    this.emit()
    return this.getState()
  }

  deleteHistoryEntry(entryId: string): BrowserState {
    this.history = this.history.filter((h) => h.id !== entryId)
    dbDeleteHistoryEntry(entryId)
    this.emit()
    return this.getState()
  }

  clearHistory(): BrowserState {
    this.history = []
    dbClearHistory(this.activeProfileId)
    this.emit()
    return this.getState()
  }

  updatePreferences(patch: Partial<Preferences>): BrowserState {
    this.preferences = { ...this.preferences, ...patch }
    if (patch.onboardingCompleted === true) {
      const active = this.getActiveTab()
      active?.view?.setVisible(true)
    }
    if (patch.theme) {
      this.syncWindowBackground()
    }
    this.syncActiveViewBounds()
    this.emit()
    return this.getState()
  }

  private syncWindowBackground(): void {
    const background = this.preferences.theme === 'light' ? '#f8fafc' : '#020617'
    this.window.setBackgroundColor(background)
  }

  setContentBounds(bounds: ContentBounds): void {
    this.contentBounds = {
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(0, Math.round(bounds.width)),
      height: Math.max(0, Math.round(bounds.height))
    }
    this.syncActiveViewBounds()
  }

  setContentVisible(visible: boolean): void {
    const active = this.getActiveTab()
    if (!active) {
      return
    }

    if (visible && !active.view) {
      this.wakeTab(active)
    }

    if (!active.view) {
      return
    }

    if (visible) {
      this.syncActiveViewBounds()
    }

    active.view.setVisible(visible)
  }

  private getActiveTab(): ManagedTab | null {
    if (!this.activeTabId) return null
    const tab = this.tabs.get(this.activeTabId) ?? null
    if (!tab) {
      return null
    }

    if (tab.state.profileId !== this.activeProfileId || tab.state.spaceId !== this.activeSpaceId) {
      return null
    }

    return tab
  }

  private restoreTab(tab: BrowserTab, wake: boolean): void {
    const managed: ManagedTab = {
      view: null,
      state: {
        ...tab,
        profileId: tab.profileId || DEFAULT_PROFILE_ID,
        spaceId: tab.spaceId || DEFAULT_SPACE_ID,
        sleeping: wake ? false : true,
        loading: wake ? true : false,
        lastActiveAt: tab.lastActiveAt ?? Date.now()
      }
    }

    this.tabs.set(tab.id, managed)

    if (wake) {
      this.wakeTab(managed)
    }
  }

  private wakeTab(managed: ManagedTab, targetUrl = managed.state.url): void {
    const view = this.createView(managed)

    managed.state.sleeping = false
    managed.state.loading = true
    managed.state.lastActiveAt = Date.now()
    managed.state.canGoBack = false
    managed.state.canGoForward = false

    view.webContents.loadURL(targetUrl)
  }

  private createView(managed: ManagedTab): WebContentsView {
    this.detachView(managed)

    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        devTools: true,
        preload: SHARED_PRELOAD_PATH,
        session: this.getProfileSession(managed.state.profileId)
      }
    })

    this.attachViewListeners(managed, view)
    this.window.contentView.addChildView(view)
    managed.view = view

    return view
  }

  private attachViewListeners(managed: ManagedTab, view: WebContentsView): void {
    view.webContents.on('before-input-event', (event, input) => {
      this.handleInputCommand(event, input.control || input.meta, input.key)
    })

    view.webContents.on('did-start-loading', () => {
      managed.state.loading = true
      managed.state.sleeping = false
      this.emit()
    })

    view.webContents.on('did-stop-loading', () => {
      if (managed.view !== view) {
        return
      }

      managed.state.loading = false
      managed.state.canGoBack = view.webContents.navigationHistory.canGoBack()
      managed.state.canGoForward = view.webContents.navigationHistory.canGoForward()
      this.emit()
    })

    view.webContents.on('page-title-updated', (_event, title) => {
      managed.state.title = title
      this.emit()
    })

    view.webContents.on('did-navigate', (_event, navigatedUrl) => {
      managed.state.url = navigatedUrl
      managed.state.canGoBack = view.webContents.navigationHistory.canGoBack()
      managed.state.canGoForward = view.webContents.navigationHistory.canGoForward()
      this.recordHistory(managed.state)
      this.emit()
    })

    view.webContents.on('did-fail-load', () => {
      managed.state.loading = false
      this.emit()
    })
  }

  private recordHistory(tab: BrowserTab): void {
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
      return
    }

    try {
      const entry = {
        id: crypto.randomUUID(),
        url: tab.url,
        title: tab.title || tab.url,
        visitedAt: Date.now()
      }
      this.history.unshift(entry)
      this.history = this.history.slice(0, 100) // keep in-memory cache small
      dbAddHistoryEntry(entry, this.activeProfileId)
    } catch (error) {
      console.error('[tabs] Failed to record history entry:', error)
    }
  }

  private detachView(managed: ManagedTab): void {
    if (!managed.view) {
      return
    }

    this.window.contentView.removeChildView(managed.view)
    managed.view.webContents.close({ waitForBeforeUnload: false })
    managed.view = null
  }

  private getProfileSession(profileId: string): Session {
    const resolvedProfileId = profileId || DEFAULT_PROFILE_ID
    const existing = this.profileSessions.get(resolvedProfileId)
    if (existing) {
      return existing
    }

    const profileSession = session.fromPartition(`persist:astian-profile:${resolvedProfileId}`)
    registerAstianProtocolForSession(profileSession)
    this.profileSessions.set(resolvedProfileId, profileSession)
    return profileSession
  }

  private sleepInactiveTabs(): void {
    if (!this.preferences.sleepTabsEnabled) {
      return
    }

    const now = Date.now()
    let changed = false

    for (const [tabId, managed] of this.tabs.entries()) {
      if (tabId === this.activeTabId || managed.state.sleeping) {
        continue
      }

      if (now - managed.state.lastActiveAt < SLEEP_TIMEOUT_MS) {
        continue
      }

      this.detachView(managed)
      managed.state.sleeping = true
      managed.state.loading = false
      managed.state.canGoBack = false
      managed.state.canGoForward = false
      changed = true
    }

    if (changed) {
      this.emit()
    }
  }

  private syncActiveViewBounds(): void {
    const active = this.getActiveTab()
    if (!active?.view) return

    if (!this.preferences.onboardingCompleted) {
      active.view.setVisible(false)
      return
    }

    const fallbackBounds = this.window.getContentBounds()
    const usingSidebarLayout = this.preferences.tabLayout === 'sidebar'
    const leftInset = usingSidebarLayout ? RESERVED_SIDEBAR_WIDTH : 0
    const topInset = usingSidebarLayout
      ? RESERVED_TOP_HEIGHT_SIDEBAR
      : RESERVED_TOP_HEIGHT_HORIZONTAL

    const resolved = this.contentBounds
      ? this.contentBounds
      : {
          x: leftInset,
          y: topInset,
          width: Math.max(fallbackBounds.width - leftInset, 0),
          height: Math.max(fallbackBounds.height - topInset, 0)
        }

    active.view.setBounds(resolved)
    active.view.setVisible(true)
  }

  private emit(): void {
    const state = this.getState()
    saveShellState({
      tabs: Array.from(this.tabs.values()).map((managed) => managed.state),
      activeTabId: this.activeTabId,
      activeProfileId: this.activeProfileId,
      activeSpaceId: this.activeSpaceId,
      preferences: this.preferences
    })
    for (const listener of this.listeners) {
      listener(state)
    }
  }

  private normalizeUrl(url: string): string {
    const trimmed = url.trim()
    if (!trimmed) return NEW_TAB_URL

    const explicitScheme = extractScheme(trimmed)
    if (explicitScheme) {
      return trimmed
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed
    }

    if (trimmed.includes(' ') || !trimmed.includes('.')) {
      const engine = SEARCH_ENGINES[this.preferences.searchEngine] ?? SEARCH_ENGINES.astiango
      return `${engine.url}${encodeURIComponent(trimmed)}`
    }

    return `https://${trimmed}`
  }
}

function extractScheme(url: string): string | null {
  const match = url.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/)
  return match?.[1]?.toLowerCase() ?? null
}

function isSafeInternalScheme(scheme: string): boolean {
  return scheme === 'http' || scheme === 'https' || scheme === 'astian'
}
