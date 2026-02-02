'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Modal } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useModal } from '@/contexts/ModalContext'
import { apiClient } from '@/lib/api'

interface LoginModalProps {
  onSuccess?: () => void
}

const LoginModal: React.FC<LoginModalProps> = ({ onSuccess }) => {
  const { t } = useTranslation()
  const { showModal } = useModal()
  const { refreshAuth } = useAuth()
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setError(null)
    if (!loginIdentifier.trim() || !password) {
      setError(t('auth.loginIdentifierAndPasswordRequired', 'Username/email and password are required'))
      return
    }

    setLoading(true)
    try {
      const response = await apiClient.login(loginIdentifier.trim(), password)

      console.log('LoginModal: Full login response', { 
        success: response.success,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        fullResponse: response
      })

      if (response.success && response.data) {
        const user = response.data.user
        const adminToken = response.data.adminToken

        console.log('LoginModal: Login successful', { 
          userRole: user?.role,
          email: user?.email
        })

        // Admin token is now set as HTTP cookie by the backend
        // No need to store in localStorage - cookies are sent automatically
        if (user?.role === 'admin') {
          console.log('LoginModal: Admin user logged in. Admin token is in HTTP cookie (admin_token)')
        }

        // Update auth context
        await refreshAuth()

        showModal(null) // Close modal

        // Small delay to ensure localStorage is persisted before redirect
        await new Promise(resolve => setTimeout(resolve, 200))

        if (onSuccess) {
          onSuccess()
        }
      } else {
        // Check if this is a rate limit error
        if (response.rateLimited || response.error?.toLowerCase().includes('too many')) {
          // Show the rate limit message from the API
          setError(response.error || 'Too many failed login attempts. Please wait before trying again.')
        } else {
          // For other errors, show generic message
          setError(t('auth.loginError', 'Incorrect email or password'))
        }
      }
    } catch (error) {
      setError(t('auth.loginError', 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  const { hideModal } = useModal()

  const modalContent = (
    <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">
          {t('auth.loginTitle', 'Welcome Back')}
        </h2>
      </div>

      <div className="space-y-6">
        <Input
          type="text"
          placeholder={t('auth.loginIdentifier', 'Username or Email')}
          value={loginIdentifier}
          onChange={(e) => setLoginIdentifier(e.target.value)}
          className="w-full"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleLogin()
            }
          }}
        />

        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder={t('auth.password', 'Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pr-10"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleLogin()
              }
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.05 8.05m1.829 1.829l4.242 4.242M12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-1.563 3.029m-5.858-.908a3 3 0 01-4.243-4.243" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        <Button
          onClick={handleLogin}
          loading={loading}
          className="w-full"
          size="lg"
        >
          {loading ? t('auth.loggingIn', 'Signing in...') : t('auth.login', 'Sign In')}
        </Button>

        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => {
              hideModal()
              // Small delay to ensure modal closes before opening new one
              setTimeout(() => {
                const ForgotPasswordModal = require('./ForgotPasswordModal').default
                showModal({ component: ForgotPasswordModal })
              }, 100)
            }}
            className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
          >
            {t('auth.forgotPassword', 'Forgot Password?')}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <Modal
      isOpen={true}
      onClose={hideModal}
      size="sm"
      className="max-w-sm"
    >
      {modalContent}
    </Modal>
  )
}

export default LoginModal
