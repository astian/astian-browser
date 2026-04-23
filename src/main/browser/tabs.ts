import { BrowserWindow, WebContentsView } from 'electron'
import type { BrowserState, BrowserTab, Preferences } from '../../shared/ipc'
import { loadState, saveState } from '../app/state-store'

const NEW_TAB_URL = 'https://astiango.com'
// Heights must match the React shell header in App.tsx
// Horizontal: navBar(48) + tabStrip(40) = 88 → pad to 92
// Sidebar: navBar(48) only → pad to 52
const RESERVED_TOP_HEIGHT_HORIZONTAL = 92
const RESERVED_TOP_HEIGHT_SIDEBAR = 52
const RESERVED_SIDEBAR_WIDTH = 224

interface ManagedTab {
  view: WebContentsView
  state: BrowserTab
}

export class TabsController {
  private readonly window: BrowserWindow
  private readonly tabs = new Map<string, ManagedTab>()
  private preferences: Preferences
  private activeTabId: string | null
  private listeners: Array<(state: BrowserState) => void> = []

  constructor(window: BrowserWindow) {
    this.window = window

    const persisted = loadState()
    this.preferences = persisted.preferences
    this.activeTabId = persisted.activeTabId

    if (persisted.tabs.length > 0) {
      for (const tab of persisted.tabs) {
        this.createTab(tab.url, tab.pinned, tab.id, false)
      }

      if (this.activeTabId && this.tabs.has(this.activeTabId)) {
        this.activateTab(this.activeTabId)
      } else {
        const firstTab = persisted.tabs[0]
        if (firstTab) {
          this.activateTab(firstTab.id)
        }
      }
    } else {
      this.createTab(NEW_TAB_URL)
    }

    this.window.on('resize', () => this.syncActiveViewBounds())
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

  createTab(url = NEW_TAB_URL, pinned = false, forcedId?: string, emit = true): BrowserState {
    const tabId = forcedId ?? crypto.randomUUID()
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        devTools: true
      }
    })

    const state: BrowserTab = {
      id: tabId,
      url,
      title: 'New Tab',
      pinned,
      loading: true,
      canGoBack: false,
      canGoForward: false
    }

    const managed: ManagedTab = { view, state }
    this.tabs.set(tabId, managed)

    view.webContents.on('did-start-loading', () => {
      managed.state.loading = true
      this.emit()
    })

    view.webContents.on('did-stop-loading', () => {
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

    this.window.contentView.addChildView(view)
    view.webContents.loadURL(url)
    this.activateTab(tabId)

    if (emit) {
      this.emit()
    }

    return this.getState()
  }

  closeTab(tabId: string): BrowserState {
    const tab = this.tabs.get(tabId)
    if (!tab) return this.getState()

    this.window.contentView.removeChildView(tab.view)
    tab.view.webContents.close({ waitForBeforeUnload: false })
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
    if (!this.tabs.has(tabId)) {
      return this.getState()
    }

    this.activeTabId = tabId
    const onboarded = this.preferences.onboardingCompleted

    for (const [id, managed] of this.tabs.entries()) {
      const isActive = id === tabId
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

    tab.view.webContents.loadURL(normalizeUrl(url))
    return this.getState()
  }

  goBack(): BrowserState {
    const tab = this.getActiveTab()
    if (!tab) return this.getState()

    if (tab.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack()
    }

    return this.getState()
  }

  goForward(): BrowserState {
    const tab = this.getActiveTab()
    if (!tab) return this.getState()

    if (tab.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward()
    }

    return this.getState()
  }

  reload(): BrowserState {
    const tab = this.getActiveTab()
    if (!tab) return this.getState()

    tab.view.webContents.reload()
    return this.getState()
  }

  updatePreferences(patch: Partial<Preferences>): BrowserState {
    this.preferences = { ...this.preferences, ...patch }
    // If onboarding just completed, make the active view visible.
    if (patch.onboardingCompleted === true) {
      const active = this.getActiveTab()
      if (active) {
        active.view.setVisible(true)
      }
    }
    this.syncActiveViewBounds()
    this.emit()
    return this.getState()
  }

  setContentVisible(visible: boolean): void {
    const active = this.getActiveTab()
    if (active) {
      active.view.setVisible(visible)
    }
  }

  private getActiveTab(): ManagedTab | null {
    if (!this.activeTabId) return null
    return this.tabs.get(this.activeTabId) ?? null
  }

  private syncActiveViewBounds(): void {
    const active = this.getActiveTab()
    if (!active) return

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
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return NEW_TAB_URL

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  if (trimmed.includes(' ') || !trimmed.includes('.')) {
    return `https://astiango.com/?q=${encodeURIComponent(trimmed)}`
  }

  return `https://${trimmed}`
}
