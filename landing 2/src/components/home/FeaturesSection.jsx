import { motion } from 'framer-motion';
import { Zap, TrendingUp, Copy, BarChart3, Headphones, Shield } from 'lucide-react';
import Card from '../ui/Card';
import GradientText from '../ui/GradientText';
import ScrollReveal from '../ui/ScrollReveal';

export default function FeaturesSection() {
  const features = [
    {
      icon: Zap,
      title: 'Ultra-Fast Execution',
      description: 'Lightning-fast order execution with minimal slippage. Trade at the speed of market.',
      color: 'from-primary-500 to-blue-600',
    },
    {
      icon: TrendingUp,
      title: 'Tight Spreads from 0.0',
      description: 'Ultra-competitive spreads on all major currency pairs and instruments.',
      color: 'from-cyan-500 to-blue-500',
    },
    {
      icon: Copy,
      title: 'Advanced Copy Trading',
      description: 'Follow and copy trades from successful traders. Build wealth passively.',
      color: 'from-secondary-500 to-cyan-600',
    },
    {
      icon: BarChart3,
      title: 'MT5 Platform',
      description: 'Industry-leading MetaTrader 5 platform with advanced charting and tools.',
      color: 'from-purple-500 to-pink-500',
    },
    {
      icon: Headphones,
      title: '24/7 Support',
      description: 'Expert support team available round-the-clock to assist you anytime.',
      color: 'from-amber-500 to-orange-500',
    },
    {
      icon: Shield,
      title: 'Secure & Regulated',
      description: 'Licensed and regulated by top-tier authorities worldwide. Your funds are safe.',
      color: 'from-green-500 to-emerald-500',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-[#f0f4ff] dark:bg-dark-950 overflow-hidden" id="features">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-secondary-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <ScrollReveal animation="slideUp" className="text-center mb-16">
          <div className="inline-block text-xs font-semibold uppercase tracking-widest text-primary-500 bg-primary-500/10 border border-primary-500/20 rounded-full px-3.5 py-1 mb-4">
            Platform Features
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            Powerful Features for
            <br />
            <GradientText type="primary">Professional Traders</GradientText>
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-5">
            Everything you need to trade like a professional. From advanced tools to expert support.
          </p>
          <div className="h-1 w-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full mx-auto" />
        </ScrollReveal>

        {/* Features Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div key={index} variants={itemVariants}>
                <Card className="h-full p-8 group">
                  <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${feature.color} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{feature.description}</p>
                  <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-primary-500 to-secondary-500 group-hover:w-full transition-all duration-300 rounded-full" />
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* CTA */}
        <ScrollReveal animation="slideUp" delay={0.4} className="text-center mt-14">
          <p className="text-gray-400 mb-4">Ready to get started with these powerful features?</p>
          <button className="inline-flex items-center gap-2 text-primary-500 font-medium hover:text-primary-400 transition-colors group">
            Explore All Features
            <span className="group-hover:translate-x-2 transition-transform">→</span>
          </button>
        </ScrollReveal>
      </div>
    </section>
  );
}
