import React from 'react'
import { ArrowLeft, Globe, Mail, Phone, MapPin, Shield, Award, Users, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../store/companyStore'

const CompanyPage = () => {
  const navigate = useNavigate()
  const { companyName, email, phone, address } = useCompanyStore()
  const name = companyName || 'Trading Platform'

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Company Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 mb-8 text-white">
        <h1 className="text-3xl font-bold mb-2">{name}</h1>
        <p className="text-blue-100 text-lg">Next-Generation Trading Platform</p>
      </div>

      {/* About */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">About Us</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          {name} is a modern trading platform providing access to Forex, Commodities (MCX), and Stock Markets (NSE). We offer advanced trading tools, copy trading, MAM/PAMM accounts, and a seamless trading experience powered by MetaTrader 5 technology. Our mission is to make professional-grade trading accessible to everyone.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Shield, label: 'Secure Trading', desc: 'Bank-grade encryption' },
          { icon: TrendingUp, label: 'MT5 Powered', desc: 'Industry standard' },
          { icon: Users, label: 'Copy Trading', desc: 'Follow the best' },
          { icon: Award, label: '24/7 Support', desc: 'Always available' },
        ].map((item, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
            <item.icon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Contact Info */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Contact Information</h2>
        <div className="space-y-3">
          {email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-slate-400" />
              <a href={`mailto:${email}`} className="text-blue-500 hover:text-blue-600">{email}</a>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600 dark:text-slate-400">{phone}</span>
            </div>
          )}
          {address && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-slate-600 dark:text-slate-400">{address}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CompanyPage
