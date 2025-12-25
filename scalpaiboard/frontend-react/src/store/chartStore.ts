import { create } from 'zustand'
import type { Candle } from '../types'

type CandleCacheEntry = {
  candles: Candle[]
  fetchedAt: number
}

type ChartStore = {
  candleCache: Record<string, CandleCacheEntry>
  setCandles: (key: string, candles: Candle[]) => void
  getCandles: (key: string, maxAgeMs: number) => Candle[] | null
}

export const useChartStore = create<ChartStore>((set, get) => ({
  candleCache: {},

  setCandles: (key, candles) => {
    set((state) => ({
      candleCache: {
        ...state.candleCache,
        [key]: { candles, fetchedAt: Date.now() },
      },
    }))
  },

  getCandles: (key, maxAgeMs) => {
    const entry = get().candleCache[key]
    if (!entry) return null
    if (Date.now() - entry.fetchedAt > maxAgeMs) return null
    return entry.candles
  },
}))
