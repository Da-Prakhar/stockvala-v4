import { motion } from 'framer-motion';
import { TrendingUp, Users, Shield } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import GradientText from '../ui/GradientText';
import ScrollReveal from '../ui/ScrollReveal';

export default function CopyTradingSection() {
  const masterTraders = [
    {
      initials: 'AJ',
      name: 'Alex Johnson',
      country: '🇺🇸 United States',
      winRate: 78,
      monthlyReturn: '+12.5%',
      followers: '2,840',
      totalCopied: '$1.2M',
      avatarColor: 'from-primary-500 to-cyan-500',
    },
    {
      initials: 'SM',
      name: 'Sophie Martin',
      country: '🇫🇷 France',
      winRate: 82,
      monthlyReturn: '+15.3%',
      followers: '4,120',
      totalCopied: '$2.5M',
      avatarColor: 'from-purple-500 to-pink-500',
    },
    {
      initials: 'DC',
      name: 'David Chen',
      country: '🇸🇬 Singapore',
      winRate: 75,
      monthlyReturn: '+11.8%',
      followers: '1,950',
      totalCopied: '$890K',
      avatarColor: 'from-amber-500 to-orange-500',
    },
    {
      initials: 'EW',
      name: 'Emma Wilson',
      country: '🇬🇧 United Kingdom',
      winRate: 80,
      monthlyReturn: '+14.2%',
      followers: '3,560',
      totalCopied: '$1.8M',
      avatarColor: 'from-green-500 to-emerald-500',
    },
  ];

  const benefits = [
    {
      icon: TrendingUp,
      iconColor: 'text-primary-500',
      bgColor: 'bg-primary-500/15',
      title: 'Passive Income',
      desc: 'Let successful traders work for you while you focus on other things.',
    },
    {
      icon: Users,
      iconColor: 'text-purple-400',
      bgColor: 'bg-purple-500/15',
      title: 'Social Trading',
      desc: 'Join our community and learn from thousands of successful traders.',
    },
    {
      icon: Shield,
      iconColor: 'text-green-400',
      bgColor: 'bg-green-500/15',
      title: 'Complete Control',
      desc: 'Stop copying anytime. Your funds remain under your complete control.',
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
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-dark-900 overflow-hidden" id="copy-trading">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-purple-500/4 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <ScrollReveal animation="slideUp" className="text-center mb-16">
          <div className="inline-block text-xs font-semibold uppercase tracking-widest text-primary-500 bg-primary-500/10 border border-primary-500/20 rounded-full px-3.5 py-1 mb-4">
            Copy Trading
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            Copy Trading Made
            <br />
            <GradientText type="primary">Simple &amp; Profitable</GradientText>
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-5">
            Follow successful traders and mirror their strategies automatically.
          </p>
          <div className="h-1 w-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full mx-auto" />
        </ScrollReveal>

        {/* Trader Cards */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {masterTraders.map((trader, index) => (
            <motion.div key={index} variants={itemVariants}>
              <Card className="p-5 flex flex-col h-full">
                {/* Top row */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${trader.avatarColor} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                    {trader.initials}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">{trader.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{trader.country}</p>
                  </div>
                </div>

                {/* 2x2 stats grid */}
                <div className="grid grid-cols-2 gap-2 mb-5 flex-1">
                  {[
                    { label: 'Win Rate', value: `${trader.winRate}%`, color: 'text-green-400' },
                    { label: 'Monthly Return', value: trader.monthlyReturn, color: 'text-green-400' },
                    { label: 'Followers', value: trader.followers, color: 'text-primary-400' },
                    { label: 'Total Copied', value: trader.totalCopied, color: 'text-white' },
                  ].map((stat) => (
                    <div key={stat.label} className="p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                      <p className="text-[9px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">{stat.label}</p>
                      <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <button className="w-full py-2 px-4 rounded-xl text-sm font-semibold border border-primary-500 text-primary-400 bg-primary-500/8 hover:bg-primary-500 hover:text-white transition-all duration-200">
                  Start Copying
                </button>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Benefits */}
        <ScrollReveal animation="slideUp" delay={0.3} className="mb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {benefits.map((b, i) => (
              <Card key={i} className="p-6">
                <div className={`w-10 h-10 rounded-xl ${b.bgColor} flex items-center justify-center mb-4`}>
                  <b.icon className={`w-5 h-5 ${b.iconColor}`} />
                </div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">{b.title}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{b.desc}</p>
              </Card>
            ))}
          </div>
        </ScrollReveal>

        {/* CTA */}
        <ScrollReveal animation="slideUp" delay={0.4} className="text-center">
          <p className="text-gray-400 mb-5">Ready to start copying successful traders?</p>
          <Button variant="gradient" size="lg">
            Explore Master Traders
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}
