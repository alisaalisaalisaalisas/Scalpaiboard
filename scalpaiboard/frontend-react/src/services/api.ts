import axios from 'axios'
import { Coin, Candle, Alert, WatchlistItem, AIProvider, PaginatedResponse, Orderbook } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add auth token to requests if available
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ========== Coins ==========

export const getCoins = async (page = 1, limit = 50, sortBy = 'volume24h', sortOrder = 'desc'): Promise<PaginatedResponse<Coin>> => {
  const response = await client.get('/api/coins', {
    params: { page, limit, sortBy, sortOrder }
  })
  return response.data
}

export const getCoin = async (symbol: string): Promise<Coin> => {
  const response = await client.get(`/api/coins/${symbol}`)
  return response.data
}

export const getCandles = async (symbol: string, interval = '1h', limit = 100): Promise<Candle[]> => {
  const response = await client.get(`/api/coins/${symbol}/candles`, {
    params: { interval, limit }
  })
  return response.data.candles
}

export const getOrderbook = async (symbol: string, limit = 20): Promise<Orderbook> => {
  const response = await client.get(`/api/coins/${symbol}/orderbook`, {
    params: { limit }
  })
  return response.data
}

// ========== Watchlist ==========

export const getWatchlist = async (): Promise<WatchlistItem[]> => {
  const response = await client.get('/api/watchlist')
  return response.data
}

export const addToWatchlist = async (coinId: number, symbol?: string): Promise<void> => {
  await client.post('/api/watchlist', { coinId, symbol })
}

export const removeFromWatchlist = async (coinId: number): Promise<void> => {
  await client.delete(`/api/watchlist/${coinId}`)
}

// ========== Alerts ==========

export const getAlerts = async (): Promise<Alert[]> => {
  const response = await client.get('/api/alerts')
  return response.data
}

export const createAlert = async (alert: {
  coinId: number
  conditionType: string
  conditionValue: number
  notificationType?: string
}): Promise<Alert> => {
  const response = await client.post('/api/alerts', alert)
  return response.data
}

export const updateAlert = async (id: number, updates: Partial<Alert>): Promise<Alert> => {
  const response = await client.put(`/api/alerts/${id}`, updates)
  return response.data
}

export const deleteAlert = async (id: number): Promise<void> => {
  await client.delete(`/api/alerts/${id}`)
}

// ========== AI ==========

export const getAIProviders = async (): Promise<{ configured: AIProvider[], available: any[] }> => {
  const response = await client.get('/api/ai/providers')
  return response.data
}

export const addAIProvider = async (provider: {
  providerType: string
  providerName: string
  apiKey: string
  modelName: string
  maxTokens?: number
  temperature?: number
  isDefault?: boolean
}): Promise<void> => {
  await client.post('/api/ai/providers', provider)
}

export const testAIProvider = async (id: number): Promise<{ status: string, message: string }> => {
  const response = await client.post(`/api/ai/providers/${id}/test`)
  return response.data
}

export const sendAIMessage = async (message: string, providerId?: number, conversationId?: string): Promise<ReadableStream> => {
  const response = await fetch(`${API_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ message, providerId, conversationId })
  })
  return response.body!
}
