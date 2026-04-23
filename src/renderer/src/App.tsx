import { useEffect, useRef, useState } from 'react'
import {
  Globe,
  Pin,
  Plus,
  Settings2,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  LayoutPanelLeft,
  Rows3,
  Loader2,
  Lock
} from 'lucide-react'
import type { BrowserTab, BrowserState, TabLayout } from '@shared/ipc'
import { useBrowserStore } from '@renderer/store/browser-store'

/* ─────────────────────────────────────────────────────────────────────────
   Astian Browser – Shell UI
   Layout heights MUST match the constants in src/main/browser/tabs.ts:
     RESERVED_TOP_HEIGHT_HORIZONTAL = 92  (navBar 48 + tabStrip 40 + 4 buffer)
     RESERVED_TOP_HEIGHT_SIDEBAR    = 52  (navBar 48 + 4 buffer)
     RESERVED_SIDEBAR_WIDTH         = 224 (w-56 = 14rem = 224px)
───────────────────────────────────────────────────────────────────────── */

// ── small helpers ────────────────────────────────────────────────────────

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function isSecure(url: string): boolean {
  return url.startsWith('https://')
}

// ── sub-components ───────────────────────────────────────────────────────

function Splash(): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-950">
      <div className="text-center">
        <Loader2 size={30} className="mx-auto animate-spin text-blue-400" />
        <p className="mt-3 text-sm text-neutral-400">Iniciando Astian…</p>
      </div>
    </div>
  )
}

function ErrorScreen({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-950 p-8">
      <div className="max-w-md rounded-xl border border-red-800 bg-red-950/50 p-6 text-center">
        <p className="font-semibold text-red-300">Error al iniciar</p>
        <p className="mt-2 text-sm text-red-200/80">{message}</p>
        <p className="mt-3 text-xs text-neutral-500">Reinicia con: bun run dev</p>
      </div>
    </div>
  )
}

function Onboarding({ onChoose }: { onChoose: (layout: TabLayout) => void }): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-10 bg-neutral-950 text-neutral-100">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl font-bold shadow-xl shadow-blue-900/60">
          A
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenido a Astian</h1>
        <p className="mt-1.5 text-neutral-400">Elige cómo quieres ver tus pestañas</p>
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-4 px-6">
        <button
          className="group flex flex-col items-center gap-4 rounded-2xl border border-neutral-700 bg-neutral-900 p-6 transition-all duration-150 hover:border-blue-500 hover:bg-blue-600/10 active:scale-95"
          onClick={() => onChoose('horizontal')}
        >
          <Rows3 size={32} className="text-neutral-400 group-hover:text-blue-400" />
          <div className="text-center">
            <p className="font-medium">Horizontal</p>
            <p className="mt-0.5 text-xs text-neutral-500">Pestañas arriba, estilo Chrome</p>
          </div>
        </button>

        <button
          className="group flex flex-col items-center gap-4 rounded-2xl border border-neutral-700 bg-neutral-900 p-6 transition-all duration-150 hover:border-blue-500 hover:bg-blue-600/10 active:scale-95"
          onClick={() => onChoose('sidebar')}
        >
          <LayoutPanelLeft size={32} className="text-neutral-400 group-hover:text-blue-400" />
          <div className="text-center">
            <p className="font-medium">Sidebar</p>
            <p className="mt-0.5 text-xs text-neutral-500">Panel lateral, estilo Arc/Zen</p>
          </div>
        </button>
      </div>

      <p className="text-xs text-neutral-600">
        Puedes cambiarlo en cualquier momento desde preferencias
      </p>
    </div>
  )
}

