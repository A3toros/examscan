'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ButtonProps } from '@/types'

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
}) => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const baseClasses = 'font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 inline-flex items-center justify-center touch-manipulation select-none'

  const variantClasses = {
    primary: 'bg-gradient-primary text-white hover:shadow-xl transform hover:scale-105 focus:ring-primary-400',
    secondary: 'bg-white text-primary-600 border-2 border-primary-200 hover:border-primary-300 hover:bg-primary-50 focus:ring-primary-400',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400',
    ghost: 'bg-transparent text-primary-600 hover:bg-primary-50 focus:ring-primary-400',
  }

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  }

  const disabledClasses = disabled || loading ? 'opacity-50 cursor-not-allowed transform-none hover:scale-100' : ''

  const buttonClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`

  // Handle touch events for better mobile support
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disabled || loading) return
    e.preventDefault()
    if (onClick) {
      onClick(e as any)
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Use console.warn for debug logs - visible but not as alarming as console.error
    console.warn('🔵 Button: onClick handler called', {
      disabled,
      loading,
      hasOnClick: !!onClick,
      eventType: e.type
    });
    if (disabled || loading) {
      console.warn('⚠️ Button: Click ignored - button is disabled or loading');
      return;
    }
    if (onClick) {
      console.warn('✅ Button: Calling onClick callback');
      onClick(e);
    } else {
      console.warn('⚠️ Button: No onClick callback provided');
    }
  };

  return (
    <motion.button
      {...({
        className: buttonClasses,
        onClick: handleClick,
        onTouchEnd: handleTouchEnd,
        disabled: disabled || loading,
        style: { touchAction: 'manipulation' } as any
      } as any)}
      whileHover={!disabled && !loading && !isMobile ? { scale: 1.05 } : {}}
      whileTap={!disabled && !loading && !isMobile ? { scale: 0.95 } : {}}
      transition={{ duration: 0.1 }}
    >
      {loading && (
        <motion.div
          {...({ className: "w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" } as any)}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {children}
    </motion.button>
  )
}

export default Button
