import { useEffect, useState } from 'react'
import {
  Globe,
  Pin,
  PinOff,
  Plus,
  Settings2,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Menu,
  Sparkles,
  X,
  LayoutPanelLeft,
  Rows3
} from 'lucide-react'
import type { BrowserTab, TabLayout } from '@shared/ipc'
import { Button } from '@renderer/components/ui/button'
import { useBrowserStore } from '@renderer/store/browser-store'

function App(): React.JSX.Element {
  const { state, setState } = useBrowserStore()
  const [urlInput, setUrlInput] = useState('')
  const [showPreferences, setShowPreferences] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const boot = async (): Promise<void> => {
      if (!window.browserApi) {
        setBootError('No se pudo conectar con el proceso principal.')
        return
      }

      try {
        const initial = await Promise.race([
          window.browserApi.getState(),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new Error('Timeout iniciando browserApi.getState()'))
            }, 3500)
          })
        ])

        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        setState(initial)

        const active = initial.tabs.find((tab) => tab.id === initial.activeTabId)
        setUrlInput(active?.url ?? '')

        unsubscribe = window.browserApi.onStateChanged((updated) => {
          setState(updated)
          const current = updated.tabs.find((tab) => tab.id === updated.activeTabId)
          if (current) setUrlInput(current.url)
        })
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        setBootError(error instanceof Error ? error.message : 'Fallo inesperado al iniciar la UI.')
      }
    }

    void boot()

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      unsubscribe?.()
    }
  }, [setState])

  const activeTab = state?.tabs.find((tab) => tab.id === state.activeTabId) ?? null

  const pinnedTabs = state?.tabs.filter((tab) => tab.pinned) ?? []
  const regularTabs = state?.tabs.filter((tab) => !tab.pinned) ?? []

  if (!state && !bootError) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-slate-200">
        <div className="fixed left-3 top-3 z-[120] rounded-md border border-cyan-500/40 bg-slate-900/95 px-3 py-2 text-xs shadow-lg">
          Iniciando Astian Browser...
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="h-screen w-screen bg-slate-950 p-6 text-slate-100">
        <div className="fixed left-3 top-3 z-[120] max-w-lg rounded-md border border-rose-700/70 bg-rose-950/70 px-3 py-2 text-xs shadow-lg">
          <p className="font-semibold text-rose-200">Error de inicio UI</p>
          <p className="mt-1 text-rose-100">{bootError ?? 'No se pudo cargar la interfaz.'}</p>
          <p className="mt-1 text-rose-200/80">Reinicia con bun run dev</p>
        </div>
      </div>
    )
  }

  const handleNavigate = (event: React.FormEvent): void => {
    event.preventDefault()
    void window.browserApi.navigate(urlInput)
  }

  const chooseLayout = (tabLayout: TabLayout): void => {
    void window.browserApi.updatePreferences({ tabLayout, onboardingCompleted: true })
  }

  const showSidebar = state.preferences.sidebarVisible && state.preferences.tabLayout === 'sidebar'

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {!state.preferences.onboardingCompleted && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/90 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">
              Smart Onboarding
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Elige tu estilo de navegacion</h1>
            <p className="mt-2 text-slate-400">
              Bienvenido a Astian. Aqui eliges tabs horizontales o verticales y puedes cambiarlo en
              preferencias cuando quieras.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                className="rounded-xl border border-cyan-400 bg-cyan-400/10 p-4 text-left hover:bg-cyan-400/20"
                onClick={() => chooseLayout('horizontal')}
              >
                <p className="font-semibold">Pestanas horizontales</p>
                <p className="mt-1 text-sm text-slate-300">Clasico, rapido y familiar.</p>
              </button>
              <button
                className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-left hover:bg-slate-700"
                onClick={() => chooseLayout('sidebar')}
              >
                <p className="font-semibold">Sidebar primero</p>
                <p className="mt-1 text-sm text-slate-300">Estilo productivo tipo Arc/Zen.</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {!state.preferences.welcomeDismissed && state.preferences.onboardingCompleted && (
        <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-3">
          <div className="flex w-full max-w-3xl items-center gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 backdrop-blur">
            <Sparkles size={18} className="text-cyan-300" />
            <p className="text-sm text-cyan-100">
              Bienvenido a Astian Browser MVP. Ya tienes tabs, menu, onboarding y layouts
              personalizables.
            </p>
            <button
              className="ml-auto rounded p-1 hover:bg-cyan-400/20"
              onClick={() => void window.browserApi.updatePreferences({ welcomeDismissed: true })}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <header className="fixed inset-x-0 top-0 z-30 border-b border-slate-800 bg-slate-900/95 px-3 py-2 backdrop-blur">
        {state.preferences.tabLayout === 'horizontal' && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {state.tabs.map((tab) => (
              <button
                key={tab.id}
                className={`group flex max-w-56 items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                  tab.id === state.activeTabId
                    ? 'border-cyan-400 bg-cyan-400/15 text-cyan-100'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
                onClick={() => void window.browserApi.activateTab(tab.id)}
              >
                {tab.pinned ? <Pin size={14} className="text-cyan-300" /> : <Globe size={14} />}
                <span className="truncate">{tab.title || tab.url}</span>
                <span
                  className="ml-auto rounded p-0.5 opacity-0 transition group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation()
                    void window.browserApi.closeTab(tab.id)
                  }}
                >
                  x
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => void window.browserApi.goBack()}>
            <ArrowLeft size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => void window.browserApi.goForward()}>
            <ArrowRight size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => void window.browserApi.reload()}>
            <RotateCw size={16} />
          </Button>

          <form className="flex-1" onSubmit={handleNavigate}>
            <input
              className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm outline-none ring-cyan-300 focus:ring"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              placeholder="Buscar o escribir URL"
            />
          </form>

          <Button variant="ghost" size="icon" onClick={() => void window.browserApi.createTab()}>
            <Plus size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowMenu((value) => !value)}>
            <Menu size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowPreferences((value) => !value)}>
            <Settings2 size={16} />
          </Button>
        </div>
      </header>

      {showMenu && (
        <section className="fixed right-[98px] top-[64px] z-40 w-72 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-slate-800"
            onClick={() => void window.browserApi.createTab()}
          >
            <Plus size={14} /> Nueva pestaña
          </button>
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-slate-800"
            onClick={() =>
              void window.browserApi.updatePreferences({
                tabLayout: state.preferences.tabLayout === 'horizontal' ? 'sidebar' : 'horizontal'
              })
            }
          >
            {state.preferences.tabLayout === 'horizontal' ? (
              <LayoutPanelLeft size={14} />
            ) : (
              <Rows3 size={14} />
            )}
            Cambiar layout
          </button>
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-slate-800"
            onClick={() =>
              void window.browserApi.updatePreferences({
                sidebarVisible: !state.preferences.sidebarVisible
              })
            }
          >
            <Globe size={14} /> Toggle sidebar
          </button>
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm hover:bg-slate-800"
            onClick={() => void window.browserApi.updatePreferences({ welcomeDismissed: false })}
          >
            <Sparkles size={14} /> Mostrar bienvenida
          </button>
        </section>
      )}

      {showSidebar && (
        <aside className="fixed bottom-0 left-0 top-[74px] z-20 w-[290px] border-r border-slate-800 bg-slate-950/95 p-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pinned
            </p>
            <div className="space-y-1">
              {pinnedTabs.map((tab) => (
                <SidebarTab key={tab.id} tab={tab} active={tab.id === state.activeTabId} />
              ))}
              {pinnedTabs.length === 0 && (
                <p className="text-xs text-slate-500">Sin pestañas fijadas</p>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-slate-800 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tabs
            </p>
            <div className="space-y-1">
              {regularTabs.map((tab) => (
                <SidebarTab key={tab.id} tab={tab} active={tab.id === state.activeTabId} />
              ))}
            </div>
          </div>
        </aside>
      )}

      {showPreferences && (
        <section className="fixed right-4 top-[118px] z-40 w-80 rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl">
          <p className="text-sm font-semibold">Preferencias</p>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="mb-1 text-slate-300">Disposicion de pestañas</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={state.preferences.tabLayout === 'horizontal' ? 'default' : 'outline'}
                  onClick={() =>
                    void window.browserApi.updatePreferences({ tabLayout: 'horizontal' })
                  }
                >
                  Horizontal
                </Button>
                <Button
                  size="sm"
                  variant={state.preferences.tabLayout === 'sidebar' ? 'default' : 'outline'}
                  onClick={() => void window.browserApi.updatePreferences({ tabLayout: 'sidebar' })}
                >
                  Sidebar
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-1 text-slate-300">Panel lateral</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void window.browserApi.updatePreferences({
                    sidebarVisible: !state.preferences.sidebarVisible
                  })
                }
              >
                {state.preferences.sidebarVisible ? 'Ocultar sidebar' : 'Mostrar sidebar'}
              </Button>
            </div>

            <div>
              <p className="mb-1 text-slate-300">Onboarding</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void window.browserApi.updatePreferences({
                    onboardingCompleted: false,
                    welcomeDismissed: false
                  })
                }
              >
                Reiniciar onboarding
              </Button>
            </div>
          </div>
        </section>
      )}

      <footer className="fixed bottom-0 left-0 right-0 z-20 h-6 border-t border-slate-800 bg-slate-950 px-3 text-xs text-slate-400">
        <div className="flex h-full items-center justify-between">
          <span>
            {activeTab?.loading ? 'Cargando...' : (activeTab?.url ?? 'Sin pestaña activa')}
          </span>
          <span>
            {state.preferences.tabLayout === 'horizontal' ? 'Tabs horizontales' : 'Tabs verticales'}
          </span>
        </div>
      </footer>
    </div>
  )
}

function SidebarTab({ tab, active }: { tab: BrowserTab; active: boolean }): React.JSX.Element {
  return (
    <button
      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm ${
        active
          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
          : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
      }`}
      onClick={() => void window.browserApi.activateTab(tab.id)}
    >
      <Globe size={14} className="shrink-0" />
      <span className="truncate">{tab.title || tab.url}</span>
      <span className="ml-auto flex items-center gap-1">
        <button
          className="rounded p-1 hover:bg-slate-700"
          onClick={(event) => {
            event.stopPropagation()
            void window.browserApi.pinTab(tab.id, !tab.pinned)
          }}
          aria-label={tab.pinned ? 'Desfijar tab' : 'Fijar tab'}
        >
          {tab.pinned ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
        <button
          className="rounded p-1 hover:bg-slate-700"
          onClick={(event) => {
            event.stopPropagation()
            void window.browserApi.closeTab(tab.id)
          }}
          aria-label="Cerrar tab"
        >
          x
        </button>
      </span>
    </button>
  )
}

export default App
