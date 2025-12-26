import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { ChartConfig, MarketItem, Timeframe } from '../types'

export type GridLayout = '1x1' | '2x2' | '3x3' | '4x4' | '5x5' | '6x6'

const layoutToSize = (layout: GridLayout) => {
  const [r, c] = layout.split('x').map((v) => Number.parseInt(v, 10))
  return { rows: r, cols: c, size: r * c }
}

const DEFAULT_TIMEFRAME: Timeframe = '1h'

const chartIdForIndex = (idx: number) => `tile-${String(idx).padStart(2, '0')}`

const buildDefaultConfig = (chartId: string, market: MarketItem, globalTimeframe: Timeframe): ChartConfig => {
  const timeframe = globalTimeframe
  return {
    chartId,
    marketId: market.marketId,
    symbol: market.symbol,
    exchange: market.exchange,
    marketType: market.marketType,
    timeframe,
    timeframeMode: 'global',
    ui: {
      showDrawings: true,
      indicators: { ma: false, bollinger: false, pivots: false, rsi: false, macd: false },
    },
    drawingStateId: `${market.marketId}:${timeframe}`,
    watchlisted: false,
  }
}

type TerminalChartState = {
  layout: GridLayout
  page: number
  globalTimeframe: Timeframe

  selectedChartId: string

  focus: {
    open: boolean
    kind: 'market' | 'tile'
    marketId: string | null
    chartId: string | null
  }

  charts: Record<string, ChartConfig>

  focusTimeframes: Record<string, Timeframe>
  setFocusTimeframe: (marketId: string, tf: Timeframe) => void
  getFocusTimeframe: (marketId: string) => Timeframe | null

  setLayout: (layout: GridLayout) => void
  setPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void

  setSelectedChartId: (chartId: string) => void

  setGlobalTimeframe: (tf: Timeframe) => void
  setChartTimeframeOverride: (chartId: string, tf: Timeframe | null) => void

  setChartMarket: (chartId: string, market: MarketItem) => void
  applyMarketsToGrid: (markets: MarketItem[]) => void

  toggleIndicator: (chartId: string, key: keyof ChartConfig['ui']['indicators']) => void

  openFocusMarket: (marketId: string) => void
  openFocusFromTile: (chartId: string) => void
  closeFocus: () => void
}

