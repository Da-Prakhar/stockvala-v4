import { motion } from 'framer-motion';

export default function Loader({ size = 'md', variant = 'spinner' }) {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  if (variant === 'spinner') {
    return (
      <motion.div
        className={`${sizes[size]} border-3 border-gray-300 dark:border-dark-600 border-t-primary-500 rounded-full`}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    );
  }

  if (variant === 'dots') {
    return (
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 bg-primary-500 rounded-full"
            animate={{ y: [0, -10, 0] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`${sizes[size]} skeleton rounded-lg`} />
  );
}
