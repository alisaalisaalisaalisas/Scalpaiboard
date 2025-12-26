import { useEffect, useMemo } from 'react'

import type { MarketItem } from '../../types'
import { useWatchlistStore } from '../../store/watchlistStore'
import { useTerminalMarketStore } from '../../store/terminalMarketStore'
import { useTerminalTickerStore } from '../../store/terminalTickerStore'
import { useMarketMetricsStore } from '../../store/marketMetricsStore'
import { useTerminalChartStore } from '../../store/terminalChartStore'

const compact = (n: number) => {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`
  return n.toFixed(2)
}

const fmtPct = (v: number | undefined) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

export default function WatchlistPage() {
  const marketIds = useWatchlistStore((s) => s.marketIds)
  const toggle = useWatchlistStore((s) => s.toggle)

  const markets = useTerminalMarketStore((s) => s.markets)
  const loading = useTerminalMarketStore((s) => s.loading)
  const error = useTerminalMarketStore((s) => s.error)
  const fetchAll = useTerminalMarketStore((s) => s.fetchAll)

  const tickers = useTerminalTickerStore((s) => s.tickers)
  const connect = useTerminalTickerStore((s) => s.connect)
  const connected = useTerminalTickerStore((s) => s.connected)
  const subscribe = useTerminalTickerStore((s) => s.subscribe)
  const unsubscribe = useTerminalTickerStore((s) => s.unsubscribe)

  const ensureMany = useMarketMetricsStore((s) => s.ensureMany)
  const getMetric = useMarketMetricsStore((s) => s.get)

  const openFocusMarket = useTerminalChartStore((s) => s.openFocusMarket)

  useEffect(() => {
    if (markets.length === 0 && !loading) {
      void fetchAll()
    }
  }, [fetchAll, loading, markets.length])

  useEffect(() => {
    if (marketIds.length === 0) return

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${wsProtocol}//${window.location.host}/ws`
    if (!connected) connect(url)
  }, [connect, connected, marketIds.length])

  useEffect(() => {
    if (!connected) return
    if (marketIds.length === 0) return

    subscribe(marketIds)
    return () => unsubscribe(marketIds)
  }, [connected, marketIds, subscribe, unsubscribe])

  useEffect(() => {
    if (marketIds.length === 0) return
    ensureMany(marketIds)
  }, [ensureMany, marketIds])

  const items = useMemo(() => {
    const byId = new Map(markets.map((m) => [m.marketId, m] as const))
    return marketIds
      .map((id) => byId.get(id))
      .filter((m): m is MarketItem => Boolean(m))
  }, [marketIds, markets])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Watchlist</h1>
        <p className="text-gray-400">Your starred markets from the terminal</p>
      </div>

      {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

      {loading && markets.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Loading markets…</div>
      ) : items.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <div className="text-6xl mb-4">⭐</div>
          <h3 className="text-xl font-semibold text-white mb-2">Your watchlist is empty</h3>
          <p className="text-gray-400">Click the star icon on any chart tile to add it here.</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-sm">
                <th className="text-left p-4">Market</th>
                <th className="text-right p-4">Price</th>
                <th className="text-right p-4">Change</th>
                <th className="text-right p-4">Volume</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => {
                const t = tickers.get(m.marketId)
                const met = getMetric(m.marketId)
                const price = typeof t?.price === 'number' && Number.isFinite(t.price) ? t.price : met?.price
                const change = typeof t?.change24h === 'number' && Number.isFinite(t.change24h) ? t.change24h : met?.changeTodayPct
                const vol = typeof t?.volume24h === 'number' && Number.isFinite(t.volume24h) ? t.volume24h : met?.volume24h

                return (
                  <tr key={m.marketId} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="p-4">
                      <button type="button" className="text-left" onClick={() => openFocusMarket(m.marketId)} title="Open Focus Mode">
                        <div className="font-medium text-white">{m.symbol}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                          <span className="px-1.5 py-0.5 rounded bg-gray-900/40 border border-gray-700">{m.exchangeTag}</span>
                          <span className="px-1.5 py-0.5 rounded bg-gray-900/40 border border-gray-700">{m.contractTag}</span>
                        </div>
                      </button>
                    </td>
                    <td className="text-right p-4">
                      <span className="text-white font-medium">
                        {typeof price === 'number' && Number.isFinite(price)
                          ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })
                          : '—'}
                      </span>
                    </td>
                    <td className="text-right p-4">
                      <span className={typeof change === 'number' && change >= 0 ? 'text-green-400' : 'text-red-400'}>{fmtPct(change)}</span>
                    </td>
                    <td className="text-right p-4">
                      <span className="text-gray-300">{typeof vol === 'number' ? compact(vol) : '—'}</span>
                    </td>
                    <td className="text-right p-4">
                      <button
                        type="button"
                        onClick={() => toggle(m.marketId)}
                        className="text-yellow-400 hover:text-yellow-300 transition-colors"
                        title="Remove from watchlist"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
