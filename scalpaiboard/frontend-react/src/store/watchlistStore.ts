import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type WatchlistState = {
  marketIds: string[]
  has: (marketId: string) => boolean
  toggle: (marketId: string) => void
  add: (marketId: string) => void
  remove: (marketId: string) => void
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      marketIds: [],

      has: (marketId) => get().marketIds.includes(marketId),

      add: (marketId) => {
        set((state) => {
          if (state.marketIds.includes(marketId)) return state
          return { marketIds: [marketId, ...state.marketIds] }
        })
      },

      remove: (marketId) => {
        set((state) => ({ marketIds: state.marketIds.filter((id) => id !== marketId) }))
      },

      toggle: (marketId) => {
        const { has, add, remove } = get()
        if (has(marketId)) remove(marketId)
        else add(marketId)
      },
    }),
    {
      name: 'scalpaiboard-watchlist-v1',
      partialize: (state) => ({ marketIds: state.marketIds }),
    }
  )
)
