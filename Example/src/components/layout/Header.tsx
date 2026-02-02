'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { getAvailableLanguages, getCurrentLanguage, setAppLang } from '@/lib/langManager'
import { useNotification } from '@/contexts/NotificationContext'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'
import CachedImage from '@/components/ui/CachedImage'
import Modal from '@/components/ui/Modal'

interface HeaderProps {
  showAuth?: boolean
  onLogin?: () => void
  onSignup?: () => void
  onLogout?: () => void
  isLoggedIn?: boolean
  userName?: string
}

const Header: React.FC<HeaderProps> = ({
  showAuth = true,
  onLogin,
  onSignup,
  onLogout,
  isLoggedIn = false,
  userName,
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const { showNotification } = useNotification()
  const { theme, isCyberpunk, isKpop } = useTheme()
  const { user } = useAuth()
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // Determine if user is logged in (prefer prop, fallback to auth context)
  // Only check after mount to avoid hydration mismatch
  const isUserLoggedIn = mounted ? (isLoggedIn || !!user) : isLoggedIn

  // Handle hydration issues by delaying language detection until client-side
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const currentLang = mounted ? getCurrentLanguage() : getAvailableLanguages().find(lang => lang.code === 'en')
  const languages = getAvailableLanguages()

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true)
  }

  const handleLogout = async () => {
    setShowLogoutConfirm(false)
    setIsLoggingOut(true)
    try {
      const response = await apiClient.logout()

      if (response.success) {
        showNotification(t('auth.logoutSuccess', 'Logged out successfully'), 'success')

        // Call the onLogout prop if provided
        if (onLogout) {
          onLogout()
        } else {
          // Default behavior: redirect to home
          router.push('/')
        }
      } else {
        showNotification(response.error || t('auth.logoutError', 'Logout failed'), 'error')
      }
    } catch (error) {
      showNotification(t('auth.logoutError', 'Logout failed'), 'error')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleLanguageChange = (langCode: 'en' | 'th') => {
    setAppLang(langCode)
    setShowLanguageDropdown(false)
  }

  return (
    <motion.header
      {...({
        className: `fixed top-0 left-0 right-0 z-40 border-b backdrop-blur-md ${
          isCyberpunk
            ? 'bg-black/80 border-cyan-500/30'
            : isKpop
            ? 'bg-black/80 border-pink-500/30'
            : 'bg-white/80 border-neutral-200'
        }`
      } as any)}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <Link 
            href={isUserLoggedIn ? '/dashboard' : '/'}
            className="flex items-center space-x-2 cursor-pointer"
          >
            <motion.div
              {...({ className: "flex items-center space-x-2" } as any)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <img 
                src="/logo.webp" 
                alt="TutorCat Logo" 
                className="h-9 w-9 object-contain flex-shrink-0"
                suppressHydrationWarning
              />
              <h1 className={`text-base sm:text-lg font-semibold whitespace-nowrap ${
                isCyberpunk ? 'text-cyan-400' :
                isKpop ? 'text-pink-400' :
                'text-primary-600'
              }`}>
                {mounted ? t('header.brand') : 'TutorCat'}
              </h1>
            </motion.div>
          </Link>

          {/* Right side actions */}
          <div className="flex items-center space-x-3">

            {/* Auth buttons */}
            {showAuth && !isLoggedIn && (
              <div className="flex items-center space-x-2">
                <Button
                  onClick={onLogin}
                  variant="secondary"
                  size="sm"
                  className="h-9 px-4 text-xs font-medium min-w-[80px]"
                >
                  {mounted ? t('header.login') : 'Login'}
                </Button>
                <Button
                  onClick={onSignup}
                  size="sm"
                  className="h-9 px-4 text-xs font-medium min-w-[80px]"
                >
                  {mounted ? t('header.signup') : 'Sign Up'}
                </Button>
              </div>
            )}

            {/* Logout button */}
            {isLoggedIn && (
              <Button
                onClick={handleLogoutClick}
                variant="secondary"
                size="sm"
                loading={isLoggingOut}
                className="h-9 px-4 text-sm font-medium min-w-[80px]"
              >
                {mounted ? t('header.logout') : 'Logout'}
              </Button>
            )}

            {/* Language Selector */}
            <div className="relative">
              <motion.button
                {...({
                  onClick: () => setShowLanguageDropdown(!showLanguageDropdown),
                  className: `flex items-center justify-center space-x-1 sm:space-x-2 h-9 px-2 sm:px-4 rounded-lg border transition-all duration-200 ${
                    isCyberpunk
                      ? 'bg-black border-cyan-500/50 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-950/20'
                      : isKpop
                      ? 'bg-black border-pink-500/50 text-pink-400 hover:border-pink-400 hover:bg-pink-950/20'
                      : 'bg-white border-neutral-300 text-neutral-700 hover:border-primary-400 hover:bg-primary-50'
                  }`
                } as any)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <CachedImage
                  src={currentLang?.flag || '/us-flag.png'}
                  alt={`${currentLang?.name} flag`}
                  className="w-5 h-5 object-contain rounded-full flex-shrink-0"
                />
                <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">
                  {currentLang?.nativeName}
                </span>
                <motion.svg
                  className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${
                    showLanguageDropdown ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </motion.button>

              <AnimatePresence>
                {showLanguageDropdown && (
                  <motion.div
                    {...({
                      className: `absolute right-0 mt-2 w-48 rounded-lg shadow-lg border z-50 ${
                        isCyberpunk
                          ? 'bg-black border-cyan-500/30'
                          : isKpop
                          ? 'bg-black border-pink-500/30'
                          : 'bg-white border-neutral-200'
                      }`
                    } as any)}
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="py-1">
                      {languages.map((lang) => (
                        <motion.button
                          key={lang.code}
                          {...({
                            onClick: () => handleLanguageChange(lang.code),
                            className: `flex items-center space-x-3 w-full px-4 py-3 text-left transition-colors ${
                              isCyberpunk
                                ? 'hover:bg-cyan-950/30 text-cyan-300'
                                : isKpop
                                ? 'hover:bg-pink-950/30 text-pink-300'
                                : 'hover:bg-neutral-50 text-neutral-700'
                            } ${
                              currentLang?.code === lang.code
                                ? isCyberpunk
                                  ? 'bg-cyan-950/50'
                                  : isKpop
                                  ? 'bg-pink-950/50'
                                  : 'bg-primary-50'
                                : ''
                            }`
                          } as any)}
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <CachedImage
                            src={lang.flag}
                            alt={`${lang.name} flag`}
                            className="w-6 h-6 object-contain rounded-full flex-shrink-0"
                          />
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-sm font-medium">{lang.nativeName}</span>
                            <span className="text-xs opacity-70 hidden sm:inline">{lang.name}</span>
                          </div>
                          {currentLang?.code === lang.code && (
                            <motion.div
                              {...({ className: "ml-auto" } as any)}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                            >
                              <svg className="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </motion.div>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title={t('auth.logoutConfirmTitle', 'Confirm Logout')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            {t('auth.logoutConfirmMessage', 'Are you sure you want to logout?')}
          </p>
          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button
              onClick={() => setShowLogoutConfirm(false)}
              variant="secondary"
              size="sm"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleLogout}
              size="sm"
              loading={isLoggingOut}
              className="bg-red-500 hover:bg-red-600"
            >
              {t('header.logout', 'Logout')}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.header>
  )
}

export default Header
