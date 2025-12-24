import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts'
import { getCandles } from '../../services/api'
import { useWebSocketStore } from '../../store/websocketStore'
import { Candle } from '../../types'

const CHART_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT',
  'ADAUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT',
  'DOTUSDT', 'LINKUSDT', 'MATICUSDT', 'ARBUSDT'
]

export default function ChartGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {CHART_SYMBOLS.map(symbol => (
        <ChartCard key={symbol} symbol={symbol} />
      ))}
    </div>
  )
}

function ChartCard({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const priceData = useWebSocketStore(state => state.getPrice(symbol))
  const price = priceData?.price ? parseFloat(priceData.price) : 0
  const change = priceData?.change24h ? parseFloat(priceData.change24h) : 0

  useEffect(() => {
    if (!containerRef.current) return

    // Create chart
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#1e293b' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      width: containerRef.current.clientWidth,
      height: 200,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#334155',
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
      crosshair: {
        mode: 0,
      },
    })

    chartRef.current = chart

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#dc2626',
      borderUpColor: '#16a34a',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    })

    candleSeriesRef.current = candleSeries

    // Handle resize
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    // Load initial data
    loadCandles()

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  async function loadCandles() {
    try {
      setLoading(true)
      const candles = await getCandles(symbol, '1h', 100)
      
      if (candleSeriesRef.current && candles.length > 0) {
        const formattedData = candles.map((c: Candle) => ({
          time: c.time as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
        candleSeriesRef.current.setData(formattedData)
        chartRef.current?.timeScale().fitContent()
      }
      setLoading(false)
    } catch (err) {
      setError('Failed to load')
      setLoading(false)
    }
  }

  return (
    <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-dark-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{symbol.replace('USDT', '')}</span>
          <span className="text-xs text-dark-400">/USDT</span>
        </div>
        <div className="text-right">
          <div className="font-mono font-medium">
            ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800/80 z-10">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-dark-800/80 z-10">
            <span className="text-red-500 text-sm">{error}</span>
          </div>
        )}
        <div ref={containerRef} className="h-[200px]" />
      </div>
    </div>
  )
}
