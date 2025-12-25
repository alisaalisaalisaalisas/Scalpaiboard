import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, Bell, ChevronDown, ChevronUp, Star } from 'lucide-react'
import { useWebSocketStore } from '../../store/websocketStore'
import { useAuthStore } from '../../store/authStore'
import { addToWatchlist, getWatchlist, removeFromWatchlist } from '../../services/api'
import { Coin } from '../../types'


interface CoinsTableProps {
  coins: Coin[]
}

type SortField = 'symbol' | 'price' | 'change24h' | 'volume24h'
type SortOrder = 'asc' | 'desc'

export default function CoinsTable({ coins }: CoinsTableProps) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  const [sortField, setSortField] = useState<SortField>('volume24h')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [search, setSearch] = useState('')

  const prices = useWebSocketStore((state) => state.prices)

  const [watchlistCoinIds, setWatchlistCoinIds] = useState<Set<number>>(new Set())
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [watchlistMutatingCoinId, setWatchlistMutatingCoinId] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setWatchlistCoinIds(new Set())
      return
    }

    let cancelled = false

    const loadWatchlist = async () => {
      setWatchlistLoading(true)
      try {
        const items = await getWatchlist()
        if (cancelled) return
        setWatchlistCoinIds(new Set(items.map((i) => i.coinId)))
      } catch (error) {
        if (!cancelled) console.error('Failed to load watchlist:', error)
      } finally {
        if (!cancelled) setWatchlistLoading(false)
      }
    }

    loadWatchlist()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const handleToggleWatchlist = async (coin: Coin) => {
    if (!isAuthenticated) {
      window.alert('Please sign in to use the watchlist.')
      return
    }

    const isInWatchlist = watchlistCoinIds.has(coin.id)

    setWatchlistMutatingCoinId(coin.id)
    try {
      if (isInWatchlist) {
        await removeFromWatchlist(coin.id)
        setWatchlistCoinIds((prev) => {
          const next = new Set(prev)
          next.delete(coin.id)
          return next
        })
      } else {
        await addToWatchlist(coin.id, coin.symbol)
        setWatchlistCoinIds((prev) => {
          const next = new Set(prev)
          next.add(coin.id)
          return next
        })
      }
    } catch (error) {
      console.error('Failed to update watchlist:', error)
    } finally {
      setWatchlistMutatingCoinId(null)
    }
  }

  const handleCreateAlert = (coin: Coin) => {
    if (!isAuthenticated) {
      window.alert('Please sign in to create alerts.')
      return
    }

    navigate('/alerts', {
      state: {
        openCreateModal: true,
        coinId: coin.id,
      },
    })
  }


  // Enrich coins with real-time data
  const enrichedCoins = useMemo(() => {
    return coins.map(coin => {
      const wsData = prices.get(coin.symbol)
      return {
        ...coin,
        price: wsData?.price ? parseFloat(wsData.price) : coin.price,
        change24h: wsData?.change24h ? parseFloat(wsData.change24h) : coin.change24h,
        volume24h: wsData?.volume24h ? parseFloat(wsData.volume24h) : coin.volume24h,
      }
    })
  }, [coins, prices])

  // Filter and sort
  const sortedCoins = useMemo(() => {
    let filtered = enrichedCoins
    
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = enrichedCoins.filter(c => 
        c.symbol.toLowerCase().includes(searchLower) ||
        c.name?.toLowerCase().includes(searchLower)
      )
    }

    return [...filtered].sort((a, b) => {
      const aVal = a[sortField] || 0
      const bVal = b[sortField] || 0
      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })
  }, [enrichedCoins, sortField, sortOrder, search])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-dark-500" />
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 text-primary-500" /> : <ChevronDown className="w-4 h-4 text-primary-500" />
  }


  return (
    <div className="card">
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search coins..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th 
                className="cursor-pointer hover:text-white"
                onClick={() => handleSort('symbol')}
              >
                <div className="flex items-center gap-2">
                  Symbol
                  <SortIcon field="symbol" />
                </div>
              </th>
              <th 
                className="cursor-pointer hover:text-white text-right"
                onClick={() => handleSort('price')}
              >
                <div className="flex items-center gap-2 justify-end">
                  Price
                  <SortIcon field="price" />
                </div>
              </th>
              <th 
                className="cursor-pointer hover:text-white text-right"
                onClick={() => handleSort('change24h')}
              >
                <div className="flex items-center gap-2 justify-end">
                  24h Change
                  <SortIcon field="change24h" />
                </div>
              </th>
              <th 
                className="cursor-pointer hover:text-white text-right"
                onClick={() => handleSort('volume24h')}
              >
                <div className="flex items-center gap-2 justify-end">
                  Volume
                  <SortIcon field="volume24h" />
                </div>
              </th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCoins.map((coin, index) => (
              <tr key={coin.id} className="hover:bg-dark-700/50">
                <td className="text-dark-400">{index + 1}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center text-xs font-bold">
                      {coin.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium">{coin.symbol.replace('USDT', '')}</div>
                      <div className="text-xs text-dark-400">{coin.name || coin.symbol}</div>
                    </div>
                  </div>
                </td>
                <td className="text-right font-mono">
                  ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </td>
                <td className={`text-right font-medium ${coin.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                </td>
                <td className="text-right text-dark-300">
                  ${(coin.volume24h / 1e6).toFixed(2)}M
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className="p-2 hover:bg-dark-600 rounded-lg transition-colors disabled:opacity-50"
                      title={isAuthenticated ? (watchlistCoinIds.has(coin.id) ? 'Remove from watchlist' : 'Add to watchlist') : 'Sign in to use watchlist'}
                      onClick={() => handleToggleWatchlist(coin)}
                      disabled={watchlistLoading || watchlistMutatingCoinId === coin.id}
                    >
                      <Star
                        className={`w-4 h-4 ${watchlistCoinIds.has(coin.id) ? 'text-yellow-500' : 'text-dark-400 hover:text-yellow-500'}`}
                        fill={watchlistCoinIds.has(coin.id) ? 'currentColor' : 'none'}
                      />
                    </button>
                    <button
                      className="p-2 hover:bg-dark-600 rounded-lg transition-colors"
                      title={isAuthenticated ? 'Create alert' : 'Sign in to create alerts'}
                      onClick={() => handleCreateAlert(coin)}
                    >
                      <Bell className="w-4 h-4 text-dark-400 hover:text-primary-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
