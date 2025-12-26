import { create } from 'zustand'

export type MarketTicker = {
  marketId: string
  symbol: string
  exchange: string
  marketType: string
  price: number
  change24h: number
  volume24h: number
  timestamp: number
}

type TerminalTickerState = {
  socket: WebSocket | null
  connected: boolean
  tickers: Map<string, MarketTicker>

  connect: (url: string) => void
  disconnect: () => void
  subscribe: (marketIds: string[]) => void
  unsubscribe: (marketIds: string[]) => void
  getTicker: (marketId: string) => MarketTicker | undefined
}

export const useTerminalTickerStore = create<TerminalTickerState>((set, get) => ({
  socket: null,
  connected: false,
  tickers: new Map(),

  connect: (url) => {
    const existing = get().socket
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return

    const socket = new WebSocket(url)

    socket.onopen = () => {
      set({ socket, connected: true })
    }

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg?.type !== 'ticker') return
        const marketId = String(msg.marketId || '')
        if (!marketId) return

        const ticker: MarketTicker = {
          marketId,
          symbol: String(msg.symbol || ''),
          exchange: String(msg.exchange || ''),
          marketType: String(msg.marketType || ''),
          price: Number(msg.price || 0),
          change24h: Number(msg.change24h || 0),
          volume24h: Number(msg.volume24h || 0),
          timestamp: Number(msg.timestamp || 0),
        }

        set((state) => {
          const next = new Map(state.tickers)
          next.set(marketId, ticker)
          return { tickers: next }
        })
      } catch {
        // ignore
      }
    }

    socket.onclose = () => {
      set({ socket: null, connected: false })
      // reconnect is driven by callers (avoid tight loops)
    }

    socket.onerror = () => {
      // ignore
    }
  },

  disconnect: () => {
    const socket = get().socket
    if (socket) socket.close()
    set({ socket: null, connected: false })
  },

  subscribe: (marketIds) => {
    const socket = get().socket
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'subscribe', markets: marketIds }))
  },

  unsubscribe: (marketIds) => {
    const socket = get().socket
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'unsubscribe', markets: marketIds }))
  },

  getTicker: (marketId) => get().tickers.get(marketId),
}))
