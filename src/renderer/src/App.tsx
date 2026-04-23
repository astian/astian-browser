import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  LayoutPanelLeft,
  Loader2,
  Lock,
  Moon,
  Pin,
  Plus,
  RotateCw,
  Rows3,
  Search,
  Settings2,
  ShieldAlert,
  Sun,
  X
} from 'lucide-react'
import type { BrowserState, BrowserTab, SearchEngine, TabLayout, Theme } from '@shared/ipc'
import { SEARCH_ENGINES } from '@shared/ipc'
import { CommandPalette } from '@renderer/components/browser/CommandPalette'
import { ToastContainer, Toast } from '@renderer/components/Toast'
import { useBrowserStore } from '@renderer/store/browser-store'
import { useUpdater, quitAndInstallUpdate } from '@renderer/lib/useUpdater'

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function isSecure(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('astian://')
}

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
      </div>
    </div>
  )
}

function ExternalSchemePrompt({
  url,
  onClose
}: {
  url: string
  onClose: () => void
}): React.JSX.Element {
  const confirm = async (): Promise<void> => {
    await window.browserApi.confirmExternalScheme(url)
    onClose()
  }

  return (
    <div className="theme-backdrop fixed inset-0 z-50 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            <h2 className="font-semibold text-neutral-100">Abrir enlace externo</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Este enlace intenta abrir una aplicación externa.
            </p>
          </div>
        </div>
        <div className="mb-5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2">
          <p className="break-all text-xs text-neutral-300">{url}</p>
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-600 hover:bg-neutral-700"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500"
            onClick={() => void confirm()}
          >
            Abrir
          </button>
        </div>
      </div>
    </div>
  )
}

interface OnboardingResult {
  layout: TabLayout
  searchEngine: SearchEngine
  theme: Theme
}

