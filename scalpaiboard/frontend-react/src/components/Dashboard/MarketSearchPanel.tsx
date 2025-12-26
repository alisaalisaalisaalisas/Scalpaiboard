import { useEffect, useMemo, useState } from 'react'

import type { MarketItem } from '../../types'
import { useMarketMetricsStore } from '../../store/marketMetricsStore'
import { useTerminalChartStore } from '../../store/terminalChartStore'
import { useTerminalMarketStore } from '../../store/terminalMarketStore'

type ExchangeFilter = 'all' | 'BI' | 'BY' | 'OK'
type TypeFilter = 'all' | 'spot' | 'perp'

const compactPct = (v: number | undefined) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

const marketTypeToFilter = (marketType: string): TypeFilter => {
  const t = marketType.toLowerCase()
  if (t.includes('perp') || t.includes('perpetual')) return 'perp'
  if (t.includes('spot')) return 'spot'
  return 'all'
}

const matchQuery = (m: MarketItem, q: string) => {
  const s = `${m.symbol} ${m.base} ${m.quote} ${m.exchangeTag} ${m.contractTag} ${m.marketType}`.toLowerCase()
  return s.includes(q)
}

const orderKey = (exchangeTag: string) => {
  const ex = exchangeTag.toUpperCase()
  if (ex === 'BI') return 0
  if (ex === 'BY') return 1
  if (ex === 'OK') return 2
  return 9
}

export default function MarketSearchPanel() {
  const markets = useTerminalMarketStore((s) => s.markets)
  const loading = useTerminalMarketStore((s) => s.loading)
  const error = useTerminalMarketStore((s) => s.error)
  const fetchAll = useTerminalMarketStore((s) => s.fetchAll)

  const openFocusMarket = useTerminalChartStore((s) => s.openFocusMarket)

  const getMetric = useMarketMetricsStore((s) => s.get)
  const ensureMany = useMarketMetricsStore((s) => s.ensureMany)

  const [query, setQuery] = useState('')
  const [exchange, setExchange] = useState<ExchangeFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')

  useEffect(() => {
    if (markets.length === 0 && !loading) {
      void fetchAll()
    }
  }, [fetchAll, loading, markets.length])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    let list = markets

    if (exchange !== 'all') {
      const ex = exchange.toLowerCase()
      list = list.filter((m) => m.exchangeTag.toLowerCase() === ex || m.exchange.toLowerCase() === ex)
    }

    if (type !== 'all') {
      list = list.filter((m) => marketTypeToFilter(m.marketType) === type)
    }

    if (q) {
      list = list.filter((m) => matchQuery(m, q))
    }

    return list.slice(0, 600)
  }, [exchange, markets, query, type])

  useEffect(() => {
    ensureMany(filtered.slice(0, 250).map((m) => m.marketId))
  }, [ensureMany, filtered])

  const groups = useMemo(() => {
    const map = new Map<string, MarketItem[]>()

    for (const m of filtered) {
      const key = `${m.exchangeTag} • ${m.marketType}`
      const prev = map.get(key)
      if (prev) prev.push(m)
      else map.set(key, [m])
    }

    const entries = Array.from(map.entries())
    entries.sort((a, b) => {
      const [aEx, aType] = a[0].split(' • ')
      const [bEx, bType] = b[0].split(' • ')
      const exCmp = orderKey(aEx) - orderKey(bEx)
      if (exCmp !== 0) return exCmp
      return aType.localeCompare(bType)
    })

    return entries
  }, [filtered])

  return (
    <div className="h-full min-h-0 flex flex-col bg-dark-900">
      <div className="p-3 border-b border-dark-700 space-y-2">
        <input
          className="input text-sm"
          placeholder="Search markets (BTC, SUI, BI-F, Perp…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={exchange}
            onChange={(e) => setExchange(e.target.value as ExchangeFilter)}
            className="px-3 py-2 text-sm bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
            title="Exchange"
          >
            <option value="all">All exchanges</option>
            <option value="BI">Binance (BI)</option>
            <option value="BY">Bybit (BY)</option>
            <option value="OK">OKX (OK)</option>
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TypeFilter)}
            className="px-3 py-2 text-sm bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
            title="Market type"
          >
            <option value="all">All types</option>
            <option value="spot">Spot</option>
            <option value="perp">Perp</option>
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {error && <div className="p-3 text-sm text-red-400">{error}</div>}
        {loading && markets.length === 0 ? (
          <div className="p-4 text-sm text-dark-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-dark-400">No matches</div>
        ) : (
          <div className="divide-y divide-dark-800">
            {groups.map(([groupKey, list]) => (
              <div key={groupKey} className="py-2">
                <div className="px-4 py-2 text-[11px] text-dark-400 uppercase tracking-wide flex items-center justify-between">
                  <span>{groupKey}</span>
                  <span className="text-dark-500">{list.length}</span>
                </div>

                <div className="divide-y divide-dark-800">
                  {list.slice(0, 120).map((m) => {
                    const met = getMetric(m.marketId)
                    const ch = met?.changeTodayPct

                    return (
                      <button
                        key={m.marketId}
                        type="button"
                        onClick={() => openFocusMarket(m.marketId)}
                        className="w-full text-left px-4 py-3 hover:bg-dark-800/60 transition-colors"
                        title="Open in Focus Mode"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white truncate">{m.symbol}</div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-dark-300">
                              <span className="px-1.5 py-0.5 rounded bg-dark-800 border border-dark-700">{m.exchangeTag}</span>
                              <span className="px-1.5 py-0.5 rounded bg-dark-800 border border-dark-700">{m.contractTag}</span>
                            </div>
                          </div>
                          <div className={`text-xs font-medium ${typeof ch === 'number' && ch >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {compactPct(ch)}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-dark-700 text-[11px] text-dark-500">
        Tip: click a row to open Focus Mode.
      </div>
    </div>
  )
}