function NavBtn({
  onClick,
  title,
  active,
  disabled,
  children
}: {
  onClick?: () => void
  title?: string
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
        active
          ? 'bg-blue-600/20 text-blue-300'
          : 'text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100'
      }`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function TabChip({ tab, active }: { tab: BrowserTab; active: boolean }): React.JSX.Element {
  return (
    <button
      className={`group flex h-7 min-w-0 max-w-[180px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${
        active
          ? 'border-blue-500/60 bg-blue-600/20 text-blue-100'
          : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600 hover:bg-neutral-700 hover:text-neutral-100'
      }`}
      onClick={() => void window.browserApi.activateTab(tab.id)}
      title={tab.title || tab.url}
    >
      {tab.loading ? (
        <Loader2 size={10} className="shrink-0 animate-spin opacity-70" />
      ) : tab.pinned ? (
        <Pin size={10} className="shrink-0 text-blue-400" />
      ) : (
        <Globe size={10} className="shrink-0 opacity-50" />
      )}
      <span className="min-w-0 flex-1 truncate">{tab.title || hostname(tab.url)}</span>
      <button
        className="ml-0.5 shrink-0 rounded p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-600"
        onClick={(e) => {
          e.stopPropagation()
          void window.browserApi.closeTab(tab.id)
        }}
        title="Cerrar pestaña"
      >
        <X size={10} />
      </button>
    </button>
  )
}

function SideTab({ tab, active }: { tab: BrowserTab; active: boolean }): React.JSX.Element {
  return (
    <button
      className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
        active
          ? 'bg-blue-600/20 text-blue-100'
          : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'
      }`}
      onClick={() => void window.browserApi.activateTab(tab.id)}
      title={tab.title || tab.url}
    >
      {tab.loading ? (
        <Loader2 size={11} className="shrink-0 animate-spin" />
      ) : tab.pinned ? (
        <Pin size={11} className="shrink-0 text-blue-400" />
      ) : (
        <Globe size={11} className="shrink-0 opacity-50" />
      )}
      <span className="min-w-0 flex-1 truncate">{tab.title || hostname(tab.url)}</span>
      <button
        className="shrink-0 rounded p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-700"
        onClick={(e) => {
          e.stopPropagation()
          void window.browserApi.closeTab(tab.id)
        }}
      >
        <X size={10} />
      </button>
    </button>
  )
}

