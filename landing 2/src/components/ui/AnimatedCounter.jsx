import { useEffect, useState, useRef } from 'react';
import { useInView } from 'framer-motion';

export default function AnimatedCounter({
  value,
  duration = 2,
  suffix = '',
  prefix = '',
  decimal = 0,
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    let startTime;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      const currentValue = Math.floor(value * progress);
      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [isInView, value, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {displayValue.toLocaleString('en-US', {
        minimumFractionDigits: decimal,
        maximumFractionDigits: decimal,
      })}
      {suffix}
    </span>
  );
}
