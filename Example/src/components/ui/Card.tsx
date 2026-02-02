'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

interface CardHeaderProps {
  children: React.ReactNode
  className?: string
}

interface CardBodyProps {
  children: React.ReactNode
  className?: string
}

interface CardFooterProps {
  children: React.ReactNode
  className?: string
}

const Card: React.FC<CardProps> & {
  Header: React.FC<CardHeaderProps>
  Body: React.FC<CardBodyProps>
  Footer: React.FC<CardFooterProps>
} = ({
  children,
  className = '',
  hover = false,
  onClick,
}) => {
  const baseClasses = 'bg-white rounded-xl shadow-lg border border-neutral-200'
  const hoverClasses = hover ? 'hover:shadow-xl transition-shadow duration-300' : ''
  const clickClasses = onClick ? 'cursor-pointer' : ''

  const cardClasses = `${baseClasses} ${hoverClasses} ${clickClasses} ${className}`

  const CardComponent = motion.div

  return (
    <CardComponent
      {...({
        className: cardClasses,
        onClick: onClick
      } as any)}
      whileHover={hover ? { y: -2 } : {}}
      transition={{ duration: 0.2 }}
    >
      {children}
    </CardComponent>
  )
}

const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 border-b border-neutral-100 ${className}`}>
      {children}
    </div>
  )
}

const CardBody: React.FC<CardBodyProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  )
}

const CardFooter: React.FC<CardFooterProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 border-t border-neutral-100 ${className}`}>
      {children}
    </div>
  )
}

Card.Header = CardHeader
Card.Body = CardBody
Card.Footer = CardFooter

export default Card
