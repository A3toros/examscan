'use client'

'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Modal from './Modal'
import Button from './Button'
import { useTheme } from '@/contexts/ThemeContext'

interface ButtonOption {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

interface ButtonModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message?: string
  buttons: ButtonOption[]
  size?: 'sm' | 'md' | 'lg'
}

const ButtonModal: React.FC<ButtonModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  buttons,
  size = 'md',
}) => {
  const { theme, isCyberpunk, isKpop } = useTheme()

  const handleButtonClick = (onClick: () => void) => {
    onClick()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size={size}>
      <div className="modal-content bg-white rounded-xl shadow-2xl p-6">
        <motion.div
          {...({ className: "text-center" } as any)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h3 className={`text-xl font-bold mb-4 ${
            isCyberpunk ? 'text-cyan-400' :
            isKpop ? 'text-gray-900' :
            'text-gray-900'
          }`}>
            {title}
          </h3>

          {message && (
            <p className={`mb-6 text-sm ${
              isCyberpunk ? 'text-cyan-300' :
              isKpop ? 'text-gray-600' :
              'text-gray-600'
            }`}>
              {message}
            </p>
          )}

          <motion.div
            {...({
              className: `flex flex-col sm:flex-row gap-3 justify-center ${
                buttons.length > 2 ? 'sm:flex-wrap' : ''
              }`
            } as any)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            {buttons.map((button, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.1 * index,
                  duration: 0.2,
                  type: 'spring',
                  stiffness: 200
                }}
              >
                <Button
                  onClick={() => handleButtonClick(button.onClick)}
                  variant={button.variant || 'primary'}
                  disabled={button.disabled}
                  className="min-w-[120px]"
                >
                  {button.label}
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </Modal>
  )
}

export default ButtonModal
