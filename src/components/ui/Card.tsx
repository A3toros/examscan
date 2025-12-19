import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = false,
  onClick
}) => {
  const cardClasses = `bg-white rounded-lg shadow-md border border-gray-200 p-6 ${hover ? 'hover:shadow-lg transition-shadow cursor-pointer' : ''} ${className}`;

  if (onClick) {
    return (
      <motion.div
        whileHover={hover ? { scale: 1.02 } : {}}
        whileTap={{ scale: 0.98 }}
        className={cardClasses}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cardClasses}
    >
      {children}
    </motion.div>
  );
};

export default Card;
