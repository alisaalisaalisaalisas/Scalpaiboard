import axios from 'axios'
import { Coin, Candle, Alert, WatchlistItem, AIProvider, PaginatedResponse, Orderbook } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

const getStoredAuthToken = (): string | null => {
  const persisted = localStorage.getItem('scalpaiboard-auth')
  if (persisted) {
    try {
      const parsed = JSON.parse(persisted)
      const token = parsed?.state?.token
      if (typeof token === 'string' && token.length > 0) return token
    } catch {
      // ignore
    }
  }

  return localStorage.getItem('token')
}

// Add auth token to requests if available
client.interceptors.request.use((config) => {
  const token = getStoredAuthToken()
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

export const getCandles = async (
  symbol: string,
  interval = '1h',
  limit = 100,
  endTime?: number
): Promise<Candle[]> => {
  const response = await client.get(`/api/coins/${symbol}/candles`, {
    params: {
      interval,
      limit,
      ...(typeof endTime === 'number' ? { endTime } : {}),
    }
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

export const updateAIProvider = async (
  id: number,
  updates: {
    providerName?: string
    apiKey?: string
    modelName?: string
    maxTokens?: number
    temperature?: number
    isActive?: boolean
    isDefault?: boolean
    monthlyBudget?: number
  }
): Promise<void> => {
  await client.put(`/api/ai/providers/${id}`, updates)
}

export type AIProviderModelDetail = {
  id: string
  contextLength?: number
}

export const getProviderModelsById = async (id: number): Promise<string[]> => {
  const data = await getProviderModelsByIdDetailed(id)
  return data.models
}

export const getProviderModelsByIdDetailed = async (
  id: number
): Promise<{ models: string[]; details: AIProviderModelDetail[] }> => {
  try {
    const response = await client.get(`/api/ai/providers/${id}/models`)
    return {
      models: response.data.models || [],
      details: response.data.details || [],
    }
  } catch (error: any) {
    // Backwards-compatible fallback if backend hasn't been restarted/updated yet.
    if (error?.response?.status === 404) {
      const data = await getAIProviders()
      const configured = data.configured || []
      const provider = configured.find((p: any) => p.id === id)
      const providerType = provider?.providerType
      const available = (data.available || []).find((p: any) => p.type === providerType)
      return { models: available?.models || [], details: [] }
    }
    throw error
  }
}


export const testAIProvider = async (id: number): Promise<{ status: string, message: string }> => {
  const response = await client.post(`/api/ai/providers/${id}/test`)
  return response.data
}

export const deleteAIProvider = async (id: number): Promise<void> => {
  await client.delete(`/api/ai/providers/${id}`)
}

export const fetchProviderModels = async (providerType: string, apiKey: string): Promise<string[]> => {
  const response = await client.post('/api/ai/providers/fetch-models', { providerType, apiKey })
  return response.data.models
}

export const fetchProviderModelsDetailed = async (
  providerType: string,
  apiKey: string
): Promise<{ models: string[]; details: AIProviderModelDetail[] }> => {
  const response = await client.post('/api/ai/providers/fetch-models', { providerType, apiKey })
  return {
    models: response.data.models || [],
    details: response.data.details || [],
  }
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

// Default export for auth store
export default client
