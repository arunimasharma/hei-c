import { type ReactNode, type CSSProperties } from 'react';
import { motion } from 'motion/react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

export default function Card({ children, className = '', hover = false, onClick, style }: CardProps) {
  const cardStyle: CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '16px',
    border: '1px solid rgba(0,0,0,0.06)',
    padding: '1.5rem',
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
    cursor: onClick ? 'pointer' : undefined,
    ...style,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hover ? { y: -2, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' } : undefined}
      onClick={onClick}
      style={cardStyle}
      className={className}
    >
      {children}
    </motion.div>
  );
}
