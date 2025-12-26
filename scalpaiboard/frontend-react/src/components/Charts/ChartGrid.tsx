import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts'
import { getCandles } from '../../services/api'
import { useChartStore } from '../../store/chartStore'
import { useWebSocketStore } from '../../store/websocketStore'

import { Candle } from '../../types'

const CHART_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'ADAUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'AVAXUSDT',
  'DOTUSDT',
  'LINKUSDT',
  'MATICUSDT',
  'ARBUSDT',
]

const CHART_HEIGHT = 340

type IndicatorState = {
  rsi: boolean
  macd: boolean
  bollinger: boolean
  ma: boolean
  pivots: boolean
}

type PivotLevels = {
  pivot: number
  r1: number
  r2: number
  s1: number
  s2: number
}

const formatCompact = (value: number) => {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const computeEMA = (candles: Candle[], period: number) => {
  if (candles.length < period) return []

  const multiplier = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i += 1) sum += candles[i].close
  let ema = sum / period

  const points: { time: any; value: number }[] = []
  points.push({ time: candles[period - 1].time as any, value: ema })

  for (let i = period; i < candles.length; i += 1) {
    ema = (candles[i].close - ema) * multiplier + ema
    points.push({ time: candles[i].time as any, value: ema })
  }

  return points
}

const computeBollinger = (candles: Candle[], period = 20, mult = 2) => {
  if (candles.length < period) {
    return { upper: [], middle: [], lower: [] }
  }

  let sum = 0
  let sumSq = 0
  const upper: { time: any; value: number }[] = []
  const middle: { time: any; value: number }[] = []
  const lower: { time: any; value: number }[] = []

  for (let i = 0; i < candles.length; i += 1) {
    const v = candles[i].close
    sum += v
    sumSq += v * v

    if (i >= period) {
      const removed = candles[i - period].close
      sum -= removed
      sumSq -= removed * removed
    }

    if (i >= period - 1) {
      const mean = sum / period
      const variance = Math.max(0, sumSq / period - mean * mean)
      const std = Math.sqrt(variance)
      const u = mean + mult * std
      const l = mean - mult * std
      const time = candles[i].time as any
      upper.push({ time, value: u })
      middle.push({ time, value: mean })
      lower.push({ time, value: l })
    }
  }

  return { upper, middle, lower }
}

const computeRSI = (candles: Candle[], period = 14) => {
  if (candles.length < period + 1) return []

  let gainSum = 0
  let lossSum = 0

  for (let i = 1; i <= period; i += 1) {
    const delta = candles[i].close - candles[i - 1].close
    if (delta >= 0) gainSum += delta
    else lossSum += -delta
  }

  let avgGain = gainSum / period
  let avgLoss = lossSum / period

  const points: { time: any; value: number }[] = []

  const rsiAt = (g: number, l: number) => {
    if (l === 0) return 100
    const rs = g / l
    return 100 - 100 / (1 + rs)
  }

  points.push({ time: candles[period].time as any, value: rsiAt(avgGain, avgLoss) })

  for (let i = period + 1; i < candles.length; i += 1) {
    const delta = candles[i].close - candles[i - 1].close
    const gain = delta > 0 ? delta : 0
    const loss = delta < 0 ? -delta : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    points.push({ time: candles[i].time as any, value: rsiAt(avgGain, avgLoss) })
  }

  return points
}

const computeMACD = (candles: Candle[], fast = 12, slow = 26, signal = 9) => {
  if (candles.length < slow + signal) {
    return { macd: [], signal: [], histogram: [] }
  }

  const emaFast = computeEMA(candles, fast)
  const emaSlow = computeEMA(candles, slow)

  const byTimeFast = new Map<number, number>()
  for (const p of emaFast) byTimeFast.set(Number(p.time), p.value)

  const macdLine: { time: any; value: number }[] = []
  for (const p of emaSlow) {
    const t = Number(p.time)
    const f = byTimeFast.get(t)
    if (typeof f !== 'number') continue
    macdLine.push({ time: p.time, value: f - p.value })
  }

  const macdCandles = macdLine.map((p) => ({ time: Number(p.time), close: p.value }))
  const signalLineRaw = computeEMA(macdCandles as any, signal)

  const byTimeSignal = new Map<number, number>()
  for (const p of signalLineRaw) byTimeSignal.set(Number(p.time), p.value)

  const signalLine: { time: any; value: number }[] = []
  const histogram: { time: any; value: number; color: string }[] = []

  for (const p of macdLine) {
    const t = Number(p.time)
    const s = byTimeSignal.get(t)
    if (typeof s !== 'number') continue
    signalLine.push({ time: p.time, value: s })
    const h = p.value - s
    histogram.push({
      time: p.time,
      value: h,
      color: h >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)',
    })
  }

  return { macd: macdLine, signal: signalLine, histogram }
}

