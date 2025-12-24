import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Dashboard from './components/Dashboard/MainDashboard'
import Sidebar from './components/Dashboard/Sidebar'
import AIChat from './components/AIChat/ChatInterface'
import { useWebSocketStore } from './store/websocketStore'

function App() {
  const { connect, disconnect } = useWebSocketStore()

  useEffect(() => {
    // Connect to WebSocket on mount
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws'
    connect(wsUrl)
    
    return () => disconnect()
  }, [connect, disconnect])

  return (
    <Router>
      <div className="flex h-screen bg-dark-900">
        {/* Sidebar Navigation */}
        <Sidebar />
        
        {/* Main Content Area */}
        <main className="flex-1 flex overflow-hidden">
          {/* Dashboard/Charts Area (70%) */}
          <div className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/screener" element={<Dashboard />} />
              <Route path="/alerts" element={<Dashboard />} />
              <Route path="/watchlist" element={<Dashboard />} />
              <Route path="/settings" element={<Dashboard />} />
            </Routes>
          </div>
          
          {/* AI Chat Sidebar (30%) */}
          <div className="w-[400px] border-l border-dark-700 hidden lg:block">
            <AIChat />
          </div>
        </main>
      </div>
    </Router>
  )
}

export default App
