import { create } from 'zustand'
import { TickerUpdate } from '../types'

interface WebSocketState {
  socket: WebSocket | null
  connected: boolean
  prices: Map<string, TickerUpdate>

  reconnectEnabled: boolean
  lastUrl: string | null

  connect: (url: string) => void
  disconnect: () => void
  subscribe: (symbols: string[]) => void
  unsubscribe: (symbols: string[]) => void
  getPrice: (symbol: string) => TickerUpdate | undefined
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  socket: null,
  connected: false,
  prices: new Map(),

  reconnectEnabled: false,
  lastUrl: null,

  connect: (url: string) => {
    const existing = get().socket
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return
    }

    set({ reconnectEnabled: true, lastUrl: url })
    const socket = new WebSocket(url)

    socket.onopen = () => {
      console.log('WebSocket connected')
      set({ socket, connected: true })
      
      // Subscribe to default symbols
      const defaultSymbols = [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 
        'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT',
        'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'ARBUSDT'
      ]
      get().subscribe(defaultSymbols)
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TickerUpdate
        if (data.type === 'ticker' && data.symbol) {
          set(state => {
            const newPrices = new Map(state.prices)
            newPrices.set(data.symbol, data)
            return { prices: newPrices }
          })
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    socket.onclose = () => {
      console.log('WebSocket disconnected')
      set({ socket: null, connected: false })
      
      // Attempt reconnection after 3 seconds
      if (get().reconnectEnabled) {
        setTimeout(() => {
          const nextUrl = get().lastUrl
          if (!get().reconnectEnabled || !nextUrl) return
          if (!get().connected) {
            get().connect(nextUrl)
          }
        }, 3000)
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  },

  disconnect: () => {
    const { socket } = get()
    set({ reconnectEnabled: false, lastUrl: null })
    if (socket) {
      socket.close()
      set({ socket: null, connected: false })
    }
  },

  subscribe: (symbols: string[]) => {
    const { socket } = get()
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'subscribe',
        symbols
      }))
    }
  },

  unsubscribe: (symbols: string[]) => {
    const { socket } = get()
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'unsubscribe',
        symbols
      }))
    }
  },

  getPrice: (symbol: string) => {
    return get().prices.get(symbol)
  }
}))
