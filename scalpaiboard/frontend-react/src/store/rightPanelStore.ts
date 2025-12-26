import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RightPanelKey = 'chat' | null

type RightPanelState = {
  activePanel: RightPanelKey
  setActivePanel: (panel: RightPanelKey) => void
  openChat: () => void
  toggleChat: () => void
  close: () => void
}

export const useRightPanelStore = create<RightPanelState>()(
  persist(
    (set, get) => ({
      activePanel: 'chat',

      setActivePanel: (panel) => set({ activePanel: panel }),
      openChat: () => set({ activePanel: 'chat' }),
      toggleChat: () => set({ activePanel: get().activePanel === 'chat' ? null : 'chat' }),
      close: () => set({ activePanel: null }),
    }),
    {
      name: 'scalpaiboard-right-panel',
      version: 3,
      migrate: (persisted: any) => {
        const panel = persisted?.activePanel
        if (panel === 'markets' || panel === 'search') return { ...persisted, activePanel: 'chat' }
        if (panel === 'chat' || panel === null) return persisted
        return { ...persisted, activePanel: 'chat' }
      },
      partialize: (state) => ({ activePanel: state.activePanel }),
    }
  )
)
