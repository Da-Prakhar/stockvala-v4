import React, { useState } from 'react'
import { Bell, Settings, LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { ThemeToggle } from '../ui/ThemeToggle'
import { motion } from 'framer-motion'
import { useCompanyStore, getUploadUrl } from '../../store/companyStore'

export const AdminTopBar = ({ onMenuClick }) => {
  const { user, logout } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const { companyName, logoUrl } = useCompanyStore()

  const handleLogout = () => {
    logout()
    const loginPath = window.location.pathname.startsWith('/broker/')
      ? '/broker/login'
      : '/login'
    window.location.href = loginPath
  }

  return (
    <div className="bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img
              src={getUploadUrl(logoUrl)}
              alt="Logo"
              className="w-8 h-8 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg items-center justify-center"
            style={{ display: logoUrl ? 'none' : 'flex' }}
          >
            <span className="text-white font-bold text-sm">{companyName.substring(0, 2).toUpperCase() || 'CO'}</span>
          </div>
          <h1 className="text-lg font-bold text-dark-900 dark:text-dark-50 truncate" style={{ maxWidth: '120px' }}>{companyName}</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />

        <button className="relative p-2 text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-3 p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.firstName?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-dark-900 dark:text-dark-50">{user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Admin'}</p>
              <p className="text-xs text-dark-500 dark:text-dark-400 capitalize">{user?.role}</p>
            </div>
          </button>

          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 shadow-lg overflow-hidden z-50"
            >
              <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700">
                <p className="font-medium text-dark-900 dark:text-dark-50">{user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Admin'}</p>
                <p className="text-xs text-dark-500 dark:text-dark-400">{user?.email}</p>
              </div>
              <div className="py-2">
                <button className="flex items-center gap-2 w-full px-4 py-2 hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-700 dark:text-dark-300 text-sm">
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
