import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { MarketItem } from '../types'
import { getMarkets } from '../services/api'

export type MarketSortKey = 'volume24h' | 'natr' | 'change'
export type SortDir = 'asc' | 'desc'

type MarketFilters = {
  query: string
  exchange: string | 'all'
  type: string | 'all'
}

type TerminalMarketState = {
  markets: MarketItem[]
  loading: boolean
  error: string | null

  filters: MarketFilters
  sortKey: MarketSortKey
  sortDir: SortDir
  watchlistOnly: boolean

  fetchAll: () => Promise<void>
  setQuery: (query: string) => void
  setExchange: (exchange: string | 'all') => void
  setType: (type: string | 'all') => void
  setSort: (key: MarketSortKey) => void
  toggleSortDir: () => void
  toggleWatchlistOnly: () => void
}

export const useTerminalMarketStore = create<TerminalMarketState>()(
  persist(
    (set) => ({
      markets: [],
      loading: false,
      error: null,

      filters: { query: '', exchange: 'all', type: 'all' },
      sortKey: 'volume24h',
      sortDir: 'desc',
      watchlistOnly: false,

      fetchAll: async () => {
        set({ loading: true, error: null })
        try {
          const data = await getMarkets()
          set({ markets: data, loading: false })
        } catch (e: any) {
          set({ error: e?.message || 'Failed to load markets', loading: false })
        }
      },

      setQuery: (query) => set((state) => ({ filters: { ...state.filters, query } })),
      setExchange: (exchange) => set((state) => ({ filters: { ...state.filters, exchange } })),
      setType: (type) => set((state) => ({ filters: { ...state.filters, type } })),

      setSort: (key) => set({ sortKey: key }),
      toggleSortDir: () => set((s) => ({ sortDir: s.sortDir === 'asc' ? 'desc' : 'asc' })),
      toggleWatchlistOnly: () => set((s) => ({ watchlistOnly: !s.watchlistOnly })),
    }),
    {
      name: 'scalpaiboard-terminal-market-settings-v1',
      partialize: (state) => ({
        filters: state.filters,
        sortKey: state.sortKey,
        sortDir: state.sortDir,
        watchlistOnly: state.watchlistOnly,
      }),
    }
  )
)
