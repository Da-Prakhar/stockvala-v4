import React, { useState } from 'react'
import { Bell, Search, Settings, LogOut, User, Shield, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useNotificationStore } from '../../store/notificationStore'
import ThemeToggle from '../ui/ThemeToggle'
import { useClickOutside } from '../../hooks/useClickOutside'

const TopBar = ({ pageTitle, onMenuOpen }) => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { unreadCount, notifications } = useNotificationStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const userMenuRef = useClickOutside(() => setShowUserMenu(false))
  const notificationsRef = useClickOutside(() => setShowNotifications(false))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const recentNotifications = notifications.slice(0, 5)

  return (
    <div className="h-16 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-30 flex-shrink-0">
      <div className="h-full px-3 md:px-6 flex items-center justify-between gap-2">
        {/* Left - Hamburger (mobile) + Page Title */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Hamburger — only on mobile */}
          <button
            onClick={onMenuOpen}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 flex-shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-base md:text-xl font-semibold text-slate-900 dark:text-white truncate">
            {pageTitle || 'Dashboard'}
          </h1>
        </div>

        {/* Center - Search (hidden on mobile) */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <div ref={notificationsRef} className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors duration-200"
            >
              <Bell className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute top-full right-0 mt-2 w-72 md:w-80 max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
                  <span className="text-xs bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 px-2 py-1 rounded-full">
                    {unreadCount}
                  </span>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {recentNotifications.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                      No notifications
                    </div>
                  ) : (
                    recentNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${
                          !notif.read ? 'bg-primary-50 dark:bg-primary-900/10' : ''
                        }`}
                      >
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {notif.title}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          {notif.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => {
                    navigate('/notifications')
                    setShowNotifications(false)
                  }}
                  className="w-full p-3 text-center text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700 transition-colors"
                >
                  View All
                </button>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors duration-200"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute top-full right-0 mt-2 w-52 md:w-56 max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {user?.email}
                  </p>
                </div>

                <button
                  onClick={() => {
                    navigate('/profile')
                    setShowUserMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700"
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>

                <button
                  onClick={() => {
                    navigate('/kyc')
                    setShowUserMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700"
                >
                  <Shield className="h-4 w-4" />
                  KYC Verification
                </button>

                <button
                  onClick={() => {
                    navigate('/profile')
                    setShowUserMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TopBar
