import React, { useState, useEffect } from 'react';
import { getWatchlist, removeFromWatchlist } from '../../services/api';
import { useWebSocketStore } from '../../store/websocketStore';
import { useAuthStore } from '../../store/authStore';

interface WatchlistCoin {
  id: number;
  coinId: number;
  symbol: string;
  name?: string;
  addedAt: string;
  // Enriched from WebSocket
  price?: number;
  change24h?: number;
  volume24h?: number;
}

export const WatchlistPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { subscribe, unsubscribe, getPrice } = useWebSocketStore();

  const [watchlist, setWatchlist] = useState<WatchlistCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadWatchlist();
    }
  }, [isAuthenticated]);

  // Subscribe to price updates for watchlist coins
  useEffect(() => {
    const symbols = watchlist.map(w => w.symbol);
    if (symbols.length > 0) {
      subscribe(symbols);
    }
    
    return () => {
      if (symbols.length > 0) {
        unsubscribe(symbols);
      }
    };
  }, [watchlist, subscribe, unsubscribe]);

  const loadWatchlist = async () => {
    try {
      const data = await getWatchlist();
      setWatchlist(data);
    } catch (error) {
      console.error('Failed to load watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (coinId: number) => {
    setRemoving(coinId);
    try {
      await removeFromWatchlist(coinId);
      setWatchlist(prev => prev.filter(w => w.coinId !== coinId));
    } catch (error) {
      console.error('Failed to remove from watchlist:', error);
    } finally {
      setRemoving(null);
    }
  };

  // Enrich watchlist with live prices
  const enrichedWatchlist = watchlist.map((item) => {
    const priceData = getPrice(item.symbol);

    const price = priceData?.price ? Number.parseFloat(priceData.price) : item.price;
    const change24h = priceData?.change24h ? Number.parseFloat(priceData.change24h) : item.change24h;
    const volume24h = priceData?.volume24h ? Number.parseFloat(priceData.volume24h) : item.volume24h;

    return {
      ...item,
      price: Number.isFinite(price) ? price : undefined,
      change24h: Number.isFinite(change24h) ? change24h : undefined,
      volume24h: Number.isFinite(volume24h) ? volume24h : undefined,
    };
  });


  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 p-4 rounded-lg">
          Please sign in to view your watchlist.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Watchlist</h1>
        <p className="text-gray-400">Track your favorite coins with real-time prices</p>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading...</div>
      ) : enrichedWatchlist.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <div className="text-6xl mb-4">⭐</div>
          <h3 className="text-xl font-semibold text-white mb-2">Your watchlist is empty</h3>
          <p className="text-gray-400">
            Click the star icon on any coin to add it to your watchlist.
          </p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-sm">
                <th className="text-left p-4">Coin</th>
                <th className="text-right p-4">Price</th>
                <th className="text-right p-4">24h Change</th>
                <th className="text-right p-4">Volume</th>
                <th className="text-right p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrichedWatchlist.map((coin) => (
                <tr
                  key={coin.id}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        {coin.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-white">{coin.symbol}</div>
                        {coin.name && <div className="text-sm text-gray-400">{coin.name}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="text-right p-4">
                    <span className="text-white font-medium">
                      ${coin.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) || '—'}
                    </span>
                  </td>
                  <td className="text-right p-4">
                    {coin.change24h !== undefined ? (
                      <span className={coin.change24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="text-right p-4">
                    <span className="text-gray-300">
                      ${(coin.volume24h || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </td>
                  <td className="text-right p-4">
                    <button
                      onClick={() => handleRemove(coin.coinId)}
                      disabled={removing === coin.coinId}
                      className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                      title="Remove from watchlist"
                    >
                      {removing === coin.coinId ? (
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
