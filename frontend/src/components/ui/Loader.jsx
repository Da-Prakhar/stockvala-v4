import React from 'react'
import { motion } from 'framer-motion'

const Loader = ({ size = 'md', fullScreen = false }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  const container = {
    animate: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const circle = {
    initial: { scale: 0, opacity: 0 },
    animate: {
      scale: 1,
      opacity: [1, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
      },
    },
  }

  return (
    <div className={fullScreen ? 'fixed inset-0 flex items-center justify-center' : ''}>
      <motion.div
        variants={container}
        initial="initial"
        animate="animate"
        className="flex gap-2"
      >
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            variants={circle}
            className={`${sizes[size]} bg-primary-500 rounded-full`}
          />
        ))}
      </motion.div>
    </div>
  )
}

export default Loader
