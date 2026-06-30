import { motion } from 'framer-motion';
import { Monitor, Smartphone, Globe } from 'lucide-react';
import Card from '../ui/Card';
import GradientText from '../ui/GradientText';
import ScrollReveal from '../ui/ScrollReveal';

export default function PlatformsSection() {
  const platforms = [
    {
      name: 'MT5 Desktop',
      icon: Monitor,
      description: 'Full-featured desktop platform for advanced traders',
      features: ['38+ Technical Indicators', 'Advanced Charting', 'EA / Expert Advisors', 'Custom Scripts'],
      tags: ['Windows', 'Mac', 'Linux'],
      color: 'from-blue-500 to-cyan-500',
      ctaText: 'Download',
    },
    {
      name: 'MT5 Mobile',
      icon: Smartphone,
      description: 'Trade on the go with our powerful mobile app',
      features: ['Full Trading Suite', 'Real-time Notifications', 'Touch Charts', 'One-click Trading'],
      tags: ['iOS', 'Android'],
      color: 'from-purple-500 to-pink-500',
      ctaText: 'Download',
    },
    {
      name: 'Web Trader',
      icon: Globe,
      description: 'Browser-based trading platform accessible anywhere',
      features: ['No Download Required', 'Fast Loading', 'Responsive Design', 'All Markets Access'],
      tags: ['All Browsers'],
      color: 'from-amber-500 to-orange-500',
      ctaText: 'Launch',
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
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-[#f0f4ff] dark:bg-dark-950 overflow-hidden" id="platforms">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-secondary-500/4 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <ScrollReveal animation="slideUp" className="text-center mb-16">
          <div className="inline-block text-xs font-semibold uppercase tracking-widest text-primary-500 bg-primary-500/10 border border-primary-500/20 rounded-full px-3.5 py-1 mb-4">
            Our Platforms
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            Trade From Anywhere,
            <br />
            <GradientText type="primary">Anytime</GradientText>
          </h2>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-5">
            Professional trading tools available across all your devices — desktop, mobile, and web.
          </p>
          <div className="h-1 w-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full mx-auto" />
        </ScrollReveal>

        {/* Platforms Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {platforms.map((platform, index) => {
            const Icon = platform.icon;
            return (
              <motion.div key={index} variants={itemVariants}>
                <Card className="h-full p-8">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${platform.color} mb-6`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{platform.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{platform.description}</p>

                  {/* Features */}
                  <div className="mb-5 pb-5 border-b border-dark-700">
                    <ul className="space-y-2">
                      {platform.features.map((feature, idx) => (
                        <li key={idx} className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Platform tags */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {platform.tags.map((tag, idx) => (
                      <span key={idx} className="text-xs px-3 py-1 bg-primary-500/10 text-primary-400 rounded-full border border-primary-500/20">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-400 hover:text-primary-300 transition-colors group">
                    {platform.ctaText}
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Comparison Table */}
        <ScrollReveal animation="slideUp">
          <Card className="p-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Platform Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Feature</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">MT5 Desktop</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">MT5 Mobile</th>
                    <th className="text-center py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Web Trader</th>
                  </tr>
                </thead>
                <tbody>
                  {['Advanced Charting', 'Expert Advisors', 'Copy Trading', 'Market Signals', 'One-Click Trading'].map((feature, idx) => (
                    <tr key={idx} className="border-b border-dark-700/50">
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{feature}</td>
                      <td className="text-center py-3 px-4 text-amber-400 font-bold">✓</td>
                      <td className="text-center py-3 px-4 text-amber-400 font-bold">✓</td>
                      <td className="text-center py-3 px-4 text-amber-400 font-bold">✓</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}
