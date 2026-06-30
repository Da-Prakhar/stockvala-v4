import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Briefcase,
  DollarSign,
  TrendingUp,
  Copy,
  Users,
  Grid,
  Wallet,
  HelpCircle,
  Download,
  Share2,
  LogOut,
  X,
  ChevronLeft,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useCompanyStore, getUploadUrl } from '../../store/companyStore'

const Sidebar = ({ isOpen = false, onClose = () => {} }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { companyName, logoUrl } = useCompanyStore()

  const navigationItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard' },
    { icon: Briefcase, label: 'Accounts', href: '/accounts' },
    { icon: DollarSign, label: 'Fund', href: '/fund' },
    { icon: Wallet, label: 'Wallet', href: '/wallet' },
    { icon: TrendingUp, label: 'Trade', href: '/trade' },
    { icon: Copy, label: 'Copy Trading', href: '/copy-trading' },
    { icon: Users, label: 'MAM', href: '/mam' },
    { icon: Grid, label: 'PAMM', href: '/pamm' },
    { icon: HelpCircle, label: 'Support', href: '/support' },
    { icon: Download, label: 'Downloads', href: '/downloads' },
    { icon: Share2, label: 'IB', href: '/ib' },
  ]

  const isActive = (href) => location.pathname.startsWith(href)

  // Close mobile sidebar on route change (handles cases where React reuses the
  // same DashboardLayout instance for sibling routes, keeping mobileSidebarOpen=true)
  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="h-16 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 flex-shrink-0">
        {!isCollapsed && (
          <Link to="/dashboard" className="flex items-center gap-2">
            {logoUrl ? (
              <img
                src={getUploadUrl(logoUrl)}
                alt="Logo"
                className="h-8 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
              />
            ) : null}
            <div
              className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg items-center justify-center text-white font-bold text-sm"
              style={{ display: logoUrl ? 'none' : 'flex' }}
            >
              {companyName.substring(0, 2).toUpperCase() || 'CO'}
            </div>
            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[120px]">
              {companyName}
            </span>
          </Link>
        )}
        {isCollapsed && (
          <div className="mx-auto">
            {logoUrl ? (
              <img
                src={getUploadUrl(logoUrl)}
                alt="Logo"
                className="h-8 w-8 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
              />
            ) : null}
            <div
              className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg items-center justify-center text-white font-bold text-sm"
              style={{ display: logoUrl ? 'none' : 'flex' }}
            >
              {companyName.substring(0, 2).toUpperCase() || 'CO'}
            </div>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:block p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
        >
          <ChevronLeft
            className={`h-5 w-5 text-slate-500 transition-transform ${
              isCollapsed ? 'rotate-180' : ''
            }`}
          />
        </button>
        <button
          onClick={onClose}
          className="md:hidden p-1 text-slate-500"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative group ${
                active
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              {active && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-r" />
              )}
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-3 py-1 bg-slate-900 text-white rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-3 flex-shrink-0">
        <Link
          to="/profile"
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200 mb-2"
        >
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          {!isCollapsed && (
            <div className="text-sm min-w-0">
              <p className="font-medium text-slate-900 dark:text-white truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user?.email || ''}
              </p>
            </div>
          )}
        </Link>

        <button
          onClick={handleLogout}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors duration-200 ${isCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar - always visible, collapsible */}
      <div
        className={`hidden md:flex flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 flex-shrink-0 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Mobile Sidebar - controlled by parent via isOpen prop */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col md:hidden shadow-2xl"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default Sidebar
