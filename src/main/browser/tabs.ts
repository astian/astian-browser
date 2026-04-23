import { BrowserWindow, Session, WebContentsView, session } from 'electron'
import { join } from 'path'
import type { BrowserState, BrowserTab, Preferences } from '../../shared/ipc'
import { SEARCH_ENGINES } from '../../shared/ipc'
import { IPC_CHANNELS } from '../../shared/ipc'
import { loadState, saveState } from '../app/state-store'

const DEFAULT_PROFILE_ID = 'default'
const NEW_TAB_URL =
  process.env['ASTIAN_RESOURCE_MEASURE'] === '1' ? 'astian://newtab' : 'https://astiango.com'
const SHARED_PRELOAD_PATH = join(__dirname, '../../preload/index.js')
const SLEEP_TIMEOUT_MS = 10 * 60 * 1000
const SLEEP_CHECK_INTERVAL_MS = 60 * 1000
// Heights must match the React shell header in App.tsx
// Horizontal: navBar(48) + tabStrip(40) = 88 -> pad to 92
// Sidebar: navBar(48) only -> pad to 52
const RESERVED_TOP_HEIGHT_HORIZONTAL = 92
const RESERVED_TOP_HEIGHT_SIDEBAR = 52
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
  private preferences: Preferences
  private activeTabId: string | null
  private listeners: Array<(state: BrowserState) => void> = []

  constructor(window: BrowserWindow) {
    this.window = window

    const persisted = loadState()
    this.preferences = persisted.preferences
    this.activeTabId = persisted.activeTabId

    if (persisted.tabs.length > 0) {
      const restoredActiveId =
        this.activeTabId && persisted.tabs.some((tab) => tab.id === this.activeTabId)
          ? this.activeTabId
          : (persisted.tabs[0]?.id ?? null)

      for (const tab of persisted.tabs) {
        this.restoreTab(tab, tab.id === restoredActiveId)
      }

      if (restoredActiveId) {
        this.activateTab(restoredActiveId)
      }
    } else {
      this.createTab(NEW_TAB_URL)
    }

    this.sleepCheckInterval = setInterval(() => this.sleepInactiveTabs(), SLEEP_CHECK_INTERVAL_MS)

    this.window.on('resize', () => this.syncActiveViewBounds())
    this.window.on('closed', () => clearInterval(this.sleepCheckInterval))
  }

  onStateChanged(listener: (state: BrowserState) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((registered) => registered !== listener)
    }
  }

  getState(): BrowserState {
    const tabs = Array.from(this.tabs.values()).map((managed) => managed.state)
    return {
      tabs,
      activeTabId: this.activeTabId,
      preferences: this.preferences
    }
  }

  createTab(
    url = NEW_TAB_URL,
    pinned = false,
    forcedId?: string,
    emit = true,
    profileId = DEFAULT_PROFILE_ID
  ): BrowserState {
    const state: BrowserTab = {
      id: forcedId ?? crypto.randomUUID(),
      profileId,
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
      const next = Array.from(this.tabs.keys())[0]
      this.activeTabId = next ?? null
      if (next) {
        this.activateTab(next)
      }
    }

    if (this.tabs.size === 0) {
      this.createTab(NEW_TAB_URL)
    }

    this.emit()
    return this.getState()
  }

  activateTab(tabId: string): BrowserState {
    const target = this.tabs.get(tabId)
    if (!target) {
      return this.getState()
    }

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

      // Hide ALL views when onboarding is not done so the React
      // modal receives clicks (native views always sit on top of webContents).
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

  updatePreferences(patch: Partial<Preferences>): BrowserState {
    this.preferences = { ...this.preferences, ...patch }
    // If onboarding just completed, make the active view visible.
    if (patch.onboardingCompleted === true) {
      const active = this.getActiveTab()
      active?.view?.setVisible(true)
    }
    this.syncActiveViewBounds()
    this.emit()
    return this.getState()
  }

  setContentVisible(visible: boolean): void {
    const active = this.getActiveTab()
    active?.view?.setVisible(visible)
  }

  private getActiveTab(): ManagedTab | null {
    if (!this.activeTabId) return null
    return this.tabs.get(this.activeTabId) ?? null
  }

  private restoreTab(tab: BrowserTab, wake: boolean): void {
    const managed: ManagedTab = {
      view: null,
      state: {
        ...tab,
        profileId: tab.profileId || DEFAULT_PROFILE_ID,
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
      this.emit()
    })

    view.webContents.on('did-fail-load', () => {
      managed.state.loading = false
      this.emit()
    })
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
    this.profileSessions.set(resolvedProfileId, profileSession)
    return profileSession
  }

  private sleepInactiveTabs(): void {
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

    // Don't position/show view during onboarding.
    if (!this.preferences.onboardingCompleted) {
      active.view.setVisible(false)
      return
    }

    const bounds = this.window.getContentBounds()
    const usingSidebarLayout = this.preferences.tabLayout === 'sidebar'
    const leftInset = usingSidebarLayout ? RESERVED_SIDEBAR_WIDTH : 0
    const topInset = usingSidebarLayout
      ? RESERVED_TOP_HEIGHT_SIDEBAR
      : RESERVED_TOP_HEIGHT_HORIZONTAL

    active.view.setBounds({
      x: leftInset,
      y: topInset,
      width: Math.max(bounds.width - leftInset, 0),
      height: Math.max(bounds.height - topInset, 0)
    })
    active.view.setVisible(true)
  }

  private emit(): void {
    const state = this.getState()
    saveState(state)
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
