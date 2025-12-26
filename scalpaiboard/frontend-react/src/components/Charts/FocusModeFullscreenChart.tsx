import { useEffect, useMemo, useState } from 'react'

import { useTerminalChartStore } from '../../store/terminalChartStore'
import { useTerminalMarketStore } from '../../store/terminalMarketStore'
import { useTerminalTickerStore } from '../../store/terminalTickerStore'
import TerminalChartTile from './TerminalChartTile'
import type { ChartConfig, MarketItem, Timeframe } from '../../types'

const defaultFocusConfig = (market: MarketItem, globalTimeframe: Timeframe): ChartConfig => {
  return {
    chartId: 'focus',
    marketId: market.marketId,
    symbol: market.symbol,
    exchange: market.exchange,
    marketType: market.marketType,
    timeframe: globalTimeframe,
    timeframeMode: 'global',
    ui: {
      showDrawings: true,
      indicators: { ma: false, bollinger: false, pivots: false, rsi: false, macd: false },
    },
    drawingStateId: `${market.marketId}:${globalTimeframe}`,
    watchlisted: false,
  }
}

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'] as const

export default function FocusModeFullscreenChart() {
  const focus = useTerminalChartStore((s) => s.focus)
  const charts = useTerminalChartStore((s) => s.charts)
  const closeFocus = useTerminalChartStore((s) => s.closeFocus)
  const globalTimeframe = useTerminalChartStore((s) => s.globalTimeframe)
  const setChartTimeframeOverride = useTerminalChartStore((s) => s.setChartTimeframeOverride)

  const markets = useTerminalMarketStore((s) => s.markets)

  const connect = useTerminalTickerStore((s) => s.connect)
  const connected = useTerminalTickerStore((s) => s.connected)
  const subscribe = useTerminalTickerStore((s) => s.subscribe)
  const unsubscribe = useTerminalTickerStore((s) => s.unsubscribe)

  const tileConfig = useMemo(() => {
    if (!focus.open || focus.kind !== 'tile' || !focus.chartId) return null
    return charts[focus.chartId] || null
  }, [charts, focus.chartId, focus.kind, focus.open])

  const tileMarket = useMemo(() => {
    if (!tileConfig) return null
    return markets.find((m) => m.marketId === tileConfig.marketId) || null
  }, [markets, tileConfig])

  const marketMarket = useMemo(() => {
    if (!focus.open || focus.kind !== 'market' || !focus.marketId) return null
    return markets.find((m) => m.marketId === focus.marketId) || null
  }, [focus.kind, focus.marketId, focus.open, markets])

  const [marketConfig, setMarketConfig] = useState<ChartConfig | null>(null)

  useEffect(() => {
    if (!focus.open || focus.kind !== 'market') {
      setMarketConfig(null)
      return
    }

    if (!marketMarket) {
      setMarketConfig(null)
      return
    }

    setMarketConfig((prev) => {
      const base = prev || defaultFocusConfig(marketMarket, globalTimeframe)
      return {
        ...base,
        marketId: marketMarket.marketId,
        symbol: marketMarket.symbol,
        exchange: marketMarket.exchange,
        marketType: marketMarket.marketType,
        timeframe: globalTimeframe,
        timeframeMode: 'global',
        drawingStateId: `${marketMarket.marketId}:${globalTimeframe}`,
      }
    })
  }, [focus.kind, focus.open, globalTimeframe, marketMarket])

  useEffect(() => {
    if (!focus.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFocus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeFocus, focus.open])

  const [chartHeight, setChartHeight] = useState(() => Math.max(320, window.innerHeight - 120))
  useEffect(() => {
    if (!focus.open) return
    const onResize = () => setChartHeight(Math.max(320, window.innerHeight - 120))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [focus.open])

  const renderConfig = focus.kind === 'tile' ? tileConfig : marketConfig
  const renderMarket = focus.kind === 'tile' ? tileMarket : marketMarket

  useEffect(() => {
    if (!focus.open) return
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${wsProtocol}//${window.location.host}/ws`
    if (!connected) connect(url)
  }, [connect, connected, focus.open])

  useEffect(() => {
    if (!focus.open) return
    const id = renderConfig?.marketId
    if (!id) return
    subscribe([id])
    return () => unsubscribe([id])
  }, [focus.open, renderConfig?.marketId, subscribe, unsubscribe])

  const activeTf = renderConfig?.timeframe

  const setTimeframe = (tf: Timeframe) => {
    if (!renderConfig) return

    if (focus.kind === 'tile' && focus.chartId) {
      setChartTimeframeOverride(focus.chartId, tf)
      return
    }

    if (focus.kind === 'market') {
      setMarketConfig((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          timeframe: tf,
          timeframeMode: 'override',
          drawingStateId: `${prev.marketId}:${tf}`,
        }
      })
    }
  }

  const useGlobalTimeframe = () => {
    if (!renderConfig) return

    if (focus.kind === 'tile' && focus.chartId) {
      setChartTimeframeOverride(focus.chartId, null)
      return
    }

    if (focus.kind === 'market') {
      setMarketConfig((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          timeframe: globalTimeframe,
          timeframeMode: 'global',
          drawingStateId: `${prev.marketId}:${globalTimeframe}`,
        }
      })
    }
  }

  if (!focus.open || !renderConfig || !renderMarket) return null

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-3 bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden flex flex-col">
        <div className="h-16 px-4 flex items-center justify-between border-b border-dark-700 gap-4">
          <div className="min-w-0">
            <div className="text-sm text-white font-medium truncate">
              Focus mode: {renderMarket.symbol} • {renderMarket.contractTag}
            </div>
            <div className="mt-2 flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={useGlobalTimeframe}
                className={`px-2 py-1 rounded-md border text-[11px] transition-colors ${
                  renderConfig.timeframeMode === 'global'
                    ? 'bg-primary-600 border-primary-500 text-white'
                    : 'bg-dark-900/40 border-dark-700 text-dark-300 hover:text-white hover:bg-dark-700'
                }`}
                title="Use global timeframe"
              >
                Global
              </button>
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-1 rounded-md border text-[11px] transition-colors ${
                    activeTf === tf ? 'bg-primary-600 border-primary-500 text-white' : 'bg-dark-900/40 border-dark-700 text-dark-300 hover:text-white hover:bg-dark-700'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="px-3 py-1.5 text-sm bg-dark-800 border border-dark-700 rounded-lg text-dark-200 hover:bg-dark-700"
            onClick={closeFocus}
          >
            Close (Esc)
          </button>
        </div>

        <div className="flex-1 min-h-0 p-3">
          <TerminalChartTile
            config={renderConfig}
            market={renderMarket}
            height={chartHeight}
            selected
            onSelect={() => void 0}
            onOpenFocus={closeFocus}
            onConfigChange={focus.kind === 'market' ? setMarketConfig : undefined}
          />
        </div>
      </div>
    </div>
  )
}
