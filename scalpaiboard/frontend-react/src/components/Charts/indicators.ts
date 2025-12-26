import type { Candle } from '../../types'

export type LinePoint = { time: any; value: number }
export type HistogramPoint = { time: any; value: number; color?: string }

export const computeEMA = (candles: Candle[], period: number): LinePoint[] => {
  if (candles.length < period) return []

  const multiplier = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i += 1) sum += candles[i].close
  let ema = sum / period

  const points: LinePoint[] = []
  points.push({ time: candles[period - 1].time as any, value: ema })

  for (let i = period; i < candles.length; i += 1) {
    ema = (candles[i].close - ema) * multiplier + ema
    points.push({ time: candles[i].time as any, value: ema })
  }

  return points
}

export const computeBollinger = (candles: Candle[], period = 20, mult = 2) => {
  if (candles.length < period) {
    return { upper: [] as LinePoint[], middle: [] as LinePoint[], lower: [] as LinePoint[] }
  }

  let sum = 0
  let sumSq = 0
  const upper: LinePoint[] = []
  const middle: LinePoint[] = []
  const lower: LinePoint[] = []

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
      const time = candles[i].time as any
      upper.push({ time, value: mean + mult * std })
      middle.push({ time, value: mean })
      lower.push({ time, value: mean - mult * std })
    }
  }

  return { upper, middle, lower }
}

export const computeRSI = (candles: Candle[], period = 14): LinePoint[] => {
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

  const rsiAt = (g: number, l: number) => {
    if (l === 0) return 100
    const rs = g / l
    return 100 - 100 / (1 + rs)
  }

  const points: LinePoint[] = []
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

export const computeMACD = (candles: Candle[], fast = 12, slow = 26, signal = 9) => {
  if (candles.length < slow + signal) {
    return { macd: [] as LinePoint[], signal: [] as LinePoint[], histogram: [] as HistogramPoint[] }
  }

  const emaFast = computeEMA(candles, fast)
  const emaSlow = computeEMA(candles, slow)

  const byTimeFast = new Map<number, number>()
  for (const p of emaFast) byTimeFast.set(Number(p.time), p.value)

  const macdLine: LinePoint[] = []
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

  const signalLine: LinePoint[] = []
  const histogram: HistogramPoint[] = []

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
