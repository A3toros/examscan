'use client'

'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface StarRatingProps {
  rating: number
  maxRating?: number
  size?: 'sm' | 'md' | 'lg'
  showEmpty?: boolean
  interactive?: boolean
  onRatingChange?: (rating: number) => void
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  showEmpty = true,
  interactive = false,
  onRatingChange
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  const handleClick = (starIndex: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(starIndex + 1)
    }
  }

  return (
    <div className="flex items-center space-x-1">
      {Array.from({ length: maxRating }, (_, index) => {
        const isFilled = index < rating
        const isPartial = !isFilled && rating > index && rating < index + 1

        return (
          <motion.div
            key={index}
            {...({
              className: `${sizeClasses[size]} ${
                interactive ? 'cursor-pointer' : ''
              }`,
              onClick: () => handleClick(index)
            } as any)}
            whileHover={interactive ? { scale: 1.1 } : {}}
            whileTap={interactive ? { scale: 0.9 } : {}}
          >
            {isFilled ? (
              <motion.svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-yellow-400"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1, type: 'spring', stiffness: 200 }}
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </motion.svg>
            ) : showEmpty ? (
              <motion.svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="text-gray-300"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </motion.svg>
            ) : null}
          </motion.div>
        )
      })}
    </div>
  )
}

export default StarRating
