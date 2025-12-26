import { useEffect, useMemo } from 'react'
import { ArrowDownUp, ChevronLeft, ChevronRight, LayoutGrid, Star } from 'lucide-react'

import TerminalChartGrid from '../Charts/TerminalChartGrid'
import KeyboardSearchOverlay from './KeyboardSearchOverlay'

import { useTerminalMarketStore, type MarketSortKey } from '../../store/terminalMarketStore'
import { useTerminalChartStore, type GridLayout } from '../../store/terminalChartStore'
import { useTerminalTickerStore } from '../../store/terminalTickerStore'

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'] as const
const LAYOUTS: GridLayout[] = ['1x1', '2x2', '3x3', '4x4', '5x5', '6x6']

export default function MainDashboard() {
  const { fetchAll } = useTerminalMarketStore()
  const { sortKey, sortDir, setSort, toggleSortDir, watchlistOnly, toggleWatchlistOnly } = useTerminalMarketStore()

  const { layout, setLayout, page, setPage, prevPage, nextPage, globalTimeframe, setGlobalTimeframe } = useTerminalChartStore()

  const connected = useTerminalTickerStore((s) => s.connected)

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const sortLabel = useMemo(() => {
    const map: Record<MarketSortKey, string> = {
      volume24h: 'Volume 24h',
      natr: 'NATR(5m,14)',
      change: 'Change %',
    }
    return map[sortKey]
  }, [sortKey])

  return (
    <div className="h-full flex flex-col">
      <header className="h-16 px-6 flex items-center justify-between border-b border-dark-700 bg-dark-800">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-dark-300">{connected ? 'Live' : 'Offline'}</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-dark-400">
            <span>Type to search</span>
            <span className="px-2 py-0.5 bg-dark-700 rounded">Ctrl+K</span>
            <span className="px-2 py-0.5 bg-dark-700 rounded">Shift+S</span>
            <span className="px-2 py-0.5 bg-dark-700 rounded">Shift+D</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Layout */}
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-dark-400" />
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as GridLayout)}
              className="px-3 py-2 text-sm bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
            >
              {LAYOUTS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Timeframes */}
          <div className="hidden lg:flex items-center bg-dark-700 rounded-lg p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setGlobalTimeframe(tf)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  globalTimeframe === tf ? 'bg-primary-600 text-white' : 'text-dark-200 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <select
              value={sortKey}
              onChange={(e) => setSort(e.target.value as MarketSortKey)}
              className="px-3 py-2 text-sm bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
              title="Sort"
            >
              <option value="volume24h">Volume 24h</option>
              <option value="natr">NATR(5m,14)</option>
              <option value="change">Change %</option>
            </select>
            <button
              type="button"
              onClick={toggleSortDir}
              className="w-10 h-10 rounded-lg bg-dark-800 border border-dark-700 hover:bg-dark-700 transition-colors flex items-center justify-center"
              title={`Sort ${sortLabel} ${sortDir}`}
            >
              <ArrowDownUp className="w-4 h-4 text-dark-300" />
            </button>
          </div>

          {/* Watchlist mode */}
          <button
            type="button"
            onClick={toggleWatchlistOnly}
            className={`w-10 h-10 rounded-lg border transition-colors flex items-center justify-center ${
              watchlistOnly
                ? 'bg-primary-600 border-primary-500 text-white'
                : 'bg-dark-800 border-dark-700 text-dark-300 hover:text-white hover:bg-dark-700'
            }`}
            title="Watchlist mode"
          >
            <Star className="w-4 h-4" />
          </button>

          {/* Page nav */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevPage}
              className="w-10 h-10 rounded-lg bg-dark-800 border border-dark-700 hover:bg-dark-700 transition-colors flex items-center justify-center"
              title="Prev page"
            >
              <ChevronLeft className="w-4 h-4 text-dark-300" />
            </button>
            <div className="text-xs text-dark-400 w-10 text-center">{page + 1}</div>
            <button
              type="button"
              onClick={nextPage}
              className="w-10 h-10 rounded-lg bg-dark-800 border border-dark-700 hover:bg-dark-700 transition-colors flex items-center justify-center"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4 text-dark-300" />
            </button>
            <button
              type="button"
              onClick={() => setPage(0)}
              className="hidden md:inline-flex px-3 py-2 text-sm bg-dark-800 border border-dark-700 rounded-lg text-dark-200 hover:bg-dark-700"
              title="Reset to page 1"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <TerminalChartGrid />
      </div>

      <KeyboardSearchOverlay />
    </div>
  )
}
