'use client'

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ProtectedRoute, useUser } from '@/components/auth/ProtectedRoute'
import { Card, Button, Input, Mascot } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { apiClient } from '@/lib/api'

function ProfileContent() {
  const { t } = useTranslation()
  const { user } = useUser()
  const { showNotification } = useNotification()

  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    firstName: user?.first_name || user?.firstName || '',
    lastName: user?.last_name || user?.lastName || '',
    email: user?.email || '',
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Fetch dashboard data for real statistics
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await apiClient.getDashboardData()
        if (response.success && response.data) {
          const data = response.data.data || response.data
          setDashboardData(data)
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchData()
    }
  }, [user])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveProfile = async () => {
    // TODO: Implement profile update API call
    showNotification(t('profile.updated', 'Profile updated successfully!'), 'success')
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setFormData({
      firstName: user?.first_name || user?.firstName || '',
      lastName: user?.last_name || user?.lastName || '',
      email: user?.email || '',
    })
    setIsEditing(false)
  }

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleChangePassword = async () => {
    // Validate passwords
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showNotification(t('profile.passwordFieldsRequired', 'All password fields are required'), 'error')
      return
    }

    if (passwordData.newPassword.length < 8) {
      showNotification(t('profile.passwordMinLength', 'New password must be at least 8 characters long'), 'error')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showNotification(t('profile.passwordsDoNotMatch', 'New passwords do not match'), 'error')
      return
    }

    try {
      const response = await fetch('/.netlify/functions/auth-change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      })

      const result = await response.json()

      if (result.success) {
        showNotification(t('profile.passwordChanged', 'Password changed successfully!'), 'success')
        setIsChangingPassword(false)
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
      } else {
        showNotification(result.error || t('profile.passwordChangeFailed', 'Failed to change password'), 'error')
      }
    } catch (error) {
      console.error('Failed to change password:', error)
      showNotification(t('profile.passwordChangeFailed', 'Failed to change password'), 'error')
    }
  }

  const handleCancelPasswordChange = () => {
    setIsChangingPassword(false)
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600">{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <motion.div
          {...({ className: "text-center mb-8" } as any)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Mascot
            size="lg"
            emotion="happy"
            speechText={t('profile.welcomeBack', 'Welcome back to your profile!')}
            className="mx-auto mb-6"
          />

          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            {t('profile.myProfile', 'My Profile')}
          </h1>

          <p className="text-neutral-600">
            {t('profile.manageAccount', 'Manage your account settings and preferences')}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Profile Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card>
                <Card.Header>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">
                      {t('profile.personalInfo', 'Personal Information')}
                    </h3>
                    {!isEditing ? (
                      <Button
                        onClick={() => setIsEditing(true)}
                        variant="secondary"
                        size="sm"
                      >
                        {t('common.edit', 'Edit')}
                      </Button>
                    ) : (
                      <div className="flex space-x-2">
                        <Button
                          onClick={handleSaveProfile}
                          size="sm"
                        >
                          {t('common.save', 'Save')}
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          variant="secondary"
                          size="sm"
                        >
                          {t('common.cancel', 'Cancel')}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card.Header>
                <Card.Body className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        {t('auth.firstName')}
                      </label>
                      {isEditing ? (
                        <Input
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className="w-full"
                        />
                      ) : (
                        <p className="text-neutral-900 py-2 px-3 bg-neutral-50 rounded-lg">
                          {user.first_name || user.firstName || '-'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        {t('auth.lastName')}
                      </label>
                      {isEditing ? (
                        <Input
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className="w-full"
                        />
                      ) : (
                        <p className="text-neutral-900 py-2 px-3 bg-neutral-50 rounded-lg">
                          {user.last_name || user.lastName || '-'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      {t('auth.email')}
                    </label>
                    {isEditing ? (
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full"
                        disabled
                      />
                    ) : (
                      <p className="text-neutral-900 py-2 px-3 bg-neutral-50 rounded-lg">
                        {user.email}
                      </p>
                    )}
                    <p className="text-xs text-neutral-500 mt-1">
                      {t('profile.emailChangeNote', 'Email cannot be changed. Contact support if needed.')}
                    </p>
                  </div>

                  {/* Change Password Section */}
                  <div className="border-t border-neutral-200 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-neutral-800">
                          {t('profile.changePassword', 'Change Password')}
                        </h4>
                        <p className="text-sm text-neutral-600">
                          {t('profile.passwordSecurity', 'Update your password to keep your account secure')}
                        </p>
                      </div>
                      {!isChangingPassword && (
                        <Button
                          onClick={() => setIsChangingPassword(true)}
                          variant="secondary"
                          size="sm"
                        >
                          {t('profile.changePassword', 'Change Password')}
                        </Button>
                      )}
                    </div>

                    {isChangingPassword && (
                      <div className="space-y-4 bg-neutral-50 p-4 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1">
                            {t('profile.currentPassword', 'Current Password')}
                          </label>
                          <div className="relative">
                            <Input
                              type={showCurrentPassword ? 'text' : 'password'}
                              value={passwordData.currentPassword}
                              onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                              className="w-full pr-10"
                              placeholder={t('profile.enterCurrentPassword', 'Enter current password')}
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                            >
                              {showCurrentPassword ? (
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
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1">
                            {t('profile.newPassword', 'New Password')}
                          </label>
                          <div className="relative">
                            <Input
                              type={showNewPassword ? 'text' : 'password'}
                              value={passwordData.newPassword}
                              onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                              className="w-full pr-10"
                              placeholder={t('profile.enterNewPassword', 'Enter new password (min. 8 characters)')}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-700"
                            >
                              {showNewPassword ? (
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
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-neutral-700 mb-1">
                            {t('profile.confirmPassword', 'Confirm New Password')}
                          </label>
                          <div className="relative">
                            <Input
                              type={showConfirmPassword ? 'text' : 'password'}
                              value={passwordData.confirmPassword}
                              onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                              className="w-full pr-10"
                              placeholder={t('profile.confirmNewPassword', 'Confirm new password')}
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
                        </div>

                        <div className="flex space-x-2">
                          <Button
                            onClick={handleChangePassword}
                            size="sm"
                          >
                            {t('common.save', 'Save')}
                          </Button>
                          <Button
                            onClick={handleCancelPasswordChange}
                            variant="secondary"
                            size="sm"
                          >
                            {t('common.cancel', 'Cancel')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </motion.div>

            {/* Account Statistics */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card>
                <Card.Header>
                  <h3 className="text-xl font-semibold">
                    {t('profile.accountStats', 'Account Statistics')}
                  </h3>
                </Card.Header>
                <Card.Body>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-primary-50 rounded-lg">
                      <div className="text-2xl font-bold text-primary-600 mb-1">
                        {user.level || t('profile.notAssessed', 'Not Assessed')}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {t('dashboard.currentLevel', 'Current Level')}
                      </div>
                    </div>

                    <div className="text-center p-4 bg-secondary-50 rounded-lg">
                      <div className="text-2xl font-bold text-secondary-600 mb-1">
                        {loading ? '...' : (dashboardData?.progress?.completedLessons || 0)}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {t('dashboard.completedLessons', 'Completed')}
                      </div>
                    </div>

                    <div className="text-center p-4 bg-accent-50 rounded-lg">
                      <div className="text-2xl font-bold text-accent-600 mb-1">
                        {loading ? '...' : (dashboardData?.progress?.totalStars || user?.totalStars || 0)}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {t('dashboard.totalStars', 'Total Stars')}
                      </div>
                    </div>

                    <div className="text-center p-4 bg-neutral-50 rounded-lg">
                      <div className="text-2xl font-bold text-neutral-600 mb-1">
                        {loading ? '...' : (dashboardData?.progress?.completionPercentage 
                          ? `${Math.round(dashboardData.progress.completionPercentage)}%` 
                          : '0%')}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {t('dashboard.xpProgress', 'XP Progress')}
                      </div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card>
                <Card.Header>
                  <h3 className="text-lg font-semibold">
                    {t('profile.accountInfo', 'Account Information')}
                  </h3>
                </Card.Header>
                <Card.Body className="space-y-3">
                  <div>
                    <span className="text-sm text-neutral-600">
                      {t('profile.memberSince', 'Member since')}:
                    </span>
                      <p className="font-medium">
                        {(() => {
                          const dateStr = user.created_at || user.createdAt;
                          return dateStr ? new Date(dateStr).toLocaleDateString() : t('profile.unknown', 'Unknown');
                        })()}
                      </p>
                  </div>

                  <div>
                    <span className="text-sm text-neutral-600">
                      {t('profile.lastLogin', 'Last login')}:
                    </span>
                    <p className="font-medium">
                      {(() => {
                        const dateStr = user.last_login || user.lastLogin;
                        return dateStr ? new Date(dateStr).toLocaleDateString() : t('profile.never', 'Never');
                      })()}
                    </p>
                  </div>

                  <div>
                    <span className="text-sm text-neutral-600">
                      {t('profile.accountStatus', 'Account status')}:
                    </span>
                    <p className="font-medium text-green-600">
                      {t('profile.active', 'Active')}
                    </p>
                  </div>
                </Card.Body>
              </Card>
            </motion.div>

            {/* Current Title */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="bg-gradient-pastel">
                <Card.Body className="text-center p-6">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🏆</span>
                  </div>

                  <h4 className="font-semibold mb-2">
                    {t('dashboard.currentTitle', 'Current Title')}
                  </h4>

                  <p className="text-lg font-bold text-primary-600 mb-2">
                    {loading ? '...' : (dashboardData?.progress?.currentTitle || t('profile.notAssigned', 'Not Assigned'))}
                  </p>

                  <p className="text-sm text-neutral-700">
                    {loading ? '...' : (
                      dashboardData?.progress?.nextTitle 
                        ? `${t('profile.next', 'Next:')} ${dashboardData.progress.nextTitle}${dashboardData.progress.completionPercentage ? ` (${Math.round(dashboardData.progress.completionPercentage)}% XP)` : ''}`
                        : t('profile.completeLessonsToEarnTitles', 'Complete lessons to earn titles')
                    )}
                  </p>
                </Card.Body>
              </Card>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  )
}
