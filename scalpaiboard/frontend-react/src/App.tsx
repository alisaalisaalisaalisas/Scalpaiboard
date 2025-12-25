import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard/MainDashboard'
import Sidebar from './components/Dashboard/Sidebar'
import AIChat from './components/AIChat/ChatInterface'
import AuthModal from './components/Auth/AuthModal'
import UserMenu from './components/Auth/UserMenu'
import SettingsPage from './components/Settings/SettingsPage'
import WatchlistPage from './components/Watchlist/WatchlistPage'
import AlertsPage from './components/Alerts/AlertsPage'
import { useWebSocketStore } from './store/websocketStore'
import { useAuthStore } from './store/authStore'

function App() {
  const { connect, disconnect } = useWebSocketStore()
  const { checkAuth } = useAuthStore()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(() => {
    const stored = localStorage.getItem('scalpaiboard-ai-chat-open')
    return stored === null ? true : stored === 'true'
  })


  useEffect(() => {
    // Check auth status on mount
    checkAuth()
    
    // Connect to WebSocket on mount
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws'
    connect(wsUrl)
    
    return () => disconnect()
  }, [connect, disconnect, checkAuth])

  useEffect(() => {
    localStorage.setItem('scalpaiboard-ai-chat-open', String(isChatOpen))
  }, [isChatOpen])

  return (
    <Router>
      <div className="flex h-screen bg-dark-900">
        {/* Sidebar Navigation */}
        <Sidebar />
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar with User Menu */}
          <header className="h-14 border-b border-dark-700 flex items-center justify-between px-6 bg-dark-800/50">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-white">Scalpaiboard</h1>
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">Beta</span>
            </div>
            <UserMenu onLogin={() => setShowAuthModal(true)} />
          </header>
          
          {/* Content */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Dashboard/Charts Area */}
            <div className="flex-1 min-h-0 overflow-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/screener" element={<Dashboard />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/watchlist" element={<WatchlistPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </div>
            
            {/* AI Chat Sidebar */}
            <div className="border-l border-dark-700 hidden lg:block h-full min-h-0">
              {isChatOpen ? (
                <div className="w-[400px] h-full">
                  <AIChat onClose={() => setIsChatOpen(false)} />
                </div>
              ) : (
                <div className="w-12 h-full flex items-start justify-center pt-3">
                  <button
                    type="button"
                    className="w-9 h-9 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 text-dark-300 hover:text-white transition-colors"
                    title="Open AI Assistant"
                    onClick={() => setIsChatOpen(true)}
                  >
                    AI
                  </button>
                </div>
              )}
            </div>

          </div>
        </main>
        
        {/* Auth Modal */}
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    </Router>
  )
}

export default App
