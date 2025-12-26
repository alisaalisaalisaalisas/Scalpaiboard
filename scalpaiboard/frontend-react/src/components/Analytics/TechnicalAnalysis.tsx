import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { getCoinAnalysis } from '../../services/api'
import { useCoinStore } from '../../store/coinStore'
import type { CoinAnalysis } from '../../types'

const INTERVALS = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
]

const formatNumber = (value: number, digits = 2) => {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export default function TechnicalAnalysis() {
  const { coins, fetchCoins, loading } = useCoinStore()

  const [symbol, setSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState('1h')

  const [analysis, setAnalysis] = useState<CoinAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (coins.length === 0 && !loading) {
      fetchCoins(1, 200)
    }
  }, [coins.length, fetchCoins, loading])

  useEffect(() => {
    if (coins.length === 0) return
    if (coins.some((c) => c.symbol === symbol)) return
    setSymbol(coins[0].symbol)
  }, [coins, symbol])

  const selectedCoin = useMemo(() => coins.find((c) => c.symbol === symbol) || null, [coins, symbol])

  const fetchAnalysis = async () => {
    setAnalysisLoading(true)
    setError(null)

    try {
      const data = await getCoinAnalysis(symbol, interval, 300)
      setAnalysis(data)
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load analysis')
      setAnalysis(null)
    } finally {
      setAnalysisLoading(false)
    }
  }

  useEffect(() => {
    void fetchAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval])

  const rsiLabel = useMemo(() => {
    const v = analysis?.rsi?.value
    if (typeof v !== 'number') return null
    if (v >= 70) return { text: 'Overbought', color: 'text-red-400' }
    if (v <= 30) return { text: 'Oversold', color: 'text-green-400' }
    return { text: 'Neutral', color: 'text-dark-300' }
  }, [analysis?.rsi?.value])

  const macdLabel = useMemo(() => {
    const h = analysis?.macd?.histogram
    if (typeof h !== 'number') return null
    if (h > 0) return { text: 'Bullish momentum', color: 'text-green-400' }
    if (h < 0) return { text: 'Bearish momentum', color: 'text-red-400' }
    return { text: 'Flat momentum', color: 'text-dark-300' }
  }, [analysis?.macd?.histogram])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Technical Analysis</h1>
          <p className="text-dark-400 text-sm">RSI, MACD, Bollinger Bands, moving averages, pivots</p>
        </div>

        <button
          type="button"
          onClick={() => void fetchAnalysis()}
          className="px-3 py-2 text-sm bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 transition-colors flex items-center gap-2"
          disabled={analysisLoading}
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${analysisLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-dark-400 mb-1">Coin</label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
          >
            {coins.map((c) => (
              <option key={c.symbol} value={c.symbol}>
                {c.symbol} — {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-dark-400 mb-1">Timeframe</label>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
          >
            {INTERVALS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
          <div className="text-sm text-dark-400">Last price</div>
          <div className="text-xl text-white font-mono">
            ${analysis ? formatNumber(analysis.lastClose, analysis.lastClose < 1 ? 6 : 2) : '—'}
          </div>
          <div className="text-xs text-dark-400 mt-1">
            {selectedCoin ? `${selectedCoin.name} (${selectedCoin.symbol})` : symbol}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/40 text-red-400 rounded-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-white font-semibold">RSI</div>
            {rsiLabel && <div className={`text-xs ${rsiLabel.color}`}>{rsiLabel.text}</div>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-dark-400">Value</div>
              <div className="text-lg text-white font-mono">{analysis ? formatNumber(analysis.rsi.value, 2) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-dark-400">Period</div>
              <div className="text-lg text-white font-mono">{analysis ? analysis.rsi.period : '—'}</div>
            </div>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-white font-semibold">MACD</div>
            {macdLabel && <div className={`text-xs ${macdLabel.color}`}>{macdLabel.text}</div>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-dark-400">MACD</div>
              <div className="text-lg text-white font-mono">{analysis ? formatNumber(analysis.macd.macd, 4) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-dark-400">Signal</div>
              <div className="text-lg text-white font-mono">{analysis ? formatNumber(analysis.macd.signal, 4) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-dark-400">Hist</div>
              <div className="text-lg text-white font-mono">{analysis ? formatNumber(analysis.macd.histogram, 4) : '—'}</div>
            </div>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="text-white font-semibold">Bollinger Bands</div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-dark-400">Upper</div>
              <div className="text-lg text-white font-mono">{analysis ? formatNumber(analysis.bollinger.upper, 2) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-dark-400">Lower</div>
              <div className="text-lg text-white font-mono">{analysis ? formatNumber(analysis.bollinger.lower, 2) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-dark-400">Middle</div>
              <div className="text-lg text-white font-mono">{analysis ? formatNumber(analysis.bollinger.middle, 2) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-dark-400">StdDev</div>
              <div className="text-lg text-white font-mono">{analysis ? formatNumber(analysis.bollinger.stdDev, 4) : '—'}</div>
            </div>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="text-white font-semibold">Moving Averages</div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-dark-400">SMA</div>
              <div className="text-sm text-dark-400 mt-2 space-y-1">
                {analysis ? (
                  Object.entries(analysis.sma).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-dark-300">{k.replace('p', '')}</span>
                      <span className="text-white font-mono">{formatNumber(v, 2)}</span>
                    </div>
                  ))
                ) : (
                  <div>—</div>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-dark-400">EMA</div>
              <div className="text-sm text-dark-400 mt-2 space-y-1">
                {analysis ? (
                  Object.entries(analysis.ema).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-dark-300">{k.replace('p', '')}</span>
                      <span className="text-white font-mono">{formatNumber(v, 2)}</span>
                    </div>
                  ))
                ) : (
                  <div>—</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 lg:col-span-2">
          <div className="text-white font-semibold">Support / Resistance</div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-dark-400">Recent high</div>
              <div className="text-lg text-white font-mono">{analysis ? formatNumber(analysis.supportResistance.recentHigh, 2) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-dark-400">Recent low</div>
              <div className="text-lg text-white font-mono">{analysis ? formatNumber(analysis.supportResistance.recentLow, 2) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-dark-400">Pivot</div>
              <div className="text-lg text-white font-mono">{analysis ? formatNumber(analysis.supportResistance.pivots.pivot, 2) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-dark-400">Lookback</div>
              <div className="text-lg text-white font-mono">{analysis ? analysis.supportResistance.lookback : '—'}</div>
            </div>
          </div>

          {analysis && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-dark-900/40 border border-dark-700 rounded-lg p-3">
                <div className="text-xs text-dark-400">R1</div>
                <div className="text-white font-mono">{formatNumber(analysis.supportResistance.pivots.r1, 2)}</div>
              </div>
              <div className="bg-dark-900/40 border border-dark-700 rounded-lg p-3">
                <div className="text-xs text-dark-400">R2</div>
                <div className="text-white font-mono">{formatNumber(analysis.supportResistance.pivots.r2, 2)}</div>
              </div>
              <div className="bg-dark-900/40 border border-dark-700 rounded-lg p-3">
                <div className="text-xs text-dark-400">S1</div>
                <div className="text-white font-mono">{formatNumber(analysis.supportResistance.pivots.s1, 2)}</div>
              </div>
              <div className="bg-dark-900/40 border border-dark-700 rounded-lg p-3">
                <div className="text-xs text-dark-400">S2</div>
                <div className="text-white font-mono">{formatNumber(analysis.supportResistance.pivots.s2, 2)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
