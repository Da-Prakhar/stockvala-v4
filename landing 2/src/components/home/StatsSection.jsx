import { motion } from 'framer-motion';
import { Users, Globe, TrendingUp, Award } from 'lucide-react';
import Card from '../ui/Card';
import AnimatedCounter from '../ui/AnimatedCounter';
import ScrollReveal from '../ui/ScrollReveal';

export default function StatsSection() {
  const stats = [
    {
      icon: Users,
      value: 500,
      suffix: 'K+',
      label: 'Active Traders',
      iconColor: 'text-primary-500',
      iconBg: 'bg-primary-500/15',
      numColor: 'bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent',
    },
    {
      icon: Globe,
      value: 180,
      suffix: '+',
      label: 'Countries Served',
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/15',
      numColor: 'text-cyan-400',
    },
    {
      icon: TrendingUp,
      value: 50,
      suffix: 'B+',
      label: 'Daily Trading Volume',
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/15',
      numColor: 'text-amber-400',
    },
    {
      icon: Award,
      value: 12,
      suffix: '+',
      label: 'Years in Business',
      iconColor: 'text-green-400',
      iconBg: 'bg-green-500/15',
      numColor: 'text-green-400',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.85 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.6 } },
  };

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 bg-[#f0f4ff] dark:bg-dark-950 overflow-hidden" id="stats">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div key={index} variants={itemVariants}>
                <Card className="p-8 text-center h-full flex flex-col items-center justify-center">
                  <div className={`w-13 h-13 rounded-xl ${stat.iconBg} flex items-center justify-center mb-4 p-3`}>
                    <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                  </div>
                  <div className={`text-4xl md:text-5xl font-extrabold mb-2 ${stat.numColor}`}>
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} duration={2.5} />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Trust badges */}
        <ScrollReveal animation="slideUp" delay={0.4} className="mt-14">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Trusted by Industry Leaders</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {['FCA Regulated', 'ASIC Compliant', 'ISO 27001', 'Bank-Grade Security'].map((badge, idx) => (
                <Card key={idx} className="p-4 text-center">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{badge}</p>
                </Card>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
