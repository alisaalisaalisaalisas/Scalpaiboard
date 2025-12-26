import { useEffect, useMemo } from 'react'

import { useTerminalMarketStore } from '../../store/terminalMarketStore'
import { useMarketMetricsStore } from '../../store/marketMetricsStore'
import { useTerminalChartStore } from '../../store/terminalChartStore'

const compactPct = (v: number | undefined) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

export default function SidebarMarketList() {
  const { markets, loading, error, filters, setQuery, setExchange, setType, fetchAll } = useTerminalMarketStore()
  const openFocusMarket = useTerminalChartStore((s) => s.openFocusMarket)

  const getMetric = useMarketMetricsStore((s) => s.get)
  const ensureMany = useMarketMetricsStore((s) => s.ensureMany)

  useEffect(() => {
    if (markets.length === 0 && !loading) {
      void fetchAll()
    }
  }, [fetchAll, loading, markets.length])

  const visible = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    const ex = filters.exchange
    const type = filters.type

    let list = markets
    if (ex !== 'all') {
      const exLower = ex.toLowerCase()
      list = list.filter((m) => m.exchangeTag.toLowerCase() === exLower || m.exchange.toLowerCase() === exLower)
    }
    if (type !== 'all') {
      const t = type.toLowerCase()
      list = list.filter((m) => m.marketType.toLowerCase().includes(t))
    }

    if (q) {
      list = list.filter((m) => (`${m.symbol} ${m.base} ${m.exchangeTag} ${m.contractTag}`.toLowerCase().includes(q)))
    }

    return list.slice(0, 400)
  }, [filters.exchange, filters.query, filters.type, markets])

  useEffect(() => {
    ensureMany(visible.slice(0, 200).map((m) => m.marketId))
  }, [ensureMany, visible])

  return (
    <div className="h-full min-h-0 flex flex-col bg-dark-900">
      <div className="h-14 px-4 flex items-center justify-between border-b border-dark-700">
        <div className="min-w-0">
          <div className="font-medium text-sm text-white">Market List</div>
          <div className="text-xs text-dark-400 truncate">{markets.length} markets</div>
        </div>
      </div>

      <div className="p-3 border-b border-dark-700 space-y-2">
        <input
          className="input text-sm"
          placeholder="Search (BTC, SUI, SOL, BI-F...)"
          value={filters.query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filters.exchange}
            onChange={(e) => setExchange(e.target.value as any)}
            className="px-3 py-2 text-sm bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
            title="Exchange"
          >
            <option value="all">All exchanges</option>
            <option value="BI">Binance (BI)</option>
            <option value="BY">Bybit (BY)</option>
          </select>
          <select
            value={filters.type}
            onChange={(e) => setType(e.target.value as any)}
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
        ) : (
          <div className="divide-y divide-dark-800">
            {visible.map((m) => {
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
        )}
      </div>

      <div className="p-3 border-t border-dark-700 text-[11px] text-dark-500">
        Click a market row to open Focus Mode.
      </div>
    </div>
  )
}
