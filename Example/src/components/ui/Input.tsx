'use client'

import React, { forwardRef } from 'react'
import { motion } from 'framer-motion'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  helperText?: string
  variant?: 'default' | 'filled'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  variant = 'default',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}, ref) => {
  const baseClasses = 'border rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-colors duration-200 placeholder-neutral-400'

  const variantClasses = {
    default: 'border-neutral-300 bg-white',
    filled: 'border-neutral-300 bg-neutral-50',
  }

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-4 py-3 text-lg',
  }

  const widthClass = fullWidth ? 'w-full' : ''
  const errorClass = error ? 'border-red-500 focus:ring-red-400 focus:border-red-500' : ''

  const inputClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${errorClass} ${className}`

  return (
    <motion.div
      {...({ className: "space-y-1" } as any)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {label && (
        <label className="block text-sm font-medium text-neutral-700">
          {label}
        </label>
      )}

      <input
        ref={ref}
        className={inputClasses}
        {...props}
      />

      {error && (
        <motion.p
          {...({ className: "text-sm text-red-600" } as any)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {error}
        </motion.p>
      )}

      {helperText && !error && (
        <p className="text-sm text-neutral-500">
          {helperText}
        </p>
      )}
    </motion.div>
  )
})

Input.displayName = 'Input'

export default Input
