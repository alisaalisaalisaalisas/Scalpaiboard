import { type ReactNode } from 'react'
import { Bot, X } from 'lucide-react'

import AIChat from '../AIChat/ChatInterface'
import { useRightPanelStore } from '../../store/rightPanelStore'

function DockButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-9 h-9 rounded-lg border transition-colors flex items-center justify-center ${
        active
          ? 'bg-primary-600 border-primary-500 text-white'
          : 'bg-dark-800 hover:bg-dark-700 border-dark-700 text-dark-300 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function PanelShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="h-full min-h-0 flex flex-col bg-dark-900">
      <div className="h-14 px-4 flex items-center justify-between border-b border-dark-700">
        <div className="font-medium text-sm text-white">{title}</div>
        <button
          type="button"
          className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          title="Close"
          onClick={onClose}
        >
          <X className="w-4 h-4 text-dark-300" />
        </button>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  )
}

export default function RightDock() {
  const activePanel = useRightPanelStore((s) => s.activePanel)
  const toggleChat = useRightPanelStore((s) => s.toggleChat)
  const close = useRightPanelStore((s) => s.close)

  return (
    <div className="border-l border-dark-700 hidden lg:flex h-full min-h-0">
      <div className="w-12 h-full flex flex-col items-center pt-3 gap-2 bg-dark-900">
        <DockButton active={activePanel === 'chat'} title="AI Assistant" onClick={toggleChat}>
          <Bot className="w-4 h-4" />
        </DockButton>
      </div>

      {activePanel === 'chat' && (
        <div className="w-[400px] h-full min-h-0">
          <PanelShell title="AI Assistant" onClose={close}>
            <AIChat />
          </PanelShell>
        </div>
      )}
    </div>
  )
}
