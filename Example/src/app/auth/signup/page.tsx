'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button, Input, Mascot, Card } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { apiClient } from '@/lib/api'
import { validateUserRegistration, getPasswordStrength } from '@/utils/validation'

const SignupPage: React.FC = () => {
  const { t } = useTranslation()
  const router = useRouter()
  const { showNotification } = useNotification()

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
  })

  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState({
    checking: false,
    available: null as boolean | null,
    message: '',
    showChecking: false
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Trigger username check when username field changes
    if (field === 'username') {
      debouncedCheckUsername(value);
    }
  }

  const checkUsernameAvailability = async (value: string) => {
    const username = value.trim();
    if (!username) {
      setUsernameStatus({ checking: false, available: null, message: '', showChecking: false });
      return false;
    }
    setUsernameStatus({ checking: true, available: null, message: '', showChecking: false });

    try {
      // Sanitize username before sending to API
      const sanitizedUsername = username.replace(/[<>\"'&]/g, '').trim();
      if (!sanitizedUsername || sanitizedUsername !== username) {
        // Username contains invalid characters
        setUsernameStatus({
          checking: false,
          available: null,
          message: 'Invalid username format',
          showChecking: false
        });
        return false;
      }

      const response = await fetch(`/api/check-username?username=${encodeURIComponent(sanitizedUsername)}`);
      const data = await response.json();

      if (response.ok) {
        // Only use the 'available' field from response - ignore any other fields
        const available = !!data.available;
        setUsernameStatus({
          checking: false,
          available,
          message: available ? 'Username is available' : 'Username is already taken',
          showChecking: false
        });
        return available;
      } else {
        // Sanitize error message if present
        const errorMessage = data.error ? String(data.error).replace(/[<>\"'&]/g, '') : 'Could not verify username';
        setUsernameStatus({
          checking: false,
          available: null,
          message: errorMessage,
          showChecking: false
        });
        return false;
      }
    } catch (error) {
      console.error('Username check failed:', error);
      setUsernameStatus({
        checking: false,
        available: null,
        message: 'Could not verify username',
        showChecking: false
      });
      return false;
    }
  };

  // Debounced username checking
  const debouncedCheckUsername = (() => {
    let timeout: NodeJS.Timeout;
    let showTimeout: NodeJS.Timeout;
    return (value: string) => {
      if (timeout) clearTimeout(timeout);
      if (showTimeout) clearTimeout(showTimeout);

      // Only check if username is at least 3 characters and has stopped typing for 300ms
      if (value.length >= 3) {
        // Set checking state immediately but show spinner after delay to prevent flickering
        setUsernameStatus(prev => ({ ...prev, checking: true, available: null, message: '', showChecking: false }));
        showTimeout = setTimeout(() => {
          setUsernameStatus(prev => prev.checking ? { ...prev, showChecking: true } : prev);
        }, 150);

        timeout = setTimeout(() => checkUsernameAvailability(value), 300);
      } else {
        // Clear status for short usernames
        setUsernameStatus({ checking: false, available: null, message: '', showChecking: false });
      }
    };
  })();

  const validateForm = () => {
    // Check username availability first
    if (usernameStatus.available === false) {
      showNotification('Please choose an available username', 'error')
      return false
    }

    // Check if username has been verified
    if (formData.username && usernameStatus.available !== true) {
      showNotification('Please wait for username verification', 'error')
      return false
    }

    const validation = validateUserRegistration(formData)

    if (!validation.isValid) {
      // Show the first validation error - translate the key
      const firstError = Object.values(validation.errors)[0]
      const translatedError = t(firstError, firstError) // Use translation, fallback to original
      showNotification(translatedError, 'error')
      return false
    }

    return true
  }

  const handleSendOTP = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      const response = await apiClient.sendOTP(formData.email, 'signup')

      if (response.success) {
        showNotification(t('auth.otpSent'), 'success')
        setStep('otp')
      } else {
        showNotification(response.error || t('auth.sendOtpError', 'Failed to send OTP'), 'error')
      }
    } catch (error) {
      showNotification(t('auth.sendOtpError', 'Failed to send OTP'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      showNotification(t('auth.invalidOtp'), 'error')
      return
    }

    setLoading(true)
    try {
      const response = await apiClient.verifyOTP(
        formData.email,
        otp,
        'signup',
        formData.firstName,
        formData.lastName,
        formData.username,
        formData.password
      )

      if (response.success) {
        showNotification(t('auth.signupSuccess'), 'success')
        router.push('/dashboard')
      } else {
        showNotification(response.error || t('auth.signupError', 'Signup failed'), 'error')
      }
    } catch (error) {
      showNotification(t('auth.signupError', 'Signup failed'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToForm = () => {
    setStep('form')
    setOtp('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto">
          <motion.div
            {...({ className: "text-center mb-8" } as any)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Mascot
              size="xl"
              emotion="excited"
              speechText={t('auth.signupTitle')}
              className="mx-auto mb-6"
            />

            <h1 className="text-3xl font-bold text-neutral-900 mb-2">
              {t('auth.signupTitle')}
            </h1>
            <p className="text-neutral-600">
              {t('auth.signupDescription', 'Create your account and start learning!')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="shadow-2xl border-0">
              <Card.Body className="p-8">
                {step === 'form' ? (
                  <motion.div
                    {...({ className: "space-y-4" } as any)}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        placeholder={t('auth.firstName')}
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className="w-full"
                      />
                      <Input
                        placeholder={t('auth.lastName')}
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="w-full"
                      />
                    </div>

                    {/* Username field with availability checking */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          placeholder={t('auth.username', 'Username')}
                          value={formData.username}
                          onChange={(e) => handleInputChange('username', e.target.value)}
                          className="w-full pr-10"
                          maxLength={32}
                        />
                        {/* Status indicator */}
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-all duration-300 ease-in-out">
                          {usernameStatus.showChecking ? (
                            <div className="opacity-100 scale-100">
                              <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          ) : usernameStatus.message ? (
                            <div className={`text-sm font-medium transition-all duration-300 ease-in-out ${
                              usernameStatus.available === true
                                ? 'text-green-600 scale-100 opacity-100'
                                : usernameStatus.available === false
                                ? 'text-red-500 scale-100 opacity-100'
                                : 'text-gray-500 scale-95 opacity-70'
                            }`}>
                              {usernameStatus.available === true ? '✓' :
                               usernameStatus.available === false ? '✗' : ''}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {/* Username availability message */}
                      <div className="min-h-[20px] transition-all duration-300 ease-in-out">
                        {usernameStatus.message && (
                          <p className={`text-xs transition-all duration-300 ease-in-out ${
                            usernameStatus.available ? 'text-green-600 translate-y-0 opacity-100' : 'text-red-500 translate-y-0 opacity-100'
                          }`}>
                            {/* React automatically escapes JSX content - message is already sanitized in checkUsernameAvailability */}
                            {usernameStatus.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <Input
                      type="email"
                      placeholder={t('auth.email')}
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full"
                      maxLength={254}
                    />

                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder={t('auth.password', 'Password')}
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          className="w-full pr-12"
                          maxLength={128}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-700 focus:outline-none"
                        >
                          {showPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Password strength hints */}
                      {formData.password && (
                        <div className="text-xs space-y-1">
                          <div className={`flex items-center space-x-2 ${getPasswordStrength(formData.password).requirements.length ? 'text-green-600' : 'text-red-500'}`}>
                            <span className={getPasswordStrength(formData.password).requirements.length ? '✓' : '✗'}></span>
                            <span>{t('auth.passwordHint.length', 'At least 8 characters')}</span>
                          </div>
                          <div className={`flex items-center space-x-2 ${getPasswordStrength(formData.password).requirements.hasLetter ? 'text-green-600' : 'text-red-500'}`}>
                            <span className={getPasswordStrength(formData.password).requirements.hasLetter ? '✓' : '✗'}></span>
                            <span>{t('auth.passwordHint.letter', 'At least 1 letter')}</span>
                          </div>
                          <div className={`flex items-center space-x-2 ${getPasswordStrength(formData.password).requirements.hasNumber ? 'text-green-600' : 'text-red-500'}`}>
                            <span className={getPasswordStrength(formData.password).requirements.hasNumber ? '✓' : '✗'}></span>
                            <span>{t('auth.passwordHint.number', 'At least 1 number')}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleSendOTP}
                      loading={loading}
                      className="w-full"
                      size="lg"
                    >
                      {t('auth.createAccount', 'Create Account')}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    {...({ className: "space-y-4" } as any)}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">📧</span>
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {t('auth.checkEmail', 'Check your email')}
                      </h3>
                      <p className="text-sm text-neutral-600 mb-4">
                        {t('auth.otpSentTo', 'We sent a verification code to')} {formData.email}
                      </p>

                      <Input
                        type="text"
                        placeholder="000000"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full text-center text-2xl font-mono tracking-widest"
                        maxLength={6}
                        autoFocus
                      />
                    </div>

                    <Button
                      onClick={handleVerifyOTP}
                      loading={loading}
                      className="w-full"
                      size="lg"
                    >
                      {t('auth.verifyAndCreate', 'Verify & Create Account')}
                    </Button>

                    <div className="flex justify-between items-center">
                      <button
                        onClick={handleBackToForm}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        {t('common.back', 'Back')}
                      </button>

                      <button
                        onClick={handleSendOTP}
                        disabled={loading}
                        className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
                      >
                        {t('auth.resendOtp')}
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="mt-6 pt-4 border-t border-neutral-200">
                  <p className="text-center text-sm text-neutral-600">
                    {t('auth.haveAccount', 'Already have an account?')}{' '}
                    <button
                      onClick={() => router.push('/')}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      {t('header.login')}
                    </button>
                  </p>
                </div>
              </Card.Body>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default SignupPage
