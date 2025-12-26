import { create } from 'zustand'

import type { MarketMetrics } from '../types'
import { getMarketMetrics } from '../services/api'

type MetricsEntry = {
  data: MarketMetrics
  fetchedAt: number
}

type MarketMetricsState = {
  byMarketId: Record<string, MetricsEntry>
  inFlight: Record<string, boolean>

  get: (marketId: string) => MarketMetrics | null
  ensure: (marketId: string) => Promise<void>
  ensureMany: (marketIds: string[]) => void
}

const MAX_AGE_MS = 30_000

export const useMarketMetricsStore = create<MarketMetricsState>((set, get) => ({
  byMarketId: {},
  inFlight: {},

  get: (marketId) => {
    const entry = get().byMarketId[marketId]
    if (!entry) return null
    if (Date.now() - entry.fetchedAt > MAX_AGE_MS) return null
    return entry.data
  },

  ensure: async (marketId) => {
    if (!marketId) return

    const existing = get().byMarketId[marketId]
    if (existing && Date.now() - existing.fetchedAt <= MAX_AGE_MS) return

    if (get().inFlight[marketId]) return
    set((s) => ({ inFlight: { ...s.inFlight, [marketId]: true } }))

    try {
      const data = await getMarketMetrics(marketId)
      set((s) => ({
        byMarketId: { ...s.byMarketId, [marketId]: { data, fetchedAt: Date.now() } },
      }))
    } finally {
      set((s) => {
        const next = { ...s.inFlight }
        delete next[marketId]
        return { inFlight: next }
      })
    }
  },

  ensureMany: (marketIds) => {
    // Avoid awaiting; each call dedupes inFlight.
    for (const id of marketIds) void get().ensure(id)
  },
}))
