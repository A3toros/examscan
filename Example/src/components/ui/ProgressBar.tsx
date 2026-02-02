'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface ProgressBarProps {
  progress: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'secondary' | 'accent' | 'success'
  showPercentage?: boolean
  animated?: boolean
  className?: string
  label?: string
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  size = 'md',
  color = 'primary',
  showPercentage = false,
  animated = true,
  className = '',
  label,
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress))

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  }

  const colorClasses = {
    primary: 'bg-gradient-primary',
    secondary: 'bg-gradient-secondary',
    accent: 'bg-accent-500',
    success: 'bg-green-500',
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center">
          {label && (
            <span className="text-sm font-medium text-neutral-700">
              {label}
            </span>
          )}
          {showPercentage && (
            <span className="text-sm font-medium text-neutral-600">
              {clampedProgress}%
            </span>
          )}
        </div>
      )}

      <div className={`progress-bar ${sizeClasses[size]} rounded-full overflow-hidden`}>
        <motion.div
          {...({
            className: `progress-fill ${colorClasses[color]} rounded-full`,
            style: { width: `${clampedProgress}%` }
          } as any)}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{
            duration: animated ? 1 : 0,
            ease: 'easeOut'
          }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
