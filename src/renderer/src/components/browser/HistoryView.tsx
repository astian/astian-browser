import { useMemo, useState } from 'react'
import { History, Search, Trash2, X } from 'lucide-react'
import type { BrowserState, HistoryEntry } from '@shared/ipc'

type DateFilter = 'all' | 'today' | 'week' | 'month'

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  if (isToday) return 'Hoy'
  if (isYesterday) return 'Ayer'
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(entries: HistoryEntry[]): Array<{ label: string; entries: HistoryEntry[] }> {
  const groups = new Map<string, HistoryEntry[]>()
  for (const entry of entries) {
    const label = formatDate(entry.visitedAt)
    const group = groups.get(label)
    if (group) {
      group.push(entry)
    } else {
      groups.set(label, [entry])
    }
  }
  return Array.from(groups.entries()).map(([label, entries]) => ({ label, entries }))
}

function filterByDate(entries: HistoryEntry[], filter: DateFilter): HistoryEntry[] {
  if (filter === 'all') return entries
  const now = Date.now()
  const msInDay = 86_400_000
  const cutoffs: Record<DateFilter, number> = {
    today: now - msInDay,
    week: now - 7 * msInDay,
    month: now - 30 * msInDay,
    all: 0
  }
  return entries.filter((e) => e.visitedAt >= cutoffs[filter])
}

export function HistoryView({
  state,
  onClose
}: {
  state: BrowserState
  onClose: () => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  const filtered = useMemo(() => {
    let result = state.history
    result = filterByDate(result, dateFilter)
    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(
        (e) => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q)
      )
    }
    return result
  }, [state.history, query, dateFilter])

  const groups = useMemo(() => groupByDate(filtered), [filtered])

  const DATE_FILTERS: Array<{ value: DateFilter; label: string }> = [
    { value: 'all', label: 'Todo' },
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mes' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-3">
        <History size={18} className="text-blue-400" />
        <h1 className="flex-1 text-sm font-semibold">Historial</h1>
        <button
          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          onClick={onClose}
          title="Cerrar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Controls */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-neutral-800 bg-neutral-900 px-4 py-3">
        <div className="relative flex items-center">
          <Search size={14} className="pointer-events-none absolute left-3 text-neutral-500" />
          <input
            autoFocus
            className="h-9 w-full rounded-lg border border-neutral-700 bg-neutral-800 pl-9 pr-4 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-blue-500"
            placeholder="Buscar en historial…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Filtrar:</span>
          {DATE_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                dateFilter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'border border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
              }`}
              onClick={() => setDateFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          {state.history.length > 0 && (
            <button
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-300"
              onClick={() => void window.browserApi.clearHistory()}
            >
              <Trash2 size={12} />
              Borrar todo
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
            <History size={36} className="mb-3 opacity-30" />
            <p className="text-sm">
              {query || dateFilter !== 'all' ? 'Sin resultados para esta búsqueda.' : 'Todavía no hay historial.'}
            </p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-800"
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    onClick={() => {
                      void window.browserApi.createTab(entry.url)
                      onClose()
                    }}
                  >
                    <History size={13} className="shrink-0 text-neutral-600" />
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">
                      {entry.title || entry.url}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">{hostname(entry.url)}</span>
                    <span className="shrink-0 text-xs text-neutral-600">{formatTime(entry.visitedAt)}</span>
                  </button>
                  <button
                    className="shrink-0 rounded p-1 opacity-0 text-neutral-500 transition-opacity group-hover:opacity-100 hover:bg-neutral-700 hover:text-red-400"
                    onClick={() => void window.browserApi.deleteHistoryEntry(entry.id)}
                    title="Eliminar entrada"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
