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

export interface CoinAnalysis {
  symbol: string
  interval: string
  limit: number
  lastClose: number

  rsi: {
    value: number
    period: number
  }

  macd: {
    macd: number
    signal: number
    histogram: number
    fastPeriod: number
    slowPeriod: number
    signalPeriod: number
  }

  bollinger: {
    middle: number
    upper: number
    lower: number
    stdDev: number
    period: number
    stdMult: number
  }

  sma: Record<string, number>
  ema: Record<string, number>

  supportResistance: {
    recentHigh: number
    recentLow: number
    pivots: {
      pivot: number
      r1: number
      r2: number
      s1: number
      s2: number
    }
    lookback: number
  }
}

// ===== Terminal market models =====
export type MarketType = 'Spot' | 'Perpetual' | 'Delivery' | 'Index'

export interface MarketItem {
  marketId: string
  coinId?: number
  symbol: string
  base: string
  quote: string

  exchange: 'binance' | 'bybit' | 'okx' | string
  exchangeTag: 'BI' | 'BY' | 'OK' | string

  marketType: MarketType
  contractTag: string

  wsStreamId?: string

  pricePrecision?: number
  qtyPrecision?: number
  tickSize?: string
  lotSize?: string
  fundingIntervalSec?: number | null

  isActive: boolean
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D' | '1W'

export interface ChartConfig {
  chartId: string
  marketId: string
  symbol: string
  exchange: string
  marketType: MarketType

  timeframe: Timeframe
  timeframeMode: 'global' | 'override'

  ui: {
    indicators: {
      ma: boolean
      bollinger: boolean
      pivots: boolean
      rsi: boolean
      macd: boolean
    }
    showDrawings: boolean
  }

  drawingStateId: string
  watchlisted: boolean
}

export interface MarketMetrics {
  marketId: string
  price: number
  changeTodayPct: number
  volume24h: number
  natr5m14: number
}

export type AlertCondition = 'above' | 'below' | 'cross'
