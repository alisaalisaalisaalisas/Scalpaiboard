import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type DrawingTool = 'none' | 'trendline' | 'ray' | 'rect' | 'measure' | 'alert'

export type DrawingPoint = {
  time: number
  price: number
}

export type Drawing = {
  id: string
  type: 'trendline' | 'ray' | 'rect'
  points: DrawingPoint[]
  createdAt: number
}

type DrawingsState = {
  byStateId: Record<string, Drawing[]>

  getDrawings: (drawingStateId: string) => Drawing[]
  setDrawings: (drawingStateId: string, drawings: Drawing[]) => void
  addDrawing: (drawingStateId: string, drawing: Drawing) => void
  removeDrawing: (drawingStateId: string, drawingId: string) => void
  upsertDrawing: (drawingStateId: string, drawing: Drawing) => void
}

export const useDrawingsStore = create<DrawingsState>()(
  persist(
    (set, get) => ({
      byStateId: {},

      getDrawings: (drawingStateId) => get().byStateId[drawingStateId] || [],

      setDrawings: (drawingStateId, drawings) => set((s) => ({ byStateId: { ...s.byStateId, [drawingStateId]: drawings } })),

      addDrawing: (drawingStateId, drawing) => {
        set((s) => ({
          byStateId: {
            ...s.byStateId,
            [drawingStateId]: [...(s.byStateId[drawingStateId] || []), drawing],
          },
        }))
      },

      removeDrawing: (drawingStateId, drawingId) => {
        set((s) => ({
          byStateId: {
            ...s.byStateId,
            [drawingStateId]: (s.byStateId[drawingStateId] || []).filter((d) => d.id !== drawingId),
          },
        }))
      },

      upsertDrawing: (drawingStateId, drawing) => {
        set((s) => {
          const list = s.byStateId[drawingStateId] || []
          const idx = list.findIndex((d) => d.id === drawing.id)
          const next = idx === -1 ? [...list, drawing] : [...list.slice(0, idx), drawing, ...list.slice(idx + 1)]
          return { byStateId: { ...s.byStateId, [drawingStateId]: next } }
        })
      },
    }),
    {
      name: 'scalpaiboard-drawings-v1',
      partialize: (state) => ({ byStateId: state.byStateId }),
    }
  )
)

export const newId = () => {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now() + Math.random())
}
