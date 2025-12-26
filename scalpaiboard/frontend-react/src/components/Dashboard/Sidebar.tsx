import { Link, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Bell, 
  Star, 
  Settings,
  Zap
} from 'lucide-react'

import clsx from 'clsx'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/alerts', icon: Bell, label: 'Alerts' },
  { path: '/watchlist', icon: Star, label: 'Watchlist' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]


export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-20 bg-dark-800 border-r border-dark-700 flex flex-col items-center py-6">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <Zap className="w-7 h-7 text-white" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={clsx(
              'w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200',
              location.pathname === path
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-700'
            )}
            title={label}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Connection Status */}
      <div className="mt-auto">
        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" title="Connected" />
      </div>
    </aside>
  )
}
