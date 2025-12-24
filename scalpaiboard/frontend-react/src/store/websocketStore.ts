import { create } from 'zustand'
import { TickerUpdate } from '../types'

interface WebSocketState {
  socket: WebSocket | null
  connected: boolean
  prices: Map<string, TickerUpdate>
  
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

  connect: (url: string) => {
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
      setTimeout(() => {
        if (!get().connected) {
          get().connect(url)
        }
      }, 3000)
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  },

  disconnect: () => {
    const { socket } = get()
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
