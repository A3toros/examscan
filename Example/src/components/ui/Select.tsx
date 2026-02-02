import React from 'react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
}

const Select: React.FC<SelectProps> = ({ className = '', children, ...props }) => {
  return (
    <select
      className={`w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export default Select