function Onboarding({
  onComplete
}: {
  onComplete: (result: OnboardingResult) => void
}): React.JSX.Element {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [layout, setLayout] = useState<TabLayout>('horizontal')
  const [searchEngine, setSearchEngine] = useState<SearchEngine>('astiango')
  const [theme, setTheme] = useState<Theme>('dark')

  return (
    <div
      className={`flex h-screen w-screen flex-col items-center justify-center ${
        theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-neutral-950 text-neutral-100'
      }`}
    >
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl font-bold shadow-xl shadow-blue-900/60">
          A
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {step === 0 && 'Bienvenido a Astian'}
          {step === 1 && 'Motor de búsqueda'}
          {step === 2 && 'Elige tu tema'}
        </h1>
      </div>

      <div className="mb-8 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === step
                ? 'w-6 bg-blue-500'
                : i < step
                  ? 'w-3 bg-blue-500/40'
                  : 'w-3 bg-neutral-700'
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="grid w-full max-w-md grid-cols-2 gap-4 px-6">
          {(['horizontal', 'sidebar'] as TabLayout[]).map((l) => (
            <button
              key={l}
              className={`rounded-2xl border p-6 transition-all ${
                layout === l
                  ? 'border-blue-500 bg-blue-600/20 text-blue-100'
                  : theme === 'light'
                    ? 'border-slate-300 bg-white text-slate-700 hover:border-blue-500 hover:bg-blue-50'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-blue-500 hover:bg-blue-600/10'
              }`}
              onClick={() => setLayout(l)}
            >
              <div className="mb-3 flex justify-center">
                {l === 'horizontal' ? <Rows3 size={30} /> : <LayoutPanelLeft size={30} />}
              </div>
              <p className="text-sm font-medium">{l === 'horizontal' ? 'Horizontal' : 'Sidebar'}</p>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="flex w-full max-w-md flex-col gap-2.5 px-6">
          {(Object.keys(SEARCH_ENGINES) as SearchEngine[]).map((key) => (
            <button
              key={key}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                searchEngine === key
                  ? 'border-blue-500 bg-blue-600/20 text-blue-100'
                  : theme === 'light'
                    ? 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800'
              }`}
              onClick={() => setSearchEngine(key)}
            >
              <Search
                size={16}
                className={searchEngine === key ? 'text-blue-400' : 'text-neutral-500'}
              />
              <span className="flex-1 font-medium">{SEARCH_ENGINES[key].name}</span>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="grid w-full max-w-md grid-cols-2 gap-4 px-6">
          {(['dark', 'light'] as Theme[]).map((t) => (
            <button
              key={t}
              className={`rounded-2xl border p-6 transition-all ${
                theme === t
                  ? 'border-blue-500 bg-blue-600/20 text-blue-100'
                  : theme === 'light'
                    ? 'border-slate-300 bg-white text-slate-700 hover:border-blue-500 hover:bg-blue-50'
                    : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-blue-500 hover:bg-blue-600/10'
              }`}
              onClick={() => setTheme(t)}
            >
              <div className="mb-3 flex justify-center">
                {t === 'dark' ? <Moon size={30} /> : <Sun size={30} />}
              </div>
              <p className="text-sm font-medium">{t === 'dark' ? 'Oscuro' : 'Claro'}</p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        {step > 0 && (
          <button
            className={`rounded-lg border px-5 py-2.5 text-sm ${
              theme === 'light'
                ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
            }`}
            onClick={() => setStep((s) => (s - 1) as 0 | 1 | 2)}
          >
            Atrás
          </button>
        )}
        <button
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
          onClick={() => {
            if (step < 2) setStep((s) => (s + 1) as 1 | 2)
            else onComplete({ layout, searchEngine, theme })
          }}
        >
          {step < 2 ? 'Siguiente' : 'Empezar'}
        </button>
      </div>
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
  const prefs = state.preferences

  return (
    <div
      className="theme-backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-[420px] overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl"
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

        <div className="space-y-5 text-sm">
          <div>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Tema
            </p>
            <div className="flex gap-2">
              {(['dark', 'light'] as Theme[]).map((t) => (
                <button
                  key={t}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                    prefs.theme === t
                      ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                      : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                  }`}
                  onClick={() => void window.browserApi.updatePreferences({ theme: t })}
                >
                  {t === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
                  {t === 'dark' ? 'Oscuro' : 'Claro'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Motor de búsqueda
            </p>
            <div className="flex flex-col gap-1.5">
              {(Object.keys(SEARCH_ENGINES) as SearchEngine[]).map((key) => (
                <button
                  key={key}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    prefs.searchEngine === key
                      ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                      : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                  }`}
                  onClick={() => void window.browserApi.updatePreferences({ searchEngine: key })}
                >
                  <Search size={12} className="shrink-0 opacity-60" />
                  <span className="flex-1">{SEARCH_ENGINES[key].name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Disposición
            </p>
            <div className="flex gap-2">
              {(['horizontal', 'sidebar'] as TabLayout[]).map((l) => (
                <button
                  key={l}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs capitalize transition-colors ${
                    prefs.tabLayout === l
                      ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                      : 'border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600'
                  }`}
                  onClick={() => void window.browserApi.updatePreferences({ tabLayout: l })}
                >
                  {l === 'horizontal' ? 'Horizontal' : 'Sidebar'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Adblock
            </p>
            <button
              className={`w-full rounded-lg border px-3 py-2 text-xs ${
                prefs.adblockEnabled
                  ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-300'
              }`}
              onClick={() =>
                void window.browserApi.updatePreferences({ adblockEnabled: !prefs.adblockEnabled })
              }
            >
              {prefs.adblockEnabled ? 'Activado' : 'Desactivado'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  const { state, setState } = useBrowserStore()
  const [urlInput, setUrlInput] = useState('')
  const [bootError, setBootError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [externalUrl, setExternalUrl] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const urlRef = useRef<HTMLInputElement>(null)

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { ...toast, id, duration: toast.duration ?? 5000 }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Set up updater listeners
  useUpdater({
    onCheckingForUpdate: () => {
      console.log('[UI] Checking for updates...')
    },
    onUpdateAvailable: (version) => {
      addToast({
        type: 'info',
        title: 'Actualización disponible',
        message: `Astian ${version} está disponible.`
      })
    },
    onUpdateNotAvailable: () => {
      console.log('[UI] App is up to date')
    },
    onDownloadProgress: (percent) => {
      // Could update a global progress state if needed
      console.log(`[UI] Download progress: ${percent.toFixed(0)}%`)
    },
    onUpdateDownloaded: (version) => {
      addToast({
        type: 'success',
        title: 'Actualización lista',
        message: `Astian ${version} está lista para instalar.`,
        action: {
          label: 'Reiniciar ahora',
          onClick: () => void quitAndInstallUpdate()
        }
      })
    },
    onError: (message) => {
      addToast({
        type: 'error',
        title: 'Error en actualización',
        message
      })
    }
  })

  useEffect(() => {
    let offState: (() => void) | undefined
    let offScheme: (() => void) | undefined

    const init = async (): Promise<void> => {
      const s = await window.browserApi.getState()
      setState(s)
      const active = s.tabs.find((t) => t.id === s.activeTabId)
      setUrlInput(active?.url ?? '')

      offState = window.browserApi.onStateChanged((updated) => {
        setState(updated)
        const cur = updated.tabs.find((t) => t.id === updated.activeTabId)
        if (cur) setUrlInput(cur.url)
      })

      offScheme = window.browserApi.onExternalScheme(({ url }) => setExternalUrl(url))
    }

    init().catch((err: unknown) => setBootError(String(err)))

    return () => {
      offState?.()
      offScheme?.()
    }
  }, [setState])

  useEffect(() => {
    void window.browserApi?.setContentVisible(!showSettings && !showPalette && !externalUrl)
  }, [showSettings, showPalette, externalUrl])

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key === 'k') {
      e.preventDefault()
      setShowPalette((v) => !v)
    }
    if (mod && e.key === 't') {
      e.preventDefault()
      void window.browserApi.createTab()
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  useEffect(() => {
    if (!state) return
    const root = document.documentElement
    root.classList.toggle('dark', state.preferences.theme === 'dark')
    root.classList.toggle('light', state.preferences.theme === 'light')
  }, [state?.preferences.theme])

  if (!state && !bootError) return <Splash />
  if (!state) return <ErrorScreen message={bootError ?? 'Error desconocido'} />

  if (!state.preferences.onboardingCompleted) {
    return (
      <Onboarding
        onComplete={({ layout, searchEngine, theme }) => {
          void window.browserApi.updatePreferences({
            tabLayout: layout,
            searchEngine,
            theme,
            onboardingCompleted: true
          })
        }}
      />
    )
  }

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
      <div
        className="flex shrink-0 items-center gap-1 border-b border-neutral-800 bg-neutral-900 px-2"
        style={{ height: 48 }}
      >
        <NavBtn
          onClick={() => void window.browserApi.goBack()}
          title="Atrás"
          disabled={!activeTab?.canGoBack}
        >
          <ArrowLeft size={15} />
        </NavBtn>
        <NavBtn
          onClick={() => void window.browserApi.goForward()}
          title="Adelante"
          disabled={!activeTab?.canGoForward}
        >
          <ArrowRight size={15} />
        </NavBtn>
        <NavBtn onClick={() => void window.browserApi.reload()} title="Recargar">
          {activeTab?.loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RotateCw size={15} />
          )}
        </NavBtn>

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
              className="h-9 w-full rounded-full border border-neutral-700 bg-neutral-800 py-0 pl-8 pr-4 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-blue-500"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="Buscar o escribir URL…"
              spellCheck={false}
            />
          </div>
        </form>

        <NavBtn onClick={() => void window.browserApi.createTab()} title="Nueva pestaña">
          <Plus size={15} />
        </NavBtn>
        <NavBtn
          onClick={() => setShowSettings((v) => !v)}
          title="Preferencias"
          active={showSettings}
        >
          <Settings2 size={15} />
        </NavBtn>
      </div>

      {!isSidebar && (
        <div
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-neutral-800 bg-neutral-900 px-2 pb-1.5 pt-1"
          style={{ height: 40 }}
        >
          {state.tabs.map((tab) => (
            <TabChip key={tab.id} tab={tab} active={tab.id === state.activeTabId} />
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
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
              className="mt-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-100"
              onClick={() => void window.browserApi.createTab()}
            >
              <Plus size={12} /> Nueva pestaña
            </button>
          </aside>
        )}
        <div className="flex-1 bg-neutral-950" />
      </div>

      {showSettings && <SettingsPanel state={state} onClose={() => setShowSettings(false)} />}
      {showPalette && (
        <CommandPalette
          state={state}
          onClose={() => setShowPalette(false)}
          onOpenSettings={() => {
            setShowSettings(true)
            setShowPalette(false)
          }}
        />
      )}
      {externalUrl && (
        <ExternalSchemePrompt url={externalUrl} onClose={() => setExternalUrl(null)} />
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  )
}

export default App
