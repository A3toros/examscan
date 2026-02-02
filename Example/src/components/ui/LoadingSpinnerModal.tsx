'use client'

'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Modal from './Modal'
import LoadingSpinner from './LoadingSpinner'
import { useTheme } from '@/contexts/ThemeContext'

interface LoadingSpinnerModalProps {
  isOpen: boolean
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

const LoadingSpinnerModal: React.FC<LoadingSpinnerModalProps> = ({
  isOpen,
  message = 'Loading...',
  size = 'md',
}) => {
  const { theme, isCyberpunk, isKpop } = useTheme()

  return (
    <Modal isOpen={isOpen} onClose={() => {}} size="sm">
      <div className="modal-content bg-white rounded-xl shadow-2xl p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        >
          <LoadingSpinner size={size} className="mx-auto mb-4" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <p className={`text-lg font-medium ${
            isCyberpunk ? 'text-cyan-400' :
            isKpop ? 'text-pink-500' :
            'text-gray-700'
          }`}>
            {message}
          </p>
        </motion.div>

        {/* Animated dots */}
        <motion.div
          {...({ className: "flex justify-center space-x-1 mt-4" } as any)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              {...({
                className: `w-2 h-2 rounded-full ${
                  isCyberpunk ? 'bg-cyan-400' :
                  isKpop ? 'bg-pink-500' :
                  'bg-primary-500'
                }`
              } as any)}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>
      </div>
    </Modal>
  )
}

export default LoadingSpinnerModal
