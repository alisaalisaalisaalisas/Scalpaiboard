import { useEffect, useMemo, useRef, useState } from 'react'

import type { MarketItem } from '../../types'
import { useTerminalMarketStore } from '../../store/terminalMarketStore'
import { useWatchlistStore } from '../../store/watchlistStore'
import { useMarketMetricsStore } from '../../store/marketMetricsStore'
import { useTerminalChartStore, getLayoutSize, getChartIdForIndex } from '../../store/terminalChartStore'
import { useTerminalTickerStore } from '../../store/terminalTickerStore'

import TerminalChartTile from './TerminalChartTile'

const gridColsClass = (cols: number) => {
  // Tailwind can't generate dynamic classes reliably; use inline gridTemplateColumns.
  return cols
}

const matchQuery = (m: MarketItem, q: string) => {
  const s = `${m.symbol} ${m.base} ${m.exchangeTag} ${m.contractTag} ${m.marketType}`.toLowerCase()
  return s.includes(q)
}

export default function TerminalChartGrid() {
  const { markets, loading, error, filters, sortKey, sortDir, watchlistOnly, fetchAll } = useTerminalMarketStore()

  const { layout, page } = useTerminalChartStore()
  const applyMarketsToGrid = useTerminalChartStore((s) => s.applyMarketsToGrid)
  const selectedChartId = useTerminalChartStore((s) => s.selectedChartId)
  const setSelectedChartId = useTerminalChartStore((s) => s.setSelectedChartId)
  const openFocusFromTile = useTerminalChartStore((s) => s.openFocusFromTile)

  const watchlist = useWatchlistStore((s) => s.marketIds)

  const ensureManyMetrics = useMarketMetricsStore((s) => s.ensureMany)
  const getMetric = useMarketMetricsStore((s) => s.get)

  const connect = useTerminalTickerStore((s) => s.connect)
  const connected = useTerminalTickerStore((s) => s.connected)
  const subscribe = useTerminalTickerStore((s) => s.subscribe)
  const unsubscribe = useTerminalTickerStore((s) => s.unsubscribe)

  const { cols, rows, size } = getLayoutSize(layout)

  useEffect(() => {
    if (markets.length === 0 && !loading) {
      void fetchAll()
    }
  }, [fetchAll, loading, markets.length])

  const filtered = useMemo(() => {
    let list = markets

    if (watchlistOnly) {
      const set = new Set(watchlist)
      list = list.filter((m) => set.has(m.marketId))
    }

    if (filters.exchange !== 'all') {
      const ex = filters.exchange.toLowerCase()
      list = list.filter((m) => m.exchange.toLowerCase() === ex || m.exchangeTag.toLowerCase() === ex)
    }

    if (filters.type !== 'all') {
      const t = filters.type.toLowerCase()
      list = list.filter((m) => m.marketType.toLowerCase().includes(t))
    }

    const q = filters.query.trim().toLowerCase()
    if (q) list = list.filter((m) => matchQuery(m, q))

    return list
  }, [filters.exchange, filters.query, filters.type, markets, watchlist, watchlistOnly])

  // Fetch a small metrics window so the grid renders fast.
  useEffect(() => {
    const prefetchCount = Math.max(80, size * 6)
    const ids = filtered.slice(0, prefetchCount).map((m) => m.marketId)
    ensureManyMetrics(ids)
  }, [ensureManyMetrics, filtered, size])

  const filteredIndex = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < filtered.length; i += 1) {
      map.set(filtered[i]!.marketId, i)
    }
    return map
  }, [filtered])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1

    const metricValue = (m: MarketItem) => {
      const v = getMetric(m.marketId)
      if (!v) return null
      if (sortKey === 'volume24h') return v.volume24h
      if (sortKey === 'change') return v.changeTodayPct
      return v.natr5m14
    }

    return [...filtered].sort((a, b) => {
      const av = metricValue(a)
      const bv = metricValue(b)

      if (typeof av === 'number' && typeof bv === 'number') {
        if (av === bv) return (filteredIndex.get(a.marketId) ?? 0) - (filteredIndex.get(b.marketId) ?? 0)
        return av > bv ? dir : -dir
      }

      // If metrics are missing, preserve backend order (fast first render).
      return (filteredIndex.get(a.marketId) ?? 0) - (filteredIndex.get(b.marketId) ?? 0)
    })
  }, [filtered, filteredIndex, getMetric, sortDir, sortKey])

  const pageCount = Math.max(1, Math.ceil(sorted.length / size))
  const currentPage = Math.min(page, pageCount - 1)

  const pageSlice = useMemo(() => {
    const start = currentPage * size
    return sorted.slice(start, start + size)
  }, [currentPage, size, sorted])

  useEffect(() => {
    if (pageSlice.length === 0) return
    applyMarketsToGrid(pageSlice)
  }, [applyMarketsToGrid, pageSlice])

  // Websocket connect + subscribe only to visible marketIds.
  const lastSubscribed = useRef<string[]>([])

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${wsProtocol}//${window.location.host}/ws`
    if (!connected) {
      connect(url)
    }
  }, [connect, connected])

  const charts = useTerminalChartStore((s) => s.charts)

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [chartHeight, setChartHeight] = useState(220)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const compute = () => {
      const GAP = 16
      const PAD = 32
      const HEADER_APPROX = 96

      const available = Math.max(0, el.clientHeight - PAD)
      const totalPerRow = Math.floor((available - GAP * Math.max(0, rows - 1)) / Math.max(1, rows))
      const nextChartHeight = Math.min(260, Math.max(140, totalPerRow - HEADER_APPROX))
      setChartHeight((prev) => (Math.abs(prev - nextChartHeight) > 4 ? nextChartHeight : prev))
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(el)
    return () => ro.disconnect()
  }, [rows])

  const marketById = useMemo(() => {
    const map = new Map<string, MarketItem>()
    for (const m of markets) map.set(m.marketId, m)
    return map
  }, [markets])

  const displayedIds = useMemo(() => {
    const ids: string[] = []
    for (let idx = 0; idx < size; idx += 1) {
      const id = getChartIdForIndex(idx)
      const cfg = charts[id]
      if (cfg?.marketId) ids.push(cfg.marketId)
    }
    return Array.from(new Set(ids))
  }, [charts, size])

  useEffect(() => {
    const ids = displayedIds

    const prev = lastSubscribed.current
    if (prev.length > 0) unsubscribe(prev)

    if (ids.length > 0) subscribe(ids)
    lastSubscribed.current = ids

    return () => {
      if (ids.length > 0) unsubscribe(ids)
    }
  }, [displayedIds, subscribe, unsubscribe])

  return (
    <div className="h-full flex flex-col">
      <div ref={viewportRef} className="flex-1 min-h-0 overflow-auto p-4">
        {error && <div className="mb-3 text-sm text-red-400">{error}</div>}
        {loading && markets.length === 0 ? (
          <div className="text-sm text-dark-400">Loading markets…</div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${gridColsClass(cols)}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: size }).map((_, idx) => {
              const id = getChartIdForIndex(idx)
              const cfg = charts[id]
              const market = cfg ? marketById.get(cfg.marketId) || pageSlice[idx] : pageSlice[idx]
              if (!cfg || !market) {
                return (
                  <div key={id} className="bg-dark-800 border border-dark-700 rounded-xl" style={{ height: chartHeight + 96 }} />
                )
              }

              return (
                <TerminalChartTile
                  key={id}
                  config={cfg}
                  market={market}
                  height={chartHeight}
                  selected={selectedChartId === id}
                  onSelect={() => setSelectedChartId(id)}
                  onOpenFocus={() => openFocusFromTile(id)}

                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
