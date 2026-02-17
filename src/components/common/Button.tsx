import { type ButtonHTMLAttributes, type ReactNode, type CSSProperties } from 'react';
import { motion } from 'motion/react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<string, CSSProperties> = {
  primary: {
    backgroundColor: '#4A5FC1', color: 'white',
    boxShadow: '0 2px 8px rgba(74, 95, 193, 0.3)',
  },
  secondary: {
    backgroundColor: '#8B7EC8', color: 'white',
    boxShadow: '0 2px 8px rgba(139, 126, 200, 0.3)',
  },
  outline: {
    backgroundColor: 'transparent', color: '#4A5FC1',
    border: '2px solid #4A5FC1',
  },
  ghost: {
    backgroundColor: 'transparent', color: '#6B7280',
  },
  danger: {
    backgroundColor: '#EF4444', color: 'white',
    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
  },
};

const sizeStyles: Record<string, CSSProperties> = {
  sm: { padding: '0.5rem 0.875rem', fontSize: '0.8125rem', gap: '0.375rem' },
  md: { padding: '0.625rem 1.25rem', fontSize: '0.875rem', gap: '0.5rem' },
  lg: { padding: '0.875rem 1.75rem', fontSize: '1rem', gap: '0.625rem' },
};

export default function Button({ variant = 'primary', size = 'md', children, fullWidth, className = '', disabled, style, ...props }: ButtonProps) {
  const baseStyle: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 500, borderRadius: '12px', border: 'none',
    transition: 'all 0.2s ease', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, fontFamily: 'inherit', lineHeight: 1.5,
    width: fullWidth ? '100%' : undefined,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      whileHover={disabled ? undefined : { opacity: 0.9 }}
      style={baseStyle}
      className={className}
      disabled={disabled}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}
