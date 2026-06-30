import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  DollarSign,
  CreditCard,
  FileCheck,
  TrendingUp,
  BarChart3,
  Grid3x3,
  Shield,
  HelpCircle,
  Settings,
  ChevronDown,
  X,
  Copy,
  PiggyBank,
  Server,
  Share2,
  Flame,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCompanyStore, getUploadUrl } from '../../store/companyStore'

const menuItems = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    label: 'Clients',
    icon: Users,
    path: '/clients',
  },
  {
    label: 'Deposits',
    icon: DollarSign,
    path: '/deposits',
  },
  {
    label: 'Withdrawals',
    icon: CreditCard,
    path: '/withdrawals',
  },
  {
    label: 'KYC',
    icon: FileCheck,
    path: '/kyc',
  },
  {
    label: 'Copy Trading',
    icon: Copy,
    path: '/copy-trading',
  },
  {
    label: 'MAM',
    icon: TrendingUp,
    path: '/mam',
  },
  {
    label: 'PAMM',
    icon: PiggyBank,
    path: '/pamm',
  },
  {
    label: 'MT5 Management',
    icon: Server,
    path: '/mt5',
  },
  {
    label: 'Risk Monitor',
    icon: Flame,
    path: '/risk-monitor',
  },
  {
    label: 'IB Program',
    icon: Share2,
    path: '/ib',
  },
  {
    label: 'Roles & Permissions',
    icon: Shield,
    path: '/roles',
  },
  {
    label: 'Support',
    icon: HelpCircle,
    path: '/support',
  },
]

const settingsItems = [
  {
    label: 'Payment Methods',
    path: '/settings/payment-methods',
  },
  {
    label: 'Company Settings',
    path: '/settings/company',
  },
  {
    label: 'Trading Settings',
    path: '/settings/trading',
  },
  {
    label: 'Managers',
    path: '/settings/managers',
  },
]

export const AdminSidebar = ({ isOpen, onClose }) => {
  const [expandSettings, setExpandSettings] = useState(false)
  const { companyName, logoUrl } = useCompanyStore()

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Desktop Sidebar - always visible on lg+ */}
      <div className="hidden lg:flex flex-col w-72 h-screen bg-white dark:bg-dark-800 border-r border-dark-200 dark:border-dark-700 overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-dark-200 dark:border-dark-700 flex items-center gap-3">
          {logoUrl ? (
            <img
              src={getUploadUrl(logoUrl)}
              alt="Logo"
              className="w-10 h-10 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div
            className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg items-center justify-center"
            style={{ display: logoUrl ? 'none' : 'flex' }}
          >
            <span className="text-white font-bold">{companyName.substring(0, 2).toUpperCase() || 'CO'}</span>
          </div>
          <div>
            <h1 className="font-bold text-dark-900 dark:text-dark-50 truncate" style={{ maxWidth: '160px' }}>{companyName}</h1>
            <p className="text-xs text-dark-500 dark:text-dark-400">Admin Panel</p>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 py-6 px-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                  ${isActive
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                    : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            )
          })}

          {/* Settings Section */}
          <div className="mt-4 pt-4 border-t border-dark-200 dark:border-dark-700">
            <button
              onClick={() => setExpandSettings(!expandSettings)}
              className="flex items-center justify-between w-full px-4 py-3 text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5" />
                <span className="font-medium">Settings</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${expandSettings ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {expandSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 mt-2 ml-4">
                    {settingsItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
                          block px-4 py-2 text-sm rounded-lg transition-colors border-l-2
                          ${isActive
                            ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
                            : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 border-transparent'
                          }
                        `}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-dark-200 dark:border-dark-700">
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3 text-sm">
            <p className="text-primary-600 dark:text-primary-400 font-medium mb-1">Version 1.0.0</p>
            <p className="text-primary-600 dark:text-primary-400 text-xs">Broker Admin CRM</p>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <motion.div
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed lg:hidden left-0 top-0 h-screen w-72 bg-white dark:bg-dark-800 border-r border-dark-200 dark:border-dark-700 z-40 overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between lg:justify-start">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={getUploadUrl(logoUrl)}
                alt="Logo"
                className="w-10 h-10 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
              />
            ) : null}
            <div
              className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg items-center justify-center"
              style={{ display: logoUrl ? 'none' : 'flex' }}
            >
              <span className="text-white font-bold">{companyName.substring(0, 2).toUpperCase() || 'CO'}</span>
            </div>
            <div>
              <h1 className="font-bold text-dark-900 dark:text-dark-50 truncate" style={{ maxWidth: '140px' }}>{companyName}</h1>
              <p className="text-xs text-dark-500 dark:text-dark-400">Admin Panel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 hover:bg-dark-100 dark:hover:bg-dark-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 py-6 px-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                  ${isActive
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                    : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            )
          })}

          {/* Settings Section */}
          <div className="mt-4 pt-4 border-t border-dark-200 dark:border-dark-700">
            <button
              onClick={() => setExpandSettings(!expandSettings)}
              className="flex items-center justify-between w-full px-4 py-3 text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5" />
                <span className="font-medium">Settings</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${expandSettings ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {expandSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 mt-2 ml-4">
                    {settingsItems.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) => `
                          block px-4 py-2 text-sm rounded-lg transition-colors border-l-2
                          ${isActive
                            ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
                            : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 border-transparent'
                          }
                        `}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-dark-200 dark:border-dark-700">
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3 text-sm">
            <p className="text-primary-600 dark:text-primary-400 font-medium mb-1">Version 1.0.0</p>
            <p className="text-primary-600 dark:text-primary-400 text-xs">Broker Admin CRM</p>
          </div>
        </div>
      </motion.div>
    </>
  )
}
