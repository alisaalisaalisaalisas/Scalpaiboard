import { useEffect, useMemo, useState } from 'react'

import { useTerminalMarketStore } from '../../store/terminalMarketStore'
import { useTerminalChartStore, getLayoutSize, getChartIdForIndex } from '../../store/terminalChartStore'

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || (el as any).isContentEditable
}

const isSearchChar = (key: string) => {
  return /^[a-z0-9]$/i.test(key)
}

const match = (s: string, q: string) => s.toLowerCase().includes(q.toLowerCase())

const parseTileIndex = (chartId: string) => {
  const m = /tile-(\d+)/.exec(chartId)
  if (!m) return 0
  return Number.parseInt(m[1], 10) || 0
}

export default function KeyboardSearchOverlay() {
  const markets = useTerminalMarketStore((s) => s.markets)
  const fetchAll = useTerminalMarketStore((s) => s.fetchAll)

  const layout = useTerminalChartStore((s) => s.layout)
  const selectedChartId = useTerminalChartStore((s) => s.selectedChartId)
  const setChartMarket = useTerminalChartStore((s) => s.setChartMarket)
  const openFocusMarket = useTerminalChartStore((s) => s.openFocusMarket)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (open && markets.length === 0) void fetchAll()
  }, [fetchAll, markets.length, open])

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return []

    return markets
      .filter((m) => {
        return (
          match(m.symbol, q) ||
          match(m.base || '', q) ||
          match(m.exchangeTag || '', q) ||
          match(m.contractTag || '', q) ||
          match(m.marketType || '', q)
        )
      })
      .slice(0, 80)
  }, [markets, query])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return

      if (!open) {
        if (e.ctrlKey && e.key.toLowerCase() === 'k') {
          e.preventDefault()
          setOpen(true)
          setQuery('')
          setIdx(0)
          return
        }

        if (!e.ctrlKey && !e.metaKey && !e.altKey && isSearchChar(e.key)) {
          setOpen(true)
          setQuery(e.key)
          setIdx(0)
          return
        }

        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIdx((v) => Math.min(results.length - 1, v + 1))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIdx((v) => Math.max(0, v - 1))
        return
      }

      if (e.key === 'Backspace') {
        e.preventDefault()
        setQuery((q) => q.slice(0, -1))
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const picked = results[idx]
        if (!picked) return

        // Ctrl+Enter: open in next tile. Enter: replace selected tile.
        const { size } = getLayoutSize(layout)
        const selectedIdx = parseTileIndex(selectedChartId)
        const targetIdx = e.ctrlKey ? (selectedIdx + 1) % size : selectedIdx
        const targetChartId = getChartIdForIndex(targetIdx)

        if (e.shiftKey) {
          // Shift+Enter: open focus mode.
          openFocusMarket(picked.marketId)
        } else {
          setChartMarket(targetChartId, picked)
        }

        setOpen(false)
        return
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && isSearchChar(e.key)) {
        setQuery((q) => q + e.key)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [idx, layout, open, openFocusMarket, results, selectedChartId, setChartMarket])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24">
      <div className="w-full max-w-2xl bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-dark-700">
          <div className="text-xs text-dark-400">Type to search • Enter replace • Ctrl+Enter next tile • Shift+Enter focus</div>
          <div className="mt-2">
            <input
              autoFocus
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setIdx(0)
              }}
              placeholder="BTC, SUI, SOL, BI-F…"
            />
          </div>
        </div>

        <div className="max-h-[420px] overflow-auto">
          {results.length === 0 ? (
            <div className="p-6 text-sm text-dark-400">No results</div>
          ) : (
            <div className="divide-y divide-dark-800">
              {results.map((m, i) => (
                <button
                  key={m.marketId}
                  type="button"
                  className={`w-full text-left px-4 py-3 hover:bg-dark-800/60 transition-colors ${i === idx ? 'bg-dark-800/60' : ''}`}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => {
                    setChartMarket(selectedChartId, m)
                    setOpen(false)
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{m.symbol}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-dark-300">
                        <span className="px-1.5 py-0.5 rounded bg-dark-800 border border-dark-700">{m.exchangeTag}</span>
                        <span className="px-1.5 py-0.5 rounded bg-dark-800 border border-dark-700">{m.contractTag}</span>
                        <span className="text-dark-500">{m.marketType}</span>
                      </div>
                    </div>
                    <div className="text-xs text-dark-400">{m.marketId}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
