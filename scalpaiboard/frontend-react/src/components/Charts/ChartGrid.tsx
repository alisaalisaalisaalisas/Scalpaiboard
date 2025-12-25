import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts'
import { getCandles } from '../../services/api'
import { useChartStore } from '../../store/chartStore'
import { useWebSocketStore } from '../../store/websocketStore'

import { Candle } from '../../types'

const CHART_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT',
  'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT',
  'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'ARBUSDT'
]

export default function ChartGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {CHART_SYMBOLS.map(symbol => (
        <ChartCard key={symbol} symbol={symbol} />
      ))}
    </div>
  )
}

function ChartCard({ symbol }: { symbol: string }) {
  const timeframe = '1h'
  const limit = 100
  const cacheKey = `${symbol}:${timeframe}:${limit}`
  const intervalSeconds = 60 * 60

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastBarRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null)
  const candlesRef = useRef<Candle[]>([])
  const loadingMoreRef = useRef(false)
  const hasMoreHistoryRef = useRef(true)
  const loadMoreCandlesRef = useRef<() => void>(() => {})

  const [loading, setLoading] = useState(() => !useChartStore.getState().getCandles(cacheKey, 5 * 60 * 1000))
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const priceData = useWebSocketStore(state => state.getPrice(symbol))
  const price = priceData?.price ? parseFloat(priceData.price) : 0
  const change = priceData?.change24h ? parseFloat(priceData.change24h) : 0


  useEffect(() => {
    if (!containerRef.current) return

    // Create chart
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#1e293b' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      width: containerRef.current.clientWidth,
      height: 200,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#334155',
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
      crosshair: {
        mode: 0,
      },
    })

    chartRef.current = chart

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#dc2626',
      borderUpColor: '#16a34a',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    })

    candleSeriesRef.current = candleSeries

    // Handle resize
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    const timeScale: any = chart.timeScale()
    const onVisibleRangeChange = (range: any) => {
      const from = range?.from
      if (typeof from !== 'number') return

      const oldest = candlesRef.current[0]
      if (!oldest) return

      // If user scrolls close to the oldest loaded candles, fetch more.
      if (from <= oldest.time + intervalSeconds * 20) {
        loadMoreCandlesRef.current()
      }
    }

    timeScale?.subscribeVisibleTimeRangeChange?.(onVisibleRangeChange)

    // Load initial data
    loadCandles()


    return () => {
      window.removeEventListener('resize', handleResize)
      timeScale?.unsubscribeVisibleTimeRangeChange?.(onVisibleRangeChange)
      chart.remove()
    }

  }, [])

  async function loadCandles() {
    try {
      const cached = useChartStore.getState().getCandles(cacheKey, 5 * 60 * 1000)
      if (cached && candleSeriesRef.current) {
        const formattedData = cached.map((c: Candle) => ({
          time: c.time as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
        candleSeriesRef.current.setData(formattedData)
        chartRef.current?.timeScale().fitContent()

        const last = cached[cached.length - 1]
        if (last) {
          lastBarRef.current = {
            time: last.time,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
          }
        }

        candlesRef.current = cached
        hasMoreHistoryRef.current = true

        setLoading(false)
        return
      }

      setLoading(true)
      const candles = await getCandles(symbol, timeframe, limit)
      useChartStore.getState().setCandles(cacheKey, candles)

      if (candleSeriesRef.current && candles.length > 0) {
        const formattedData = candles.map((c: Candle) => ({
          time: c.time as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
        candleSeriesRef.current.setData(formattedData)
        chartRef.current?.timeScale().fitContent()

        const last = candles[candles.length - 1]
        if (last) {
          lastBarRef.current = {
            time: last.time,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
          }
        }
      }

      candlesRef.current = candles
      hasMoreHistoryRef.current = true

      setLoading(false)
    } catch (err) {
      setError('Failed to load')
      setLoading(false)
    }
  }

  const prependCandles = (older: Candle[]) => {
    const current = candlesRef.current

    const byTime = new Map<number, Candle>()
    for (const c of current) byTime.set(c.time, c)
    for (const c of older) if (!byTime.has(c.time)) byTime.set(c.time, c)

    const merged = Array.from(byTime.values()).sort((a, b) => a.time - b.time)
    candlesRef.current = merged
    useChartStore.getState().setCandles(cacheKey, merged)

    const last = merged[merged.length - 1]
    if (last) {
      lastBarRef.current = {
        time: last.time,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      }
    }

    if (candleSeriesRef.current) {
      const formattedData = merged.map((c: Candle) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))

      const timeScale: any = chartRef.current?.timeScale()
      const visibleRange = timeScale?.getVisibleRange?.() ?? null

      candleSeriesRef.current.setData(formattedData)
      if (visibleRange && timeScale?.setVisibleRange) {
        timeScale.setVisibleRange(visibleRange)
      }
    }
  }

  const loadMoreHistory = async () => {
    if (loadingMoreRef.current) return
    if (!hasMoreHistoryRef.current) return

    const current = candlesRef.current
    if (current.length === 0) return

    const oldest = current[0]
    if (!oldest) return

    loadingMoreRef.current = true
    setLoadingMore(true)

    try {
      const endTime = oldest.time - 1
      const older = await getCandles(symbol, timeframe, 200, endTime)

      if (!older || older.length === 0) {
        hasMoreHistoryRef.current = false
        return
      }

      prependCandles(older)
    } catch (err) {
      // keep hasMoreHistoryRef as-is
    } finally {
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }

  useEffect(() => {
    loadMoreCandlesRef.current = () => {
      void loadMoreHistory()
    }
  })

  useEffect(() => {
    if (!candleSeriesRef.current) return
    if (!priceData?.price || !priceData.timestamp) return

    const livePrice = Number.parseFloat(priceData.price)
    if (!Number.isFinite(livePrice)) return

    const barTime = Math.floor(priceData.timestamp / intervalSeconds) * intervalSeconds

    const last = lastBarRef.current
    if (!last) return
    if (barTime < last.time) return

    if (barTime === last.time) {
      const next = {
        ...last,
        high: Math.max(last.high, livePrice),
        low: Math.min(last.low, livePrice),
        close: livePrice,
      }
      candleSeriesRef.current.update({
        time: next.time as any,
        open: next.open,
        high: next.high,
        low: next.low,
        close: next.close,
      })
      lastBarRef.current = next

      const current = candlesRef.current
      const lastIdx = current.length - 1
      if (lastIdx >= 0 && current[lastIdx]?.time === next.time) {
        const updated = current.slice(0)
        updated[lastIdx] = {
          ...updated[lastIdx],
          high: next.high,
          low: next.low,
          close: next.close,
        }
        candlesRef.current = updated
        useChartStore.getState().setCandles(cacheKey, updated)
      }

      return
    }

    const next = {
      time: barTime,
      open: last.close,
      high: livePrice,
      low: livePrice,
      close: livePrice,
    }
    candleSeriesRef.current.update({
      time: next.time as any,
      open: next.open,
      high: next.high,
      low: next.low,
      close: next.close,
    })
    lastBarRef.current = next

    if (candlesRef.current.length > 0) {
      const updated = [
        ...candlesRef.current,
        { time: next.time, open: next.open, high: next.high, low: next.low, close: next.close, volume: 0 },
      ]
      candlesRef.current = updated
      useChartStore.getState().setCandles(cacheKey, updated)
    }
  }, [intervalSeconds, priceData?.price, priceData?.timestamp])

  return (

    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-dark-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{symbol.replace('USDT', '')}</span>
          <span className="text-xs text-dark-400">/USDT</span>
        </div>
        <div className="text-right">
          <div className="font-mono font-medium">
            ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800/80 z-10">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800/80 z-10">
            <span className="text-red-500 text-sm">{error}</span>
          </div>
        )}
        {loadingMore && (
          <div className="absolute left-2 top-2 z-10 text-xs px-2 py-1 bg-dark-900/70 border border-dark-700 rounded-md text-dark-200">
            Loading history...
          </div>
        )}
        <div ref={containerRef} className="h-[200px]" />

      </div>
    </div>
  )
}
