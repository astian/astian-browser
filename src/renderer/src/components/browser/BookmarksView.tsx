import { useMemo, useState } from 'react'
import { Bookmark, Search, X } from 'lucide-react'
import type { BrowserState } from '@shared/ipc'

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function BookmarksView({
  state,
  onClose
}: {
  state: BrowserState
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return state.bookmarks
    const q = query.toLowerCase()
    return state.bookmarks.filter(
      (b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)
    )
  }, [state.bookmarks, query])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-3">
        <Bookmark size={18} className="text-blue-400" />
        <h1 className="flex-1 text-sm font-semibold">Marcadores</h1>
        <button
          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          onClick={onClose}
          title="Cerrar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-3">
        <div className="relative flex flex-1 items-center">
          <Search size={14} className="pointer-events-none absolute left-3 text-neutral-500" />
          <input
            autoFocus
            className="h-9 w-full rounded-lg border border-neutral-700 bg-neutral-800 pl-9 pr-4 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-blue-500"
            placeholder="Buscar marcadores…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-600/50 bg-blue-600/20 px-3 py-2 text-xs text-blue-300 hover:bg-blue-600/30"
          onClick={() => void window.browserApi.addBookmark()}
        >
          <Bookmark size={12} />
          Guardar actual
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
            <Bookmark size={36} className="mb-3 opacity-30" />
            <p className="text-sm">
              {query ? 'Sin resultados para esta búsqueda.' : 'No hay marcadores guardados.'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="group flex items-start gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800/50"
            >
              <button
                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                onClick={() => {
                  void window.browserApi.createTab(entry.url)
                  onClose()
                }}
              >
                <span className="w-full truncate text-sm font-medium text-neutral-100">
                  {entry.title || entry.url}
                </span>
                <span className="text-xs text-neutral-500">{hostname(entry.url)}</span>
                <span className="text-[10px] text-neutral-600">{formatDate(entry.createdAt)}</span>
              </button>
              <button
                className="mt-0.5 shrink-0 rounded p-1 opacity-0 text-neutral-500 transition-opacity group-hover:opacity-100 hover:bg-neutral-700 hover:text-red-400"
                onClick={() => void window.browserApi.removeBookmark(entry.id)}
                title="Eliminar marcador"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
