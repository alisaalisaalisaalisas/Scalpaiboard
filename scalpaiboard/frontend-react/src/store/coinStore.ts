import { create } from 'zustand'
import { Coin } from '../types'
import * as api from '../services/api'

interface CoinState {
  coins: Coin[]
  loading: boolean
  error: string | null
  selectedSymbol: string | null
  
  fetchCoins: (page?: number, limit?: number) => Promise<void>
  selectCoin: (symbol: string) => void
}

export const useCoinStore = create<CoinState>((set) => ({
  coins: [],
  loading: false,
  error: null,
  selectedSymbol: null,

  fetchCoins: async (page = 1, limit = 50) => {
    set({ loading: true, error: null })
    try {
      const response = await api.getCoins(page, limit)
      set({ coins: response.data, loading: false })
    } catch (error) {
      set({ error: 'Failed to fetch coins', loading: false })
    }
  },

  selectCoin: (symbol: string) => {
    set({ selectedSymbol: symbol })
  }
}))
