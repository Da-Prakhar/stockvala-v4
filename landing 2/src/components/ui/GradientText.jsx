export default function GradientText({
  children,
  type = 'primary',
  className = '',
}) {
  const types = {
    primary: 'text-gradient',
    gold: 'text-gradient-gold',
    cyan: 'text-gradient-cyan',
  };

  return (
    <span className={`${types[type]} ${className}`}>
      {children}
    </span>
  );
}