const computePivots = (candles: Candle[], lookback = 24): PivotLevels | null => {
  if (candles.length < 5) return null

  const slice = candles.length >= lookback + 1 ? candles.slice(-lookback - 1, -1) : candles.slice(0, -1)
  if (slice.length < 5) return null

  let high = -Infinity
  let low = Infinity
  for (const c of slice) {
    if (c.high > high) high = c.high
    if (c.low < low) low = c.low
  }

  const close = slice[slice.length - 1]?.close
  if (!Number.isFinite(high) || !Number.isFinite(low) || typeof close !== 'number') return null

  const pivot = (high + low + close) / 3
  const r1 = 2 * pivot - low
  const s1 = 2 * pivot - high
  const r2 = pivot + (high - low)
  const s2 = pivot - (high - low)

  return { pivot, r1, r2, s1, s2 }
}

export default function ChartGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {CHART_SYMBOLS.map((symbol) => (
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

  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const ema50Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null)
  const pivotLinesRef = useRef<any[]>([])

  const rsiRef = useRef<ISeriesApi<'Line'> | null>(null)
  const rsiLinesRef = useRef<any[]>([])

  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null)
  const macdSignalRef = useRef<ISeriesApi<'Line'> | null>(null)

  const [indicators, setIndicators] = useState<IndicatorState>({
    rsi: false,
    macd: false,
    bollinger: false,
    ma: false,
    pivots: false,
  })


  const [loading, setLoading] = useState(() => !useChartStore.getState().getCandles(cacheKey, 5 * 60 * 1000))
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const priceData = useWebSocketStore((state) => state.getPrice(symbol))
  const price = priceData?.price ? parseFloat(priceData.price) : 0
  const change = priceData?.change24h ? parseFloat(priceData.change24h) : 0

  const applyScaleLayout = () => {
    const chart = chartRef.current
    if (!chart) return

    // Keep a fixed chart height so cards don't resize/reflow in the grid.
    // Volume is on by default; RSI/MACD add extra sub-panels.
    const TOP = 0.05
    const BOTTOM = 0.03
    const GAP = 0.02
    const OSC_H = 0.16

    const clamp = (v: number) => Math.min(0.98, Math.max(0.02, v))

    const makeRegion = (end: number, height: number) => {
      const regionEnd = clamp(end)
      const regionStart = clamp(regionEnd - height)
      if (regionEnd - regionStart < 0.06) return null
      return { start: regionStart, end: regionEnd }
    }

    let cursorEnd = 1 - BOTTOM

    const macdEnabled = indicators.macd && (macdLineRef.current || macdHistRef.current)
    const macdRegion = macdEnabled ? makeRegion(cursorEnd, OSC_H) : null
    if (macdRegion) cursorEnd = macdRegion.start - GAP

    const rsiEnabled = indicators.rsi && rsiRef.current
    const rsiRegion = rsiEnabled ? makeRegion(cursorEnd, OSC_H) : null
    if (rsiRegion) cursorEnd = rsiRegion.start - GAP

    const mainEnd = clamp(Math.max(TOP + 0.15, cursorEnd))

    chart.applyOptions({
      rightPriceScale: {
        borderColor: '#334155',
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

  const clearPivotLines = () => {
    const candleSeries = candleSeriesRef.current
    if (!candleSeries) return

    for (const line of pivotLinesRef.current) {
      try {
        candleSeries.removePriceLine(line)
      } catch {
        // ignore
      }
    }
    pivotLinesRef.current = []
  }

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

  const syncIndicatorSeries = () => {
    const chart = chartRef.current
    const candles = candlesRef.current
    const candleSeries = candleSeriesRef.current
    if (!chart || !candleSeries || candles.length === 0) return

    if (indicators.ma) {
      if (!ema20Ref.current) {
        ema20Ref.current = chart.addLineSeries({
          color: 'rgba(59, 130, 246, 0.9)',
          lineWidth: 2,
          priceScaleId: 'right',
        })
      }
      if (!ema50Ref.current) {
        ema50Ref.current = chart.addLineSeries({
          color: 'rgba(168, 85, 247, 0.9)',
          lineWidth: 2,
          priceScaleId: 'right',
        })
      }

      ema20Ref.current.setData(computeEMA(candles, 20))
      ema50Ref.current.setData(computeEMA(candles, 50))
    } else {
      if (ema20Ref.current) chart.removeSeries(ema20Ref.current)
      if (ema50Ref.current) chart.removeSeries(ema50Ref.current)
      ema20Ref.current = null
      ema50Ref.current = null
    }

    if (indicators.bollinger) {
      if (!bbUpperRef.current) {
        bbUpperRef.current = chart.addLineSeries({
          color: 'rgba(234, 179, 8, 0.8)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceScaleId: 'right',
        })
      }
      if (!bbMiddleRef.current) {
        bbMiddleRef.current = chart.addLineSeries({
          color: 'rgba(234, 179, 8, 0.7)',
          lineWidth: 1,
          priceScaleId: 'right',
        })
      }
      if (!bbLowerRef.current) {
        bbLowerRef.current = chart.addLineSeries({
          color: 'rgba(234, 179, 8, 0.8)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceScaleId: 'right',
        })
      }

      const bb = computeBollinger(candles, 20, 2)
      bbUpperRef.current.setData(bb.upper)
      bbMiddleRef.current.setData(bb.middle)
      bbLowerRef.current.setData(bb.lower)
    } else {
      if (bbUpperRef.current) chart.removeSeries(bbUpperRef.current)
      if (bbMiddleRef.current) chart.removeSeries(bbMiddleRef.current)
      if (bbLowerRef.current) chart.removeSeries(bbLowerRef.current)
      bbUpperRef.current = null
      bbMiddleRef.current = null
      bbLowerRef.current = null
    }

    if (indicators.pivots) {
      clearPivotLines()

      const pivots = computePivots(candles, 24)
      if (pivots) {
        const add = (price: number, color: string, title: string) => {
          const line = candleSeries.createPriceLine({
            price,
            color,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title,
          })
          pivotLinesRef.current.push(line)
        }

        add(pivots.pivot, 'rgba(148, 163, 184, 0.85)', 'P')
        add(pivots.r1, 'rgba(34, 197, 94, 0.85)', 'R1')
        add(pivots.r2, 'rgba(34, 197, 94, 0.65)', 'R2')
        add(pivots.s1, 'rgba(239, 68, 68, 0.85)', 'S1')
        add(pivots.s2, 'rgba(239, 68, 68, 0.65)', 'S2')
      }
    } else {
      clearPivotLines()
    }

    if (indicators.rsi) {
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

      rsiRef.current.setData(computeRSI(candles, 14))

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
      if (rsiRef.current) chart.removeSeries(rsiRef.current)
      rsiRef.current = null
      clearRsiLines()
    }

    if (indicators.macd) {
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

      const macd = computeMACD(candles)
      macdHistRef.current.setData(macd.histogram as any)
      macdLineRef.current.setData(macd.macd as any)
      macdSignalRef.current.setData(macd.signal as any)
    } else {
      if (macdHistRef.current) chart.removeSeries(macdHistRef.current)
      if (macdLineRef.current) chart.removeSeries(macdLineRef.current)
      if (macdSignalRef.current) chart.removeSeries(macdSignalRef.current)
      macdHistRef.current = null
      macdLineRef.current = null
      macdSignalRef.current = null
    }

    applyScaleLayout()
  }

  useEffect(() => {
    if (!containerRef.current) return

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
      height: CHART_HEIGHT,
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

      if (from <= oldest.time + intervalSeconds * 20) {
        loadMoreCandlesRef.current()
      }
    }

    timeScale?.subscribeVisibleTimeRangeChange?.(onVisibleRangeChange)

    void loadCandles()

    return () => {
      window.removeEventListener('resize', handleResize)
      timeScale?.unsubscribeVisibleTimeRangeChange?.(onVisibleRangeChange)
      chart.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    syncIndicatorSeries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators])

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
        syncIndicatorSeries()
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
      syncIndicatorSeries()
    } catch {
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

    syncIndicatorSeries()
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
    } catch {
      // ignore
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
      const updated = [...candlesRef.current, { time: next.time, open: next.open, high: next.high, low: next.low, close: next.close, volume: 0 }]
      candlesRef.current = updated
      useChartStore.getState().setCandles(cacheKey, updated)
      syncIndicatorSeries()
    }
  }, [cacheKey, intervalSeconds, priceData?.price, priceData?.timestamp])

  const toggle = (key: keyof IndicatorState) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleButtonClass = (active: boolean) =>
    `px-2 py-1 text-[11px] rounded-md border transition-colors shrink-0 whitespace-nowrap ${
      active
        ? 'bg-primary-600 border-primary-500 text-white'
        : 'bg-dark-900/40 border-dark-700 text-dark-300 hover:text-white hover:bg-dark-700'
    }`

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      <div className="px-4 py-3 flex items-start justify-between border-b border-dark-700 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{symbol.replace('USDT', '')}</span>
            <span className="text-xs text-dark-400">/USDT</span>
          </div>
          <div
            className="mt-2 flex items-center gap-2 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            <button type="button" className={toggleButtonClass(indicators.ma)} onClick={() => toggle('ma')}>
              MA
            </button>
            <button
              type="button"
              className={toggleButtonClass(indicators.bollinger)}
              onClick={() => toggle('bollinger')}
            >
              BB
            </button>
            <button
              type="button"
              className={toggleButtonClass(indicators.pivots)}
              onClick={() => toggle('pivots')}
            >
              Pivots
            </button>
            <button type="button" className={toggleButtonClass(indicators.rsi)} onClick={() => toggle('rsi')}>
              RSI
            </button>
            <button type="button" className={toggleButtonClass(indicators.macd)} onClick={() => toggle('macd')}>
              MACD
            </button>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-mono font-medium">${formatCompact(price)}</div>
          <div className={`text-xs font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}%
          </div>
        </div>
      </div>

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
        <div ref={containerRef} style={{ height: CHART_HEIGHT }} />
      </div>
    </div>
  )
}
