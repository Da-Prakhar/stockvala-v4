import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CreditCard, Building2, TrendingUp, Users, Server } from 'lucide-react'
import { Card } from '../components/ui/Card'

const settingsCards = [
  {
    title: 'Payment Methods',
    description: 'Manage payment gateways and methods',
    icon: CreditCard,
    path: '/settings/payment-methods',
  },
  {
    title: 'Company Settings',
    description: 'Company branding and information',
    icon: Building2,
    path: '/settings/company',
  },
  {
    title: 'Trading Settings',
    description: 'Configure trading parameters',
    icon: TrendingUp,
    path: '/settings/trading',
  },
  {
    title: 'MT5 Configuration',
    description: 'Bridge connection, server credentials & groups',
    icon: Server,
    path: '/mt5',
  },
  {
    title: 'Managers',
    description: 'Manage admin users',
    icon: Users,
    path: '/settings/managers',
  },
]

export default function SettingsPage() {
  const navigate = useNavigate()

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-50">Settings</h1>
        <p className="text-dark-600 dark:text-dark-400 mt-1">Manage platform settings and configuration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settingsCards.map((item, index) => {
          const Icon = item.icon
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(item.path)}
              className="cursor-pointer"
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
                    <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-dark-900 dark:text-dark-50 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-dark-600 dark:text-dark-400">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
