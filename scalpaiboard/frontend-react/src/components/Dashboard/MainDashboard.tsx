import { useEffect, useState } from 'react'
import { useCoinStore } from '../../store/coinStore'
import { useWebSocketStore } from '../../store/websocketStore'
import ChartGrid from '../Charts/ChartGrid'
import CoinsTable from '../Screener/CoinsTable'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

export default function MainDashboard() {
  const { coins, loading, fetchCoins } = useCoinStore()
  const { prices, connected } = useWebSocketStore()
  const [activeTab, setActiveTab] = useState<'charts' | 'table'>('charts')

  useEffect(() => {
    fetchCoins()
  }, [fetchCoins])

  // Calculate market summary
  const marketSummary = {
    totalCoins: coins.length,
    gainers: coins.filter(c => (prices.get(c.symbol)?.change24h || c.change24h) > 0).length,
    losers: coins.filter(c => (prices.get(c.symbol)?.change24h || c.change24h) < 0).length
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-dark-700 bg-dark-800">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">Market Overview</h1>
          
          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-dark-400">{connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>

        {/* Market Summary */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-dark-400" />
            <span className="text-dark-400">{marketSummary.totalCoins} coins</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-500">
            <TrendingUp className="w-4 h-4" />
            <span>{marketSummary.gainers} gainers</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-red-500">
            <TrendingDown className="w-4 h-4" />
            <span>{marketSummary.losers} losers</span>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex bg-dark-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('charts')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'charts' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white'
            }`}
          >
            Charts
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'table' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white'
            }`}
          >
            Table
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : activeTab === 'charts' ? (
          <ChartGrid />
        ) : (
          <CoinsTable coins={coins} />
        )}
      </div>
    </div>
  )
}
