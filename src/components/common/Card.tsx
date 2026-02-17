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
    borderRadius: '20px',
    border: '1px solid #F3F4F6',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
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
