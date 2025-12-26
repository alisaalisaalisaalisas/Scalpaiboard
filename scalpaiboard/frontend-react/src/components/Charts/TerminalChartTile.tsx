import { useEffect, useMemo, useRef, useState, type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction } from 'react'
import { createChart, IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts'
import { Star } from 'lucide-react'

import type { Candle, ChartConfig, MarketItem, Timeframe } from '../../types'
import { getCandles } from '../../services/api'
import { useWatchlistStore } from '../../store/watchlistStore'
import { useDrawingsStore, type DrawingTool, newId } from '../../store/drawingsStore'
import { drawAll, hitTestDrawing } from './drawings'
import { useTerminalTickerStore } from '../../store/terminalTickerStore'
import { useMarketMetricsStore } from '../../store/marketMetricsStore'
import { useTerminalChartStore } from '../../store/terminalChartStore'
import { computeBollinger, computeEMA, computeMACD, computeRSI } from './indicators'
import PriceAlertModal from './PriceAlertModal'

const tfToSec = (tf: Timeframe): number => {
  switch (tf) {
    case '1m':
      return 60
    case '5m':
      return 300
    case '15m':
      return 900
    case '1h':
      return 3600
    case '4h':
      return 14400
    case '1D':
      return 86400
    case '1W':
      return 604800
    default:
      return 3600
  }
}

const toMarketTypeParam = (marketType: string) => {
  return marketType.toLowerCase() === 'perpetual' ? 'perp' : 'spot'
}

const compact = (n: number) => {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`
  return n.toFixed(2)
}

const normalizeCandles = (data: Candle[]): Candle[] => {
  const byTime = new Map<number, Candle>()
  for (const c of data) {
    const t = Number(c?.time)
    if (!Number.isFinite(t)) continue
    byTime.set(t, { ...c, time: t })
  }

  const out = Array.from(byTime.values())
  out.sort((a, b) => a.time - b.time)
  return out
}

const guessPricePrecision = (price: number) => {
  if (!Number.isFinite(price) || price === 0) return { precision: 2, minMove: 0.01 }

  const abs = Math.abs(price)
  if (abs >= 1000) return { precision: 2, minMove: 0.01 }
  if (abs >= 100) return { precision: 2, minMove: 0.01 }
  if (abs >= 10) return { precision: 3, minMove: 0.001 }
  if (abs >= 1) return { precision: 4, minMove: 0.0001 }
  if (abs >= 0.1) return { precision: 5, minMove: 0.00001 }
  return { precision: 6, minMove: 0.000001 }
}

type Props = {
  config: ChartConfig
  market: MarketItem
  height: number
  selected: boolean
  onSelect: () => void
  onOpenFocus: () => void
  onConfigChange?: Dispatch<SetStateAction<ChartConfig | null>>
}

export default function TerminalChartTile({ config, market, height, selected, onSelect, onOpenFocus, onConfigChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastBarRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null)
  const candlesRef = useRef<{ time: number; open: number; high: number; low: number; close: number; volume: number }[]>([])

  const [chartReady, setChartReady] = useState(false)
  const [candlesVersion, setCandlesVersion] = useState(0)

  const priceFormatRef = useRef<{ precision: number; minMove: number } | null>(null)
  const applyPriceFormat = (price: number) => {
    const next = guessPricePrecision(price)
    const prev = priceFormatRef.current
    if (prev && prev.precision === next.precision && prev.minMove === next.minMove) return

    priceFormatRef.current = next
    try {
      candleSeriesRef.current?.applyOptions({ priceFormat: { type: 'price', precision: next.precision, minMove: next.minMove } } as any)
    } catch {
      // ignore
    }
  }

  const loadMoreInFlightRef = useRef(false)
  const reachedHistoryStartRef = useRef(false)
  const lastLoadMoreAtRef = useRef(0)

  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ema50Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null)

  const rsiRef = useRef<ISeriesApi<'Line'> | null>(null)
  const rsiLinesRef = useRef<any[]>([])

  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null)

  const intervalSeconds = tfToSec(config.timeframe)

  const isWatchlisted = useWatchlistStore((s) => s.has(config.marketId))
  const toggleWatchlist = useWatchlistStore((s) => s.toggle)

  const drawings = useDrawingsStore((s) => s.getDrawings(config.drawingStateId))
  const addDrawing = useDrawingsStore((s) => s.addDrawing)
  const removeDrawing = useDrawingsStore((s) => s.removeDrawing)

  const ticker = useTerminalTickerStore((s) => s.getTicker(config.marketId))

  const metrics = useMarketMetricsStore((s) => s.get(config.marketId))
  const ensureMetrics = useMarketMetricsStore((s) => s.ensure)

  const storeToggleIndicator = useTerminalChartStore((s) => s.toggleIndicator)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [hovered, setHovered] = useState(false)
  const [tool, setTool] = useState<DrawingTool>('none')
  const [pendingPoint, setPendingPoint] = useState<{ time: number; price: number } | null>(null)
  const [preview, setPreview] = useState<{ type: 'trendline' | 'ray' | 'rect'; points: { time: number; price: number }[] } | null>(null)

  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [alertDefaultPrice, setAlertDefaultPrice] = useState<number | undefined>(undefined)

  const effectiveChange = typeof ticker?.change24h === 'number' ? ticker.change24h : metrics?.changeTodayPct
  const effectiveVol = typeof ticker?.volume24h === 'number' ? ticker.volume24h : metrics?.volume24h
  const natr = metrics?.natr5m14

  const toggleIndicator = (key: keyof ChartConfig['ui']['indicators']) => {
    if (onConfigChange) {
      onConfigChange((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          ui: {
            ...prev.ui,
            indicators: {
              ...prev.ui.indicators,
              [key]: !prev.ui.indicators[key],
            },
          },
        }
      })
      return
    }

    storeToggleIndicator(config.chartId, key)
  }

  const titleLeft = useMemo(() => {
    return `${market.base || market.symbol} /${market.quote || ''}`
  }, [market.base, market.quote, market.symbol])

  const watermark = useMemo(() => {
    return `${market.symbol} • ${market.exchangeTag} • ${market.marketType}`
  }, [market.exchangeTag, market.marketType, market.symbol])

  // Create chart once per tile instance.
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    const chart = createChart(container, {
      layout: {
        background: { color: '#0b1220' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1f2a3a' },
        horzLines: { color: '#1f2a3a' },
      },
      width: Math.max(1, container.clientWidth),
      height,
      rightPriceScale: { borderColor: '#1f2a3a' },
      timeScale: { borderColor: '#1f2a3a', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
      watermark: {
        visible: true,
        color: 'rgba(148, 163, 184, 0.10)',
        text: watermark,
        fontSize: 18,
        horzAlign: 'center',
        vertAlign: 'center',
      },
    })

    chartRef.current = chart

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#16a34a',
      borderDownColor: '#dc2626',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    candleSeriesRef.current = candleSeries
    setChartReady(true)

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return
      chart.applyOptions({ width: Math.max(1, containerRef.current.clientWidth) })
    })

    ro.observe(container)

    return () => {
      ro.disconnect()
      chart.remove()

      chartRef.current = null
      candleSeriesRef.current = null

      ema20Ref.current = null
      ema50Ref.current = null
      bbUpperRef.current = null
      bbMiddleRef.current = null
      bbLowerRef.current = null
      rsiRef.current = null
      rsiLinesRef.current = []
      macdHistRef.current = null
      macdLineRef.current = null
      macdSignalRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chartRef.current?.applyOptions({ height })
  }, [height])

  useEffect(() => {
    chartRef.current?.applyOptions({
      watermark: {
        visible: true,
        color: 'rgba(148, 163, 184, 0.10)',
        text: watermark,
        fontSize: 18,
        horzAlign: 'center',
        vertAlign: 'center',
      },
    })
  }, [watermark])

  // Load candles when market/timeframe changes.
  useEffect(() => {
    const run = async () => {
      if (!chartReady || !candleSeriesRef.current) return

      setLoading(true)
      setError(null)
      lastBarRef.current = null
      candlesRef.current = []

      try {
        const data = await getCandles(market.symbol, config.timeframe, 300, undefined, {
          exchange: market.exchange,
          marketType: toMarketTypeParam(market.marketType),
        })

        const normalized = normalizeCandles(data)

        const formatted = normalized.map((c) => ({
          time: c.time as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))

        candleSeriesRef.current?.setData(formatted)
        chartRef.current?.timeScale().scrollToRealTime()

        const last = normalized[normalized.length - 1]
        if (last) {
          applyPriceFormat(last.close)
          lastBarRef.current = {
            time: last.time,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
          }
        }

        candlesRef.current = normalized
        setCandlesVersion((v) => v + 1)
        setLoading(false)
      } catch (e: any) {
        setError(e?.response?.data?.error || e?.message || 'Failed to load')
        setLoading(false)
      }
    }

    void run()
  }, [chartReady, config.timeframe, market.exchange, market.marketType, market.symbol])

  // Load older candles when user scrolls left.
  useEffect(() => {
    const chart = chartRef.current
    const series = candleSeriesRef.current
    if (!chart || !series) return

    reachedHistoryStartRef.current = false
    loadMoreInFlightRef.current = false

    const loadMore = async () => {
      if (loadMoreInFlightRef.current) return
      if (reachedHistoryStartRef.current) return

      const now = Date.now()
      if (now - lastLoadMoreAtRef.current < 250) return

      const existing = candlesRef.current
      if (existing.length < 20) return

      const first = existing[0]
      if (!first || !Number.isFinite(first.time)) return

      loadMoreInFlightRef.current = true
      lastLoadMoreAtRef.current = now

      try {
        const endTime = Math.max(0, Math.floor(first.time) - 1)
        const olderRaw = await getCandles(market.symbol, config.timeframe, 500, endTime, {
          exchange: market.exchange,
          marketType: toMarketTypeParam(market.marketType),
        })

        const older = normalizeCandles(olderRaw)
        if (older.length === 0) {
          reachedHistoryStartRef.current = true
          return
        }

        const prevRange: any = chart.timeScale().getVisibleLogicalRange?.()

        const combined = normalizeCandles([...(older as any), ...(existing as any)] as any)
        if (combined.length === existing.length) {
          reachedHistoryStartRef.current = true
          return
        }

        const added = combined.length - existing.length
        candlesRef.current = combined
        series.setData(
          combined.map((c) => ({
            time: c.time as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          })) as any
        )

        setCandlesVersion((v) => v + 1)

        try {
          if (prevRange && typeof prevRange.from === 'number' && typeof prevRange.to === 'number' && added > 0) {
            chart.timeScale().setVisibleLogicalRange?.({ from: prevRange.from + added, to: prevRange.to + added })
          }
        } catch {
          // ignore
        }
      } finally {
        loadMoreInFlightRef.current = false

        // If user is still far left, keep prefetching.
        try {
          const r: any = chart.timeScale().getVisibleLogicalRange?.()
          if (r && typeof r.from === 'number' && r.from < 60 && !reachedHistoryStartRef.current) {
            window.setTimeout(() => void loadMore(), 0)
          }
        } catch {
          // ignore
        }
      }
    }

    const timeScale: any = chart.timeScale()
    const onRange = (range: any) => {
      if (!range || typeof range.from !== 'number') return
      if (range.from < 60) void loadMore()
    }

    timeScale?.subscribeVisibleLogicalRangeChange?.(onRange)
    return () => timeScale?.unsubscribeVisibleLogicalRangeChange?.(onRange)
  }, [config.timeframe, market.exchange, market.marketType, market.symbol])

  // Ensure NATR/metrics periodically.
  useEffect(() => {
    void ensureMetrics(config.marketId)
    const t = window.setInterval(() => void ensureMetrics(config.marketId), 30_000)
    return () => window.clearInterval(t)
  }, [config.marketId, ensureMetrics])

  // Update live candle with ticker price.
  useEffect(() => {
    if (!ticker) return
    if (!candleSeriesRef.current) return

    const price = Number(ticker.price)
    if (!Number.isFinite(price)) return

    const last = lastBarRef.current
    if (!last) return

    const barTime = Math.floor(ticker.timestamp / intervalSeconds) * intervalSeconds
    if (barTime < last.time) return

     if (barTime === last.time) {
       applyPriceFormat(price)
       const next = {
         ...last,
         high: Math.max(last.high, price),
         low: Math.min(last.low, price),
         close: price,
       }

      candleSeriesRef.current.update({
        time: next.time as any,
        open: next.open,
        high: next.high,
        low: next.low,
        close: next.close,
      })
      lastBarRef.current = next

      const candles = candlesRef.current
      const lastIdx = candles.length - 1
      if (lastIdx >= 0 && candles[lastIdx]?.time === next.time) {
        candles[lastIdx] = { ...candles[lastIdx], high: next.high, low: next.low, close: next.close }
      }

      return
    }

    applyPriceFormat(price)

    const next = {
      time: barTime,
      open: last.close,
      high: price,
      low: price,
      close: price,
    }

    candleSeriesRef.current.update({
      time: next.time as any,
      open: next.open,
      high: next.high,
      low: next.low,
      close: next.close,
    })

    lastBarRef.current = next

    candlesRef.current.push({
      time: next.time,
      open: next.open,
      high: next.high,
      low: next.low,
      close: next.close,
      volume: 0,
    })
    setCandlesVersion((v) => v + 1)
  }, [intervalSeconds, ticker?.price, ticker?.timestamp])

  const { ma, bollinger, rsi, macd } = config.ui.indicators

  const indicatorSyncTimerRef = useRef<number | null>(null)

  const clearRsiLines = () => {
    const series = rsiRef.current
    if (!series) return

    for (const line of rsiLinesRef.current) {
      try {
        series.removePriceLine(line)
      } catch {
        // ignore
      }
    }
    rsiLinesRef.current = []
  }

  const applyScaleLayout = () => {
    const chart = chartRef.current
    if (!chart) return

    const clamp = (v: number) => Math.min(0.98, Math.max(0.02, v))
    const makeRegion = (end: number, height: number) => {
      const regionEnd = clamp(end)
      const regionStart = clamp(regionEnd - height)
      if (regionEnd - regionStart < 0.06) return null
      return { start: regionStart, end: regionEnd }
    }

    const TOP = 0.06
    const BOTTOM = 0.04
    const GAP = 0.02
    const OSC_H = 0.18

    let cursorEnd = 1 - BOTTOM

    const macdEnabled = macd && (macdLineRef.current || macdHistRef.current)
    const macdRegion = macdEnabled ? makeRegion(cursorEnd, OSC_H) : null
    if (macdRegion) cursorEnd = macdRegion.start - GAP

    const rsiEnabled = rsi && rsiRef.current
    const rsiRegion = rsiEnabled ? makeRegion(cursorEnd, OSC_H) : null
    if (rsiRegion) cursorEnd = rsiRegion.start - GAP

    const mainEnd = clamp(Math.max(TOP + 0.15, cursorEnd))

    chart.applyOptions({
      rightPriceScale: {
        borderColor: '#1f2a3a',
        scaleMargins: { top: TOP, bottom: clamp(1 - mainEnd) },
      },
    })

    const applyRegionToSeries = (series: any, region: { start: number; end: number } | null) => {
      if (!series || !region) return
      try {
        const scale = series.priceScale?.()
        scale?.applyOptions?.({
          scaleMargins: {
            top: clamp(region.start),
            bottom: clamp(1 - region.end),
          },
          borderVisible: false,
        })
      } catch {
        // ignore
      }
    }

    applyRegionToSeries(rsiRef.current, rsiRegion)
    applyRegionToSeries(macdLineRef.current || macdHistRef.current, macdRegion)
  }

  const syncIndicatorSeries = () => {
    const chart = chartRef.current
    const candles = candlesRef.current
    if (!chart || candles.length === 0) return

    const safeRemove = (series: any) => {
      if (!series) return
      try {
        chart.removeSeries(series)
      } catch {
        // ignore
      }
    }

    if (ma) {
      if (!ema20Ref.current) {
        ema20Ref.current = chart.addLineSeries({
          color: 'rgba(59, 130, 246, 0.9)',
          lineWidth: 2,
          priceScaleId: 'right',
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        })
      }
      if (!ema50Ref.current) {
        ema50Ref.current = chart.addLineSeries({
          color: 'rgba(168, 85, 247, 0.9)',
          lineWidth: 2,
          priceScaleId: 'right',
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        })
      }

      ema20Ref.current.setData(computeEMA(candles, 20) as any)
      ema50Ref.current.setData(computeEMA(candles, 50) as any)
    } else {
      safeRemove(ema20Ref.current)
      safeRemove(ema50Ref.current)
      ema20Ref.current = null
      ema50Ref.current = null
    }

    if (bollinger) {
      if (!bbUpperRef.current) {
        bbUpperRef.current = chart.addLineSeries({
          color: 'rgba(234, 179, 8, 0.8)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceScaleId: 'right',
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        })
      }
      if (!bbMiddleRef.current) {
        bbMiddleRef.current = chart.addLineSeries({
          color: 'rgba(234, 179, 8, 0.7)',
          lineWidth: 1,
          priceScaleId: 'right',
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        })
      }
      if (!bbLowerRef.current) {
        bbLowerRef.current = chart.addLineSeries({
          color: 'rgba(234, 179, 8, 0.8)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceScaleId: 'right',
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        })
      }

      const bb = computeBollinger(candles, 20, 2)
      bbUpperRef.current.setData(bb.upper as any)
      bbMiddleRef.current.setData(bb.middle as any)
      bbLowerRef.current.setData(bb.lower as any)
    } else {
      safeRemove(bbUpperRef.current)
      safeRemove(bbMiddleRef.current)
      safeRemove(bbLowerRef.current)
      bbUpperRef.current = null
      bbMiddleRef.current = null
      bbLowerRef.current = null
    }

    if (rsi) {
      if (!rsiRef.current) {
        rsiRef.current = chart.addLineSeries({
          color: 'rgba(56, 189, 248, 0.9)',
          lineWidth: 2,
          priceScaleId: 'rsi',
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
          }),
        } as any)
      }

      rsiRef.current.setData(computeRSI(candles, 14) as any)

      clearRsiLines()
      rsiLinesRef.current.push(
        rsiRef.current.createPriceLine({
          price: 70,
          color: 'rgba(239, 68, 68, 0.6)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: '70',
        })
      )
      rsiLinesRef.current.push(
        rsiRef.current.createPriceLine({
          price: 30,
          color: 'rgba(34, 197, 94, 0.6)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: '30',
        })
      )
    } else {
      safeRemove(rsiRef.current)
      rsiRef.current = null
      clearRsiLines()
    }

    if (macd) {
      if (!macdHistRef.current) {
        macdHistRef.current = chart.addHistogramSeries({
          priceScaleId: 'macd',
          lastValueVisible: false,
          priceLineVisible: false,
        })
      }
      if (!macdLineRef.current) {
        macdLineRef.current = chart.addLineSeries({
          priceScaleId: 'macd',
          color: 'rgba(244, 114, 182, 0.9)',
          lineWidth: 1,
          lastValueVisible: false,
        })
      }
      if (!macdSignalRef.current) {
        macdSignalRef.current = chart.addLineSeries({
          priceScaleId: 'macd',
          color: 'rgba(148, 163, 184, 0.9)',
          lineWidth: 1,
          lastValueVisible: false,
        })
      }

      const v = computeMACD(candles)
      macdHistRef.current.setData(v.histogram as any)
      macdLineRef.current.setData(v.macd as any)
      macdSignalRef.current.setData(v.signal as any)
    } else {
      safeRemove(macdHistRef.current)
      safeRemove(macdLineRef.current)
      safeRemove(macdSignalRef.current)
      macdHistRef.current = null
      macdLineRef.current = null
      macdSignalRef.current = null
    }

    applyScaleLayout()
  }

  // Throttle indicator recalculation to candle loads / new bars.
  useEffect(() => {
    if (!chartReady) return

    if (indicatorSyncTimerRef.current) {
      window.clearTimeout(indicatorSyncTimerRef.current)
    }

    indicatorSyncTimerRef.current = window.setTimeout(() => {
      syncIndicatorSeries()
    }, 120)

    return () => {
      if (indicatorSyncTimerRef.current) window.clearTimeout(indicatorSyncTimerRef.current)
      indicatorSyncTimerRef.current = null
    }
  }, [bollinger, candlesVersion, chartReady, ma, macd, rsi])

  // Drawing overlay rendering.
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const chart = chartRef.current
    const series = candleSeriesRef.current
    if (!canvas || !container || !chart || !series) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const fns = {
      timeToX: (t: number) => {
        const x = chart.timeScale().timeToCoordinate(t as any)
        return typeof x === 'number' ? x : null
      },
      priceToY: (p: number) => {
        const y = series.priceToCoordinate(p)
        return typeof y === 'number' ? y : null
      },
    }

    const render = () => {
      resize()
      drawAll(ctx, drawings, fns, preview)
    }

    render()

    const timeScale: any = chart.timeScale()
    const onRange = () => render()
    timeScale?.subscribeVisibleTimeRangeChange?.(onRange)

    return () => {
      timeScale?.unsubscribeVisibleTimeRangeChange?.(onRange)
    }
  }, [drawings, preview])

  // Drawing interactions.
  useEffect(() => {
    const canvas = canvasRef.current
    const chart = chartRef.current
    const series = candleSeriesRef.current
    if (!canvas || !chart || !series) return

    const toPoint = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top

      const timeRaw = chart.timeScale().coordinateToTime(x)
      const time = typeof timeRaw === 'number' ? timeRaw : null
      const price = series.coordinateToPrice(y)
      if (time == null || price == null) return null
      return { time: Number(time), price: Number(price), x, y }
    }

    let isDown = false

    const onPointerDown = (e: PointerEvent) => {
      if (tool === 'none') return
      const p = toPoint(e.clientX, e.clientY)
      if (!p) return

      if (tool === 'alert') {
        setAlertDefaultPrice(p.price)
        setAlertModalOpen(true)
        return
      }

      if (tool === 'ray') {
        addDrawing(config.drawingStateId, { id: newId(), type: 'ray', points: [{ time: p.time, price: p.price }], createdAt: Date.now() })
        setTool('none')
        return
      }

      if (tool === 'trendline') {
        if (!pendingPoint) {
          setPendingPoint({ time: p.time, price: p.price })
          setPreview({ type: 'trendline', points: [{ time: p.time, price: p.price }, { time: p.time, price: p.price }] })
          return
        }

        addDrawing(config.drawingStateId, {
          id: newId(),
          type: 'trendline',
          points: [pendingPoint, { time: p.time, price: p.price }],
          createdAt: Date.now(),
        })
        setPendingPoint(null)
        setPreview(null)
        setTool('none')
        return
      }

      if (tool === 'rect' || tool === 'measure') {
        isDown = true
        setPendingPoint({ time: p.time, price: p.price })
        setPreview({ type: 'rect', points: [{ time: p.time, price: p.price }, { time: p.time, price: p.price }] })
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (tool === 'none') return
      if (!pendingPoint) return

      const p = toPoint(e.clientX, e.clientY)
      if (!p) return

      if (tool === 'trendline') {
        setPreview({ type: 'trendline', points: [pendingPoint, { time: p.time, price: p.price }] })
        return
      }

      if (tool === 'rect' || tool === 'measure') {
        setPreview({ type: 'rect', points: [pendingPoint, { time: p.time, price: p.price }] })
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!isDown) return
      isDown = false

      const p = toPoint(e.clientX, e.clientY)
      if (!p || !pendingPoint) {
        setPendingPoint(null)
        setPreview(null)
        return
      }

      if (tool === 'rect') {
        addDrawing(config.drawingStateId, {
          id: newId(),
          type: 'rect',
          points: [pendingPoint, { time: p.time, price: p.price }],
          createdAt: Date.now(),
        })
        setTool('none')
      }

      // measure is ephemeral.
      setPendingPoint(null)
      setPreview(null)
    }

    const onDblClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const hit = hitTestDrawing(drawings, x, y, {
        timeToX: (t) => {
          const v = chart.timeScale().timeToCoordinate(t as any)
          return typeof v === 'number' ? v : null
        },
        priceToY: (p) => {
          const v = series.priceToCoordinate(p)
          return typeof v === 'number' ? v : null
        },
      })

      if (hit) removeDrawing(config.drawingStateId, hit.id)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('dblclick', onDblClick)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('dblclick', onDblClick)
    }
  }, [addDrawing, config.drawingStateId, drawings, pendingPoint, removeDrawing, tool])

  // Keyboard shortcuts for tools
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!selected) return
      if (e.shiftKey && e.code === 'KeyS') {
        e.preventDefault()
        setTool('trendline')
      }
      if (e.shiftKey && e.code === 'KeyD') {
        e.preventDefault()
        setTool('ray')
      }
      if (e.shiftKey && e.code === 'KeyR') {
        e.preventDefault()
        setTool('rect')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selected])

  const toolButton = (label: string, nextTool: DrawingTool) => (
    <button
      type="button"
      className={`w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] ${
        tool === nextTool
          ? 'bg-primary-600 border-primary-500 text-white'
          : 'bg-dark-900/60 border-dark-700 text-dark-300 hover:text-white hover:bg-dark-700'
      }`}
      onClick={() => setTool((t) => (t === nextTool ? 'none' : nextTool))}
      title={label}
    >
      {label}
    </button>
  )

  const indicatorChip = (label: string, key: keyof ChartConfig['ui']['indicators']) => {
    const active = !!config.ui.indicators[key]
    return (
      <button
        type="button"
        className={`px-2 py-1 rounded-md border text-[11px] transition-colors ${
          active ? 'bg-primary-600 border-primary-500 text-white' : 'bg-dark-900/40 border-dark-700 text-dark-300 hover:text-white hover:bg-dark-700'
        }`}
        onClick={() => toggleIndicator(key)}
        title={label}
      >
        {label}
      </button>
    )
  }

  return (
    <div
      className={`bg-dark-800 rounded-xl border overflow-hidden ${selected ? 'border-primary-500' : 'border-dark-700'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-3 py-2 flex items-start justify-between border-b border-dark-700 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{titleLeft}</span>
            <span className="text-xs text-dark-400">{market.contractTag}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs">
            <span className={`font-medium ${typeof effectiveChange === 'number' && effectiveChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              Change: {typeof effectiveChange === 'number' ? `${effectiveChange >= 0 ? '+' : ''}${effectiveChange.toFixed(2)}%` : '—'}
            </span>
            <span className="text-dark-300">NATR(5m,14): {typeof natr === 'number' ? natr.toFixed(2) : '—'}</span>
            <span className="text-dark-300">Vol 24h: {typeof effectiveVol === 'number' ? compact(effectiveVol) : '—'}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {indicatorChip('MA', 'ma')}
            {indicatorChip('BB', 'bollinger')}
            {indicatorChip('RSI', 'rsi')}
            {indicatorChip('MACD', 'macd')}
          </div>
        </div>

        <div className="flex items-start gap-2 shrink-0">
          <button
            type="button"
            className="w-9 h-9 rounded-lg bg-dark-900/40 border border-dark-700 hover:bg-dark-700 transition-colors flex items-center justify-center"
            title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
            onClick={() => toggleWatchlist(config.marketId)}
          >
            <Star className={`w-4 h-4 ${isWatchlisted ? 'text-yellow-500' : 'text-dark-300'}`} fill={isWatchlisted ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            className="w-9 h-9 rounded-lg bg-dark-900/40 border border-dark-700 hover:bg-dark-700 transition-colors text-dark-200"
            title="Focus"
            onClick={onOpenFocus}
          >
            ⤢
          </button>
        </div>
      </div>

      <div
        className="relative"
        onMouseDown={(e: ReactMouseEvent) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            onOpenFocus()
            return
          }
          onSelect()
        }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800/60 z-10">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800/60 z-10">
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        <div ref={containerRef} style={{ height }} />

        {/* Drawing canvas overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ pointerEvents: tool === 'none' ? 'none' : 'auto' }}
        />

        {/* Hover toolbar */}
        {hovered && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
            {toolButton('Alert', 'alert')}
            {toolButton('TL', 'trendline')}
            {toolButton('Ray', 'ray')}
            {toolButton('Rect', 'rect')}
            {toolButton('Meas', 'measure')}
          </div>
        )}
      </div>

      <PriceAlertModal
        isOpen={alertModalOpen}
        market={market}
        defaultPrice={alertDefaultPrice}
        onClose={() => {
          setAlertModalOpen(false)
          setTool('none')
        }}
      />
    </div>
  )
}
