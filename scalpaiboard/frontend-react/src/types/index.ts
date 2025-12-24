// Coin types
export interface Coin {
  id: number
  symbol: string
  name: string
  exchange: string
  price: number
  change24h: number
  volume24h: number
  high24h: number
  low24h: number
  marketCap?: number
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Alert types
export interface Alert {
  id: number
  coinId: number
  coinSymbol: string
  conditionType: string
  conditionValue: number
  notificationType: string
  isActive: boolean
  triggeredCount: number
  lastTriggeredAt?: string
  createdAt: string
}

export interface AlertHistory {
  id: number
  alertId: number
  triggeredAt: string
  notificationStatus: string
  notificationChannel: string
  errorMessage?: string
}

// Watchlist types
export interface WatchlistItem {
  id: number
  coinId: number
  symbol: string
  addedAt: string
  price?: number
  change24h?: number
  volume24h?: number
}

// AI types
export interface AIProvider {
  id: number
  providerName: string
  providerType: string
  modelName: string
  isActive: boolean
  isDefault: boolean
  maxTokens: number
  temperature: number
  monthlyBudget?: number
  monthlySpent: number
}

export interface AIMessage {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  tokensUsed?: number
  cost?: number
  createdAt: string
}

export interface AIConversation {
  id: string
  title: string
  messages: AIMessage[]
  providerId?: number
  createdAt: string
}

// WebSocket message types
export interface TickerUpdate {
  type: 'ticker'
  symbol: string
  price: string
  change24h: string
  volume24h: string
  high24h: string
  low24h: string
  timestamp: number
}

// API response types
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// Orderbook types
export interface Orderbook {
  symbol: string
  bids: [string, string][]
  asks: [string, string][]
  timestamp: number
}
