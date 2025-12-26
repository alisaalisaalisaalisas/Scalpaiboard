import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './components/Dashboard/MainDashboard'
import FocusModeFullscreenChart from './components/Charts/FocusModeFullscreenChart'
import Sidebar from './components/Dashboard/Sidebar'
import RightDock from './components/Dashboard/RightDock'
import AuthModal from './components/Auth/AuthModal'
import UserMenu from './components/Auth/UserMenu'
import SettingsPage from './components/Settings/SettingsPage'
import WatchlistPage from './components/Watchlist/WatchlistPage'
import AlertsPage from './components/Alerts/AlertsPage'
import { useAuthStore } from './store/authStore'

function App() {
  const { checkAuth } = useAuthStore()
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    // Check auth status on mount
    checkAuth()
  }, [checkAuth])

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
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/watchlist" element={<WatchlistPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
            
            <RightDock />

            <FocusModeFullscreenChart />

           </div>
         </main>

        
        {/* Auth Modal */}
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    </Router>
  )
}

export default App
