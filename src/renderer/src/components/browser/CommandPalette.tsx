import { useEffect, useRef, useState, useCallback } from 'react'
import Fuse from 'fuse.js'
import {
  Plus,
  Settings2,
  Globe,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Pin,
  X,
  Search,
  History,
  Bookmark,
  LayoutPanelLeft,
  Rows3,
  Sun,
  Moon
} from 'lucide-react'
import type { BrowserState } from '@shared/ipc'

interface PaletteAction {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  run: () => void | Promise<void>
}

interface Props {
  state: BrowserState
  onClose: () => void
  onOpenSettings: () => void
}

function buildActions(
  state: BrowserState,
  onClose: () => void,
  onOpenSettings: () => void
): PaletteAction[] {
  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)
  const isSidebar = state.preferences.tabLayout === 'sidebar'
  const isDark = state.preferences.theme === 'dark'

  const actions: PaletteAction[] = [
    {
      id: 'new-tab',
      label: 'Nueva pestaña',
      icon: <Plus size={14} />,
      run: async () => {
        await window.browserApi.createTab()
        onClose()
      }
    },
    {
      id: 'close-tab',
      label: 'Cerrar pestaña actual',
      description: activeTab?.title ?? activeTab?.url,
      icon: <X size={14} />,
      run: async () => {
        if (state.activeTabId) await window.browserApi.closeTab(state.activeTabId)
        onClose()
      }
    },
    {
      id: 'go-back',
      label: 'Ir atrás',
      icon: <ArrowLeft size={14} />,
      run: async () => {
        await window.browserApi.goBack()
        onClose()
      }
    },
    {
      id: 'go-forward',
      label: 'Ir adelante',
      icon: <ArrowRight size={14} />,
      run: async () => {
        await window.browserApi.goForward()
        onClose()
      }
    },
    {
      id: 'reload',
      label: 'Recargar página',
      icon: <RotateCw size={14} />,
      run: async () => {
        await window.browserApi.reload()
        onClose()
      }
    },
    {
      id: 'toggle-layout',
      label: isSidebar ? 'Cambiar a pestañas horizontales' : 'Cambiar a sidebar',
      icon: isSidebar ? <Rows3 size={14} /> : <LayoutPanelLeft size={14} />,
      run: async () => {
        await window.browserApi.updatePreferences({
          tabLayout: isSidebar ? 'horizontal' : 'sidebar'
        })
        onClose()
      }
    },
    {
      id: 'toggle-theme',
      label: isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
      icon: isDark ? <Sun size={14} /> : <Moon size={14} />,
      run: async () => {
        await window.browserApi.updatePreferences({ theme: isDark ? 'light' : 'dark' })
        onClose()
      }
    },
    {
      id: 'open-settings',
      label: 'Abrir preferencias',
      icon: <Settings2 size={14} />,
      run: () => {
        onOpenSettings()
        onClose()
      }
    },
    {
      id: 'navigate-newtab',
      label: 'Nueva pestaña (AstianGO)',
      icon: <Globe size={14} />,
      run: async () => {
        await window.browserApi.navigate('astian://newtab')
        onClose()
      }
    },
    {
      id: 'navigate-history',
      label: 'Ver historial',
      description: 'astian://history',
      icon: <History size={14} />,
      run: async () => {
        await window.browserApi.createTab('astian://history')
        onClose()
      }
    },
    {
      id: 'navigate-bookmarks',
      label: 'Ver marcadores',
      icon: <Bookmark size={14} />,
      run: async () => {
        await window.browserApi.createTab('https://astiango.com')
        onClose()
      }
    }
  ]

  // Add open tabs as actions
  for (const tab of state.tabs) {
    if (tab.id === state.activeTabId) continue
    actions.push({
      id: `switch-tab-${tab.id}`,
      label: `Ir a: ${tab.title || tab.url}`,
      description: tab.url,
      icon: <Pin size={14} className={tab.pinned ? 'text-blue-400' : 'opacity-40'} />,
      run: async () => {
        await window.browserApi.activateTab(tab.id)
        onClose()
      }
    })
  }

  return actions
}

export function CommandPalette({ state, onClose, onOpenSettings }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const allActions = buildActions(state, onClose, onOpenSettings)

  const fuse = new Fuse(allActions, {
    keys: ['label', 'description'],
    threshold: 0.4,
    includeScore: true
  })

  const results = query.trim() ? fuse.search(query).map((r) => r.item) : allActions

  const runSelected = useCallback(
    (idx: number) => {
      const action = results[idx]
      if (action) void action.run()
    },
    [results]
  )

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runSelected(selected)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-transparent pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <Search size={16} className="shrink-0 text-neutral-500" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-500 outline-none"
            placeholder="Buscar acciones o escribir URL…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">Sin resultados</p>
          )}
          {results.map((action, idx) => (
            <button
              key={action.id}
              data-idx={idx}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                idx === selected
                  ? 'bg-blue-600/20 text-blue-100'
                  : 'text-neutral-300 hover:bg-neutral-800'
              }`}
              onClick={() => runSelected(idx)}
              onMouseEnter={() => setSelected(idx)}
            >
              <span className="shrink-0 text-neutral-400">{action.icon}</span>
              <span className="flex-1 truncate">{action.label}</span>
              {action.description && (
                <span className="ml-2 max-w-[200px] truncate text-xs text-neutral-500">
                  {action.description}
                </span>
              )}
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="border-t border-neutral-800 px-4 py-2 text-[10px] text-neutral-600">
            ↑↓ navegar · Enter seleccionar · Esc cerrar
          </div>
        )}
      </div>
    </div>
  )
}
