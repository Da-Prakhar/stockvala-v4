import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import * as animations from '../../utils/animations';

export default function ScrollReveal({
  children,
  animation = 'slideUp',
  delay = 0,
  duration = 0.6,
  className = '',
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const animationVariants = animations[animation] || animations.slideUp;

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={animationVariants}
      transition={{ delay, duration }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
