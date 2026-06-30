import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import GradientText from '../ui/GradientText';

export default function HeroSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.3 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
  };

  const stats = [
    { value: '500K+', label: 'Active Traders', color: 'text-blue-400' },
    { value: '150+', label: 'Markets', color: 'text-cyan-400' },
    { value: '0.0 pips', label: 'Min Spread', color: 'text-yellow-400' },
    { value: '500:1', label: 'Max Leverage', color: 'text-purple-400' },
  ];

  return (
    <section className="relative min-h-screen bg-[#f0f4ff] dark:bg-dark-950 flex items-center pt-16 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-100px] left-[-200px] w-[600px] h-[600px] bg-primary-500/6 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-[-100px] w-[400px] h-[400px] bg-secondary-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      <div className="absolute inset-0 z-0 grid-pattern opacity-20" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Left Content */}
          <div className="z-20">
            {/* Live badge */}
            <motion.div variants={itemVariants} className="mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20">
                <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80] animate-pulse" />
                <span className="text-sm text-primary-400 font-medium">Live Markets Open</span>
              </div>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 leading-tight text-gray-900 dark:text-white"
            >
              Trade Smarter.
              <br />
              <GradientText type="primary" className="block">
                Trade Faster.
              </GradientText>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-base sm:text-lg text-gray-400 mb-8 max-w-lg leading-relaxed"
            >
              Access 150+ global markets with tight spreads, ultra-fast execution, and
              professional-grade tools. Join thousands of traders who trust us.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-4 mb-10"
            >
              <Link to="/register">
                <Button variant="gradient" size="lg" className="w-full sm:w-auto">
                  Start Trading
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button variant="outlined" size="lg" className="w-full sm:w-auto">
                Try Demo Account
              </Button>
            </motion.div>

            {/* Stats Row */}
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-4 gap-3 pt-6 border-t border-gray-800"
            >
              {stats.map((stat) => (
                <div key={stat.label} className="text-center sm:text-left">
                  <p className={`text-lg sm:text-xl lg:text-2xl font-bold whitespace-nowrap ${stat.color}`}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right Side – Chart Card */}
          <motion.div variants={itemVariants} className="relative w-full hidden lg:block">
            <div style={{ position: 'relative', width: '100%', maxWidth: '460px', margin: '0 auto' }}>
              {/* Floating EUR/USD price badge */}
              <motion.div
                className="absolute -top-4 -right-4 z-20 bg-white dark:bg-dark-800 backdrop-blur-sm rounded-xl px-3 py-2 border border-gray-200 dark:border-primary-500/20 shadow-lg"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <p className="text-xs text-gray-400">EUR/USD</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">1.2458</p>
                <p className="text-xs text-green-400 font-semibold">+0.45%</p>
              </motion.div>

              {/* Main chart container */}
              <div className="bg-white/90 dark:bg-dark-800/80 border border-gray-200 dark:border-primary-500/15 rounded-2xl overflow-hidden backdrop-blur-sm p-5 shadow-xl dark:shadow-none">
                {/* Chart header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400">EUR / USD</p>
                  </div>
                  <div className="flex gap-1">
                    {['1H', '1D', '1W'].map((t, i) => (
                      <span
                        key={t}
                        className={`text-xs px-2 py-0.5 rounded cursor-pointer ${
                          i === 0 ? 'bg-primary-500/15 text-primary-400' : 'text-gray-500'
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* SVG area chart */}
                <div className="rounded-xl overflow-hidden bg-dark-850/50">
                  <svg
                    viewBox="0 0 400 200"
                    className="w-full"
                    preserveAspectRatio="xMidYMid meet"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <linearGradient id="heroLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0066FF" />
                        <stop offset="100%" stopColor="#00D4FF" />
                      </linearGradient>
                      <linearGradient id="heroAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#0066FF" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    <line x1="0" y1="40" x2="400" y2="40" stroke="rgba(0,102,255,0.06)" strokeWidth="1" />
                    <line x1="0" y1="80" x2="400" y2="80" stroke="rgba(0,102,255,0.06)" strokeWidth="1" />
                    <line x1="0" y1="120" x2="400" y2="120" stroke="rgba(0,102,255,0.06)" strokeWidth="1" />
                    <line x1="0" y1="160" x2="400" y2="160" stroke="rgba(0,102,255,0.06)" strokeWidth="1" />
                    {/* Area fill */}
                    <polygon
                      points="0,180 40,162 80,155 120,148 160,135 200,115 240,108 280,95 320,80 360,65 400,52 400,200 0,200"
                      fill="url(#heroAreaGrad)"
                    />
                    {/* Line */}
                    <polyline
                      points="0,180 40,162 80,155 120,148 160,135 200,115 240,108 280,95 320,80 360,65 400,52"
                      fill="none"
                      stroke="url(#heroLineGrad)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Animated dot */}
                    <circle cx="400" cy="52" r="4" fill="#00D4FF">
                      <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                </div>
              </div>

              {/* P&L card bottom-left */}
              <motion.div
                className="absolute -bottom-4 -left-4 z-20 bg-white dark:bg-dark-800 backdrop-blur-sm rounded-xl px-3 py-2 border border-gray-200 dark:border-green-500/20 shadow-lg"
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
              >
                <p className="text-xs text-gray-400">Today's P&L</p>
                <p className="text-sm font-bold text-green-400">+$2,458.30</p>
              </motion.div>

              {/* Volume card bottom-right */}
              <motion.div
                className="absolute -bottom-4 right-5 z-20 bg-white dark:bg-dark-800 backdrop-blur-sm rounded-xl px-3 py-2 border border-gray-200 dark:border-cyan-500/20 shadow-lg"
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
              >
                <p className="text-xs text-gray-400">Volume</p>
                <p className="text-sm font-bold text-cyan-400">1.2M</p>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
