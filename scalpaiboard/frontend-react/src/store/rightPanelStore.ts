import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RightPanelKey = 'chat' | 'markets' | null

type RightPanelState = {
  activePanel: RightPanelKey
  setActivePanel: (panel: RightPanelKey) => void
  openChat: () => void
  openMarkets: () => void
  toggleChat: () => void
  toggleMarkets: () => void
  close: () => void
}

export const useRightPanelStore = create<RightPanelState>()(
  persist(
    (set, get) => ({
      activePanel: 'chat',

      setActivePanel: (panel) => set({ activePanel: panel }),
      openChat: () => set({ activePanel: 'chat' }),
      openMarkets: () => set({ activePanel: 'markets' }),
      toggleChat: () => set({ activePanel: get().activePanel === 'chat' ? null : 'chat' }),
      toggleMarkets: () => set({ activePanel: get().activePanel === 'markets' ? null : 'markets' }),
      close: () => set({ activePanel: null }),
    }),
    {
      name: 'scalpaiboard-right-panel',
      version: 2,
      migrate: (persisted: any) => {
        const panel = persisted?.activePanel
        if (panel === 'search') return { ...persisted, activePanel: 'markets' }
        if (panel === 'chat' || panel === 'markets' || panel === null) return persisted
        return { ...persisted, activePanel: 'chat' }
      },
      partialize: (state) => ({ activePanel: state.activePanel }),
    }
  )
)
