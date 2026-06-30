import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import GradientText from '../ui/GradientText';
import ScrollReveal from '../ui/ScrollReveal';

export default function AccountTypesSection() {
  const accounts = [
    {
      name: 'Standard',
      description: 'Perfect for beginners',
      minDeposit: '$100',
      depositColor: 'text-blue-400',
      spread: '1.2 pips',
      leverage: '1:100',
      commission: 'No',
      commissionColor: 'text-green-400',
      color: 'from-blue-500 to-cyan-500',
      features: ['Live Account', 'MT5 Platform', 'Email Support', '24/7 Trading', 'Demo Account'],
    },
    {
      name: 'Pro',
      description: 'For active traders',
      minDeposit: '$5,000',
      depositColor: 'text-purple-400',
      spread: '0.5 pips',
      leverage: '1:200',
      commission: 'From $2/lot',
      commissionColor: 'text-white',
      color: 'from-purple-500 to-pink-500',
      popular: true,
      features: ['Live Account', 'MT5 & WebTrader', 'Priority Support', 'Copy Trading', 'VPS Access', 'Market Signals'],
    },
    {
      name: 'VIP',
      description: 'For professional traders',
      minDeposit: '$25,000',
      depositColor: 'text-amber-400',
      spread: '0.0 pips',
      leverage: '1:500',
      commission: 'Negotiable',
      commissionColor: 'text-white',
      color: 'from-amber-500 to-orange-500',
      features: ['All Platforms', 'Dedicated Manager', 'Copy Trading', 'API Access', 'Cashback Program', 'Market Signals'],
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-900 overflow-hidden" id="accounts">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <ScrollReveal animation="slideUp" className="text-center mb-16">
          <div className="inline-block text-xs font-semibold uppercase tracking-widest text-primary-500 bg-primary-500/10 border border-primary-500/20 rounded-full px-3.5 py-1 mb-4">
            Account Types
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            Choose Your Perfect
            <br />
            <GradientText type="primary">Trading Account</GradientText>
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-5">
            Find the account type that suits your trading style and goals.
          </p>
          <div className="h-1 w-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full mx-auto" />
        </ScrollReveal>

        {/* Account Cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {accounts.map((account, index) => (
            <motion.div key={index} variants={itemVariants} className="relative">
              {account.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                  <Badge variant="gold">⭐ Most Popular</Badge>
                </div>
              )}

              <Card
                className={`h-full p-8 flex flex-col transition-all duration-300 ${
                  account.popular ? 'ring-2 ring-purple-500/40 md:scale-105' : ''
                }`}
                hover
              >
                {/* Icon + Name */}
                <div className="mb-5">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${account.color} flex items-center justify-center mb-4`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <h3 className={`text-2xl font-bold mb-1 ${account.popular ? 'bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent' : 'text-white'}`}>
                    {account.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{account.description}</p>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { label: 'Min Deposit', value: account.minDeposit, valueClass: account.depositColor },
                    { label: 'Spread', value: account.spread, valueClass: 'text-white' },
                    { label: 'Leverage', value: account.leverage, valueClass: 'text-white' },
                    { label: 'Commission', value: account.commission, valueClass: account.commissionColor },
                  ].map((spec) => (
                    <div key={spec.label} className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">{spec.label}</p>
                      <p className={`text-sm font-bold ${spec.valueClass}`}>{spec.value}</p>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div className="flex-1 mb-8">
                  <ul className="space-y-2.5">
                    {account.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  variant={account.popular ? 'gradient' : 'outlined'}
                  size="lg"
                  className="w-full"
                >
                  Open {account.name} Account
                </Button>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom cards */}
        <ScrollReveal animation="slideUp" delay={0.4} className="mt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">All Accounts Include</h4>
              <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                {['Segregated Client Funds', 'Industry-leading Protection', 'Negative Balance Protection'].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />{f}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-6">
              <h4 className="font-bold text-gray-900 dark:text-white mb-3">Want a Custom Plan?</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                For institutional clients or special requirements, we offer customized solutions.
              </p>
              <button className="text-primary-400 text-sm font-medium hover:text-primary-300 transition-colors">
                Contact our team →
              </button>
            </Card>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