function SettingsPanel({
  state,
  onClose
}: {
  state: BrowserState
  onClose: () => void
}): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-96 w-96 overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-100">Preferencias</h2>
          <button
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          {/* Layout */}
          <div>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Disposición de pestañas
            </p>
            <div className="flex gap-2">
              {(['horizontal', 'sidebar'] as TabLayout[]).map((l) => (
                <button
                  key={l}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs capitalize transition-colors ${
                    state.preferences.tabLayout === l
                      ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                      : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                  }`}
                  onClick={() => {
                    void window.browserApi.updatePreferences({ tabLayout: l })
                    onClose()
                  }}
                >
                  {l === 'horizontal' ? 'Horizontal' : 'Sidebar'}
                </button>
              ))}
            </div>
          </div>

          {/* Pin active tab */}
          <div>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Pestaña activa
            </p>
            <button
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-700"
              onClick={() => {
                if (state.activeTabId) {
                  const tab = state.tabs.find((t) => t.id === state.activeTabId)
                  if (tab) void window.browserApi.pinTab(state.activeTabId, !tab.pinned)
                }
                onClose()
              }}
            >
              {state.tabs.find((t) => t.id === state.activeTabId)?.pinned
                ? 'Desfijar pestaña'
                : 'Fijar pestaña'}
            </button>
          </div>

          {/* Onboarding reset */}
          <div>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Onboarding
            </p>
            <button
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-700"
              onClick={() => {
                void window.browserApi.updatePreferences({
                  onboardingCompleted: false,
                  welcomeDismissed: false
                })
                onClose()
              }}
            >
              Ver onboarding de nuevo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── main component ───────────────────────────────────────────────────────

function App(): React.JSX.Element {
  const { state, setState } = useBrowserStore()
  const [urlInput, setUrlInput] = useState('')
  const [bootError, setBootError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let off: (() => void) | undefined

    const init = async (): Promise<void> => {
      if (!window.browserApi) {
        setBootError('browserApi no disponible — verifica el preload.')
        return
      }

      const s = await window.browserApi.getState()
      setState(s)
      const active = s.tabs.find((t) => t.id === s.activeTabId)
      setUrlInput(active?.url ?? '')
      off = window.browserApi.onStateChanged((updated) => {
        setState(updated)
        const cur = updated.tabs.find((t) => t.id === updated.activeTabId)
        if (cur) setUrlInput(cur.url)
      })
    }

    init().catch((err: unknown) => {
      setBootError(String(err))
    })

    return () => off?.()
  }, [setState])

  // Hide web content when settings modal is open
  useEffect(() => {
    void window.browserApi.setContentVisible(!showSettings)
  }, [showSettings])

  // ── loading / error ──────────────────────────────────────────────────
  if (!state && !bootError) return <Splash />
  if (!state) return <ErrorScreen message={bootError ?? 'Error desconocido'} />

  // ── onboarding ───────────────────────────────────────────────────────
  if (!state.preferences.onboardingCompleted) {
    return (
      <Onboarding
        onChoose={(layout) => {
          void window.browserApi.updatePreferences({
            tabLayout: layout,
            onboardingCompleted: true
          })
        }}
      />
    )
  }

  // ── browser shell ────────────────────────────────────────────────────
  const isSidebar = state.preferences.tabLayout === 'sidebar'
  const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? null
  const pinnedTabs = state.tabs.filter((t) => t.pinned)
  const regularTabs = state.tabs.filter((t) => !t.pinned)

  const navigate = (e: React.FormEvent): void => {
    e.preventDefault()
    void window.browserApi.navigate(urlInput)
    urlRef.current?.blur()
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100 select-none">
      {/* ── nav bar — height: 48px ─────────────────────────────────── */}
      <div
        className="flex shrink-0 items-center gap-1 border-b border-neutral-800 bg-neutral-900 px-2"
        style={{ height: 48 }}
      >
        <NavBtn
          onClick={() => void window.browserApi.goBack()}
          title="Atrás (Alt+←)"
          disabled={!activeTab?.canGoBack}
        >
          <ArrowLeft size={15} />
        </NavBtn>
        <NavBtn
          onClick={() => void window.browserApi.goForward()}
          title="Adelante (Alt+→)"
          disabled={!activeTab?.canGoForward}
        >
          <ArrowRight size={15} />
        </NavBtn>
        <NavBtn onClick={() => void window.browserApi.reload()} title="Recargar (F5)">
          {activeTab?.loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RotateCw size={15} />
          )}
        </NavBtn>

        {/* URL bar */}
        <form onSubmit={navigate} className="mx-1.5 flex flex-1 items-center">
          <div className="relative flex w-full items-center">
            {activeTab && (
              <span className="pointer-events-none absolute left-3 text-neutral-500">
                {isSecure(activeTab.url) ? (
                  <Lock size={12} className="text-green-500" />
                ) : (
                  <Globe size={12} />
                )}
              </span>
            )}
            <input
              ref={urlRef}
              className="h-9 w-full rounded-full border border-neutral-700 bg-neutral-800 py-0 pl-8 pr-4 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-blue-500 focus:bg-neutral-900 focus:ring-1 focus:ring-blue-500/50"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="Buscar o escribir URL…"
              spellCheck={false}
            />
          </div>
        </form>

        <NavBtn onClick={() => void window.browserApi.createTab()} title="Nueva pestaña (Ctrl+T)">
          <Plus size={15} />
        </NavBtn>
        <NavBtn
          onClick={() =>
            void window.browserApi.updatePreferences({
              tabLayout: isSidebar ? 'horizontal' : 'sidebar'
            })
          }
          title={isSidebar ? 'Cambiar a horizontal' : 'Cambiar a sidebar'}
          active={isSidebar}
        >
          {isSidebar ? <Rows3 size={15} /> : <LayoutPanelLeft size={15} />}
        </NavBtn>
        <NavBtn
          onClick={() => setShowSettings((v) => !v)}
          title="Preferencias"
          active={showSettings}
        >
          <Settings2 size={15} />
        </NavBtn>
      </div>

      {/* ── horizontal tab strip — height: 40px (only when horizontal) */}
      {!isSidebar && (
        <div
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-neutral-800 bg-neutral-900 px-2 pb-1.5 pt-1"
          style={{ height: 40 }}
        >
          {state.tabs.map((tab) => (
            <TabChip key={tab.id} tab={tab} active={tab.id === state.activeTabId} />
          ))}
          <button
            className="flex h-6 shrink-0 items-center gap-1 rounded px-2 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            onClick={() => void window.browserApi.createTab()}
            title="Nueva pestaña"
          >
            <Plus size={12} />
          </button>
        </div>
      )}

      {/* ── content row (sidebar + content area) ──────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* sidebar — width: 224px (w-56) */}
        {isSidebar && (
          <aside className="flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-neutral-800 bg-neutral-900 p-2">
            {pinnedTabs.length > 0 && (
              <>
                <p className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                  Fijadas
                </p>
                {pinnedTabs.map((t) => (
                  <SideTab key={t.id} tab={t} active={t.id === state.activeTabId} />
                ))}
                <div className="mx-2 my-1.5 border-t border-neutral-800" />
              </>
            )}
            <p className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
              Pestañas
            </p>
            {regularTabs.map((t) => (
              <SideTab key={t.id} tab={t} active={t.id === state.activeTabId} />
            ))}
            <button
              className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
              onClick={() => void window.browserApi.createTab()}
            >
              <Plus size={12} /> Nueva pestaña
            </button>
          </aside>
        )}

        {/* WebContentsView fills this area — React renders nothing here */}
        <div className="flex-1 bg-neutral-950" />
      </div>

      {/* ── settings modal ─────────────────────────────────────────── */}
      {showSettings && <SettingsPanel state={state} onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
