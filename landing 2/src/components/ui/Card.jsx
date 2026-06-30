import { motion } from 'framer-motion';

export default function Card({
  children,
  className = '',
  hover = true,
  ...props
}) {
  const baseClasses = `
    rounded-2xl transition-all duration-300 relative overflow-hidden
    bg-white border border-gray-200 shadow-sm
    dark:bg-white/[0.03] dark:border-white/[0.06] dark:shadow-none
    backdrop-blur-sm
    ${hover ? 'hover:-translate-y-1 hover:shadow-md dark:hover:border-primary-500/30 dark:hover:shadow-[0_20px_60px_rgba(0,102,255,0.08)]' : ''}
  `;

  return (
    <motion.div
      className={`${baseClasses} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
