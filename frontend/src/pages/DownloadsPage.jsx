import React from 'react'
import { motion } from 'framer-motion'
import { Download, Monitor, Smartphone, Globe } from 'lucide-react'
import Button from '../components/ui/Button'
import Card, { CardBody } from '../components/ui/Card'
import { containerVariants, itemVariants } from '../utils/animations'
import { useCompanyStore } from '../store/companyStore'

const DownloadsPage = () => {
  const { companyName } = useCompanyStore()
  const downloads = [
    {
      name: 'MetaTrader 5 - Windows',
      icon: Monitor,
      category: 'Desktop',
      size: '165 MB',
      version: '5.45',
      description: 'Professional trading platform for Windows',
      url: 'https://download.terminal.free/cdn/web/metaquotes.ltd/mt5/mt5setup.exe?utm_source=www.metatrader5.com&utm_campaign=download',
    },
    {
      name: 'MetaTrader 5 - macOS',
      icon: Monitor,
      category: 'Desktop',
      size: '210 MB',
      version: '5.45',
      description: 'Professional trading platform for macOS',
      url: 'https://download.terminal.free/cdn/web/metaquotes.ltd/mt5/MetaTrader5.pkg.zip?utm_source=www.metatrader5.com&utm_campaign=download.mt5.macos',
    },
    {
      name: 'MetaTrader 5 - iOS',
      icon: Smartphone,
      category: 'Mobile',
      size: '85 MB',
      version: '5.12',
      description: 'Trade on the go with iOS app',
      url: 'https://apps.apple.com/in/app/metatrader-5/id413251709',
    },
    {
      name: 'MetaTrader 5 - Android',
      icon: Smartphone,
      category: 'Mobile',
      size: '92 MB',
      version: '5.12',
      description: 'Trade on the go with Android app',
      url: 'https://download.terminal.free/cdn/web/metaquotes.software.corp/mt5/metatrader5.apk?utm_source=www.metatrader5.com&utm_campaign=install.metaquotes',
    },
    {
      name: `${companyName || 'Web'} Trader`,
      icon: Globe,
      category: 'Web',
      size: 'Browser',
      version: '2.1',
      description: 'Trade directly from your browser — no download needed',
      url: `https://user.${window.location.hostname.split('.').slice(-2).join('.')}`,
    },
  ]

  const groupedDownloads = {
    Desktop: downloads.filter((d) => d.category === 'Desktop'),
    Mobile: downloads.filter((d) => d.category === 'Mobile'),
    Web: downloads.filter((d) => d.category === 'Web'),
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          Downloads
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Download trading platforms for your devices
        </p>
      </div>

      {Object.entries(groupedDownloads).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            {category}
          </h3>
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {items.map((item, idx) => {
              const Icon = item.icon
              return (
                <motion.div key={idx} variants={itemVariants}>
                  <Card variant="elevated" hoverable>
                    <CardBody className="flex flex-col">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
                          <Icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {item.name}
                          </h3>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            v{item.version}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex-grow">
                        {item.description}
                      </p>

                      <div className="mb-4 flex gap-2">
                        <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">
                          {item.size}
                        </span>
                        <span className="text-xs bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2 py-1 rounded">
                          {category}
                        </span>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full"
                        onClick={() => window.open(item.url, '_blank')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {item.category === 'Web' ? 'Open WebTrader' : 'Download'}
                      </Button>
                    </CardBody>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      ))}
    </motion.div>
  )
}

export default DownloadsPage
