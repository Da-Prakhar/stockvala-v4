import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, DollarSign, TrendingUp, Briefcase } from 'lucide-react'
import { containerVariants, itemVariants } from '../../utils/animations'

const QuickActions = () => {
  const navigate = useNavigate()

  const actions = [
    {
      icon: DollarSign,
      label: 'Deposit',
      href: '/fund/deposit',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: DollarSign,
      label: 'Withdraw',
      href: '/fund/withdraw',
      color: 'from-orange-500 to-orange-600',
    },
    {
      icon: Plus,
      label: 'New Account',
      href: '/accounts/create',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: TrendingUp,
      label: 'Trade',
      href: '/trade',
      color: 'from-purple-500 to-purple-600',
    },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
    >
      {actions.map((action, index) => {
        const Icon = action.icon
        return (
          <motion.button
            key={index}
            variants={itemVariants}
            onClick={() => navigate(action.href)}
            className={`p-6 rounded-lg bg-gradient-to-br ${action.color} text-white hover:shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95 flex flex-col items-center gap-2`}
          >
            <Icon className="h-6 w-6" />
            <span className="text-sm font-medium">{action.label}</span>
          </motion.button>
        )
      })}
    </motion.div>
  )
}

export default QuickActions
