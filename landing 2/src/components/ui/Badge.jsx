export default function Badge({
  children,
  variant = 'primary',
  className = '',
}) {
  const variants = {
    primary: 'bg-primary-500/20 text-primary-600 dark:text-primary-400 border border-primary-500/30',
    success: 'bg-success/20 text-success dark:text-green-400 border border-success/30',
    warning: 'bg-warning/20 text-warning dark:text-yellow-400 border border-warning/30',
    danger: 'bg-danger/20 text-danger dark:text-red-400 border border-danger/30',
    gold: 'bg-accent/20 text-accent dark:text-accent border border-accent/30',
  };

  return (
    <span
      className={`
        inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
        ${variants[variant]} ${className}
      `}
    >
      {children}
    </span>
  );
}
