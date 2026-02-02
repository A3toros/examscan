'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Modal } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { useModal } from '@/contexts/ModalContext'
import { apiClient } from '@/lib/api'

const ForgotPasswordModal: React.FC = () => {
  const { t } = useTranslation()
  const { showNotification } = useNotification()
  const { hideModal } = useModal()
  
  const [step, setStep] = useState<'email' | 'otp' | 'newPassword'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSendOTP = async () => {
    if (!email.trim()) {
      showNotification(t('auth.emailRequired', 'Email is required'), 'error')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/.netlify/functions/auth-send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), type: 'password_reset' })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        console.error('ForgotPasswordModal: OTP send failed', {
          status: response.status,
          statusText: response.statusText,
          data
        })
      }

      if (data.success) {
        showNotification(t('auth.otpSent', 'Verification code sent to your email'), 'success')
        setStep('otp')
      } else {
        const errorMsg = data.error || t('auth.otpSendError', 'Failed to send verification code')
        console.error('ForgotPasswordModal: Error response', errorMsg)
        showNotification(errorMsg, 'error')
      }
    } catch (error) {
      console.error('ForgotPasswordModal: Network error', error)
      showNotification(t('auth.otpSendError', 'Failed to send verification code'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) {
      showNotification(t('auth.otpRequired', 'Please enter the 6-digit verification code'), 'error')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/.netlify/functions/auth-verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          email: email.trim(), 
          otp: otp.trim(),
          type: 'password_reset'
        })
      })
      const data = await response.json()
      
      if (!response.ok) {
        console.error('ForgotPasswordModal: OTP verify failed', {
          status: response.status,
          statusText: response.statusText,
          data
        })
      }

      if (data.success) {
        showNotification(t('auth.otpVerified', 'Verification code confirmed'), 'success')
        setStep('newPassword')
      } else {
        const errorMsg = data.error || t('auth.otpInvalid', 'Invalid verification code')
        console.error('ForgotPasswordModal: OTP verify error', errorMsg)
        showNotification(errorMsg, 'error')
      }
    } catch (error) {
      showNotification(t('auth.otpInvalid', 'Invalid verification code'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      showNotification(t('auth.passwordMinLength', 'Password must be at least 8 characters'), 'error')
      return
    }

    if (newPassword !== confirmPassword) {
      showNotification(t('auth.passwordsDoNotMatch', 'Passwords do not match'), 'error')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/.netlify/functions/auth-reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          email: email.trim(),
          otp: otp.trim(),
          newPassword: newPassword
        })
      })
      const data = await response.json()
      
      if (!response.ok) {
        console.error('ForgotPasswordModal: Password reset failed', {
          status: response.status,
          statusText: response.statusText,
          data
        })
      }

      if (data.success) {
        showNotification(t('auth.passwordResetSuccess', 'Password reset successfully. You can now log in.'), 'success')
        hideModal()
        // User can now click login button
      } else {
        const errorMsg = data.error || t('auth.passwordResetError', 'Failed to reset password')
        console.error('ForgotPasswordModal: Password reset error', errorMsg)
        showNotification(errorMsg, 'error')
      }
    } catch (error) {
      showNotification(t('auth.passwordResetError', 'Failed to reset password'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const modalContent = (
    <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 max-w-md w-full mx-2 sm:mx-auto">
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-1 sm:mb-2">
          {step === 'email' && t('auth.forgotPassword', 'Forgot Password?')}
          {step === 'otp' && t('auth.verifyCode', 'Verify Code')}
          {step === 'newPassword' && t('auth.setNewPassword', 'Set New Password')}
        </h2>
        <p className="text-xs sm:text-sm text-neutral-600 px-2">
          {step === 'email' && t('auth.forgotPasswordDesc', 'Enter your email to receive a verification code')}
          {step === 'otp' && t('auth.otpDesc', 'Enter the 6-digit code sent to your email')}
          {step === 'newPassword' && t('auth.newPasswordDesc', 'Enter your new password')}
        </p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {step === 'email' && (
          <>
            <Input
              type="email"
              placeholder={t('auth.email', 'Email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendOTP()
                }
              }}
            />
            <Button
              onClick={handleSendOTP}
              loading={loading}
              className="w-full"
              size="md"
            >
              {t('auth.sendCode', 'Send Verification Code')}
            </Button>
          </>
        )}

        {step === 'otp' && (
          <>
            <Input
              type="text"
              placeholder={t('auth.enterCode', 'Enter 6-digit code')}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full text-center text-xl sm:text-2xl tracking-widest"
              autoFocus
              maxLength={6}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && otp.length === 6) {
                  handleVerifyOTP()
                }
              }}
            />
            <div className="flex gap-2 sm:gap-3">
              <Button
                onClick={() => setStep('email')}
                variant="secondary"
                className="flex-1"
                size="md"
              >
                {t('auth.back', 'Back')}
              </Button>
              <Button
                onClick={handleVerifyOTP}
                loading={loading}
                disabled={otp.length !== 6}
                className="flex-1"
                size="md"
              >
                {t('auth.verify', 'Verify')}
              </Button>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={handleSendOTP}
                className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
              >
                {t('auth.resendCode', 'Resend Code')}
              </button>
            </div>
          </>
        )}

        {step === 'newPassword' && (
          <>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.newPassword', 'New Password')}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pr-10"
                autoFocus
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

            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder={t('auth.confirmPassword', 'Confirm Password')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pr-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPassword && confirmPassword) {
                    handleResetPassword()
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
              >
                {showConfirmPassword ? (
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

            <div className="flex gap-2 sm:gap-3">
              <Button
                onClick={() => setStep('otp')}
                variant="secondary"
                className="flex-1"
                size="md"
              >
                {t('auth.back', 'Back')}
              </Button>
              <Button
                onClick={handleResetPassword}
                loading={loading}
                disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="flex-1"
                size="md"
              >
                {t('auth.resetPassword', 'Reset Password')}
              </Button>
            </div>
          </>
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

export default ForgotPasswordModal