export const useTerminalChartStore = create<TerminalChartState>()(
  persist(
    (set, get) => ({
      layout: '4x4',
      page: 0,
      globalTimeframe: DEFAULT_TIMEFRAME,

      selectedChartId: 'tile-00',

      focus: { open: false, kind: 'market', marketId: null, chartId: null },

      charts: {},

      focusTimeframes: {},
      setFocusTimeframe: (marketId, tf) => {
        if (!marketId) return
        set((s) => ({ focusTimeframes: { ...s.focusTimeframes, [marketId]: tf } }))
      },
      getFocusTimeframe: (marketId) => {
        if (!marketId) return null
        return get().focusTimeframes[marketId] || null
      },

      setLayout: (layout) => {
        set({ layout })

        const { size } = layoutToSize(layout)
        const globalTimeframe = get().globalTimeframe
        const existing = get().charts

        const nextCharts: Record<string, ChartConfig> = {}
        for (let i = 0; i < size; i += 1) {
          const id = chartIdForIndex(i)
          const prev = existing[id]
          if (prev) nextCharts[id] = prev
        }

        set({ charts: nextCharts, selectedChartId: nextCharts[get().selectedChartId] ? get().selectedChartId : 'tile-00' })

        // If charts are empty, caller should applyMarketsToGrid.
        void globalTimeframe
      },

      setPage: (page) => set({ page: Math.max(0, page) }),
      nextPage: () => set((s) => ({ page: s.page + 1 })),
      prevPage: () => set((s) => ({ page: Math.max(0, s.page - 1) })),

      setSelectedChartId: (chartId) => set({ selectedChartId: chartId }),

      setGlobalTimeframe: (tf) => {
        set({ globalTimeframe: tf })
        const charts = get().charts
        const next: Record<string, ChartConfig> = {}
        for (const [id, cfg] of Object.entries(charts)) {
          // No per-tile timeframe UI right now; treat timeframe as global.
          next[id] = { ...cfg, timeframeMode: 'global', timeframe: tf, drawingStateId: `${cfg.marketId}:${tf}` }
        }
        set({ charts: next })
      },

      setChartTimeframeOverride: (chartId, tf) => {
        const charts = get().charts
        const cfg = charts[chartId]
        if (!cfg) return

        if (!tf) {
          const globalTf = get().globalTimeframe
          set({
            charts: {
              ...charts,
              [chartId]: { ...cfg, timeframeMode: 'global', timeframe: globalTf, drawingStateId: `${cfg.marketId}:${globalTf}` },
            },
          })
          return
        }

        set({
          charts: {
            ...charts,
            [chartId]: { ...cfg, timeframeMode: 'override', timeframe: tf, drawingStateId: `${cfg.marketId}:${tf}` },
          },
        })
      },

      setChartMarket: (chartId, market) => {
        const charts = get().charts
        const globalTf = get().globalTimeframe
        const prev = charts[chartId]
        const tf = prev?.timeframeMode === 'override' ? prev.timeframe : globalTf
        const nextCfg: ChartConfig = {
          ...(prev || buildDefaultConfig(chartId, market, globalTf)),
          marketId: market.marketId,
          symbol: market.symbol,
          exchange: market.exchange,
          marketType: market.marketType,
          timeframe: tf,
          drawingStateId: `${market.marketId}:${tf}`,
        }
        set({ charts: { ...charts, [chartId]: nextCfg } })
      },

      applyMarketsToGrid: (markets) => {
        const { size } = layoutToSize(get().layout)
        const globalTf = get().globalTimeframe
        const charts = { ...get().charts }

        for (let i = 0; i < size; i += 1) {
          const market = markets[i]
          if (!market) break
          const id = chartIdForIndex(i)
          const prev = charts[id]
          if (!prev) {
            charts[id] = buildDefaultConfig(id, market, globalTf)
            continue
          }

          // Replace market but preserve UI toggles and timeframe override.
          const tf = prev.timeframeMode === 'override' ? prev.timeframe : globalTf
          charts[id] = {
            ...prev,
            marketId: market.marketId,
            symbol: market.symbol,
            exchange: market.exchange,
            marketType: market.marketType,
            timeframe: tf,
            drawingStateId: `${market.marketId}:${tf}`,
          }
        }

        set({ charts })
      },

      toggleIndicator: (chartId, key) => {
        const cfg = get().charts[chartId]
        if (!cfg) return
        set({
          charts: {
            ...get().charts,
            [chartId]: {
              ...cfg,
              ui: {
                ...cfg.ui,
                indicators: { ...cfg.ui.indicators, [key]: !cfg.ui.indicators[key] },
              },
            },
          },
        })
      },

      openFocusMarket: (marketId) => set({ focus: { open: true, kind: 'market', marketId, chartId: null } }),
      openFocusFromTile: (chartId) => {
        const cfg = get().charts[chartId]
        set({ focus: { open: true, kind: 'tile', marketId: cfg?.marketId ?? null, chartId } })
      },
      closeFocus: () => set({ focus: { open: false, kind: 'market', marketId: null, chartId: null } }),
    }),
    {
      name: 'scalpaiboard-terminal-charts-v1',
      version: 3,
      migrate: (persisted: any) => {
        return {
          ...persisted,
          focus: { open: false, kind: 'market', marketId: null, chartId: null },
          focusTimeframes: persisted?.focusTimeframes || {},
        }
      },
      partialize: (state) => ({
        layout: state.layout,
        page: state.page,
        globalTimeframe: state.globalTimeframe,
        selectedChartId: state.selectedChartId,
        charts: state.charts,
        focus: state.focus,
        focusTimeframes: state.focusTimeframes,
      }),
    }
  )
)

export const getLayoutSize = (layout: GridLayout) => layoutToSize(layout)
export const getChartIdForIndex = chartIdForIndex
