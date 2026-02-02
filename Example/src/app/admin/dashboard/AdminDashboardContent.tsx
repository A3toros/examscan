'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { getAvailableLanguages, getCurrentLanguage, setAppLang } from '@/lib/langManager'
import CachedImage from '@/components/ui/CachedImage'
import { Card, Button, Input, Table, Header, Body, Row, Head, Cell, Select, Modal } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { User } from '@/types'
import UserGrowthChart from '@/components/admin/UserGrowthChart'
import ActivityChart from '@/components/admin/ActivityChart'
import apiClient from '@/lib/api'
import { adminApiRequest } from '@/utils/adminApi'

interface UserStats {
  totalUsers: number
  activeToday: number
  newThisWeek: number
  averageLevel: string
}

export default function AdminDashboardContent() {
  const { t } = useTranslation('admin')
  const router = useRouter()
  const { showNotification } = useNotification()

  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    activeToday: 0,
    newThisWeek: 0,
    averageLevel: 'A1'
  })
  const [chartData, setChartData] = useState<{
    userGrowth: any[]
    activity: any[]
    period: string
    hasRealData: boolean
  }>({
    userGrowth: [],
    activity: [],
    period: 'month',
    hasRealData: false
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [sortColumn, setSortColumn] = useState<string>('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [userLessons, setUserLessons] = useState<any[]>([])
  const [isLoadingLessons, setIsLoadingLessons] = useState(false)
  const [isUserLessonsModalOpen, setIsUserLessonsModalOpen] = useState(false)
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set())
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Content state
  const [lessons, setLessons] = useState<any[]>([])
  const [evaluationTests, setEvaluationTests] = useState<any[]>([])
  const [contentStats, setContentStats] = useState({
    totalLessons: 0,
    publishedLessons: 0,
    draftLessons: 0,
    evaluationTests: 0
  })

  const usersPerPage = 50

  // Handle hydration issues by delaying language detection until client-side
  useEffect(() => {
    setMounted(true)
  }, [])

  const currentLang = mounted ? getCurrentLanguage() : getAvailableLanguages().find(lang => lang.code === 'en')
  const languages = getAvailableLanguages()

  const handleLanguageChange = (langCode: 'en' | 'th') => {
    setAppLang(langCode)
    setShowLanguageDropdown(false)
  }

  // Create minimal chart data for current state
  const createMinimalUserGrowth = (totalUsers: number) => {
    const today = new Date()
    return [{
      date: today.toISOString().split('T')[0],
      newUsers: totalUsers,
      totalUsers: totalUsers
    }]
  }

  const createMinimalActivity = (activeToday: number) => {
    const today = new Date()
    return [{
      date: today.toISOString().split('T')[0],
      activeUsers: activeToday
    }]
  }

  // Load data on component mount
  // Authentication is handled by AdminProtectedRoute wrapper
  // Admin token is in HTTP cookie, sent automatically with API requests
  useEffect(() => {
    loadStats(chartPeriod)
    loadContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartPeriod])

  // Initial load of users
  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true)
      // Admin token is in HTTP cookie, sent automatically with credentials: 'include'
      // When searching, fetch all results without pagination. When not searching, use pagination.
      const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''
      const sortParam = `&sort=${sortColumn}&order=${sortDirection}`
      const levelParam = levelFilter ? `&level=${encodeURIComponent(levelFilter)}` : ''
      let url: string
      if (searchTerm) {
        // Search mode: fetch all matching users (use a high limit like 10000)
        url = `/.netlify/functions/admin-get-users?page=1&limit=10000${searchParam}${sortParam}${levelParam}`
      } else {
        // Normal mode: use pagination
        url = `/.netlify/functions/admin-get-users?page=${currentPage}&limit=${usersPerPage}${searchParam}${sortParam}${levelParam}`
      }
      console.log('LoadUsers: Making request to admin-get-users API...', { url, usingCookies: true })
      const response = await adminApiRequest(url, {
        method: 'GET'
      })
      console.log('LoadUsers: Response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('LoadUsers: Error response:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        // Transform API data to match our interface
        const transformedUsers: User[] = result.users.map((user: any) => ({
          id: user.id,
          email: user.email,
          username: user.username,
          level: user.level,
          total_stars: user.total_stars,
          created_at: user.created_at,
          last_login: user.last_login,
          email_verified: user.email_verified
        }))

        setUsers(transformedUsers)
        // Update pagination info from API response
        if (result.pagination) {
          setTotalUsers(result.pagination.total)
          // When searching, show all results on one page. When not searching, use pagination.
          if (searchTerm) {
            setTotalPages(1)
          } else {
            setTotalPages(result.pagination.totalPages)
          }
        }
      } else {
        throw new Error(result.error || 'Failed to load users')
      }
    } catch (error) {
      const errorMessage = (error as Error).message
      // Don't show notification or update state if it's a 401 - redirect is happening
      if (errorMessage.includes('Admin session expired') || errorMessage.includes('401')) {
        console.log('Admin session expired, redirecting...')
        return // Exit early, redirect is handled by adminApiRequest
      }
      console.error('Failed to load users:', error)
      showNotification('Failed to load users: ' + errorMessage, 'error')
      setUsers([])
      setTotalUsers(0)
      setTotalPages(1)
    } finally {
      setIsLoadingUsers(false)
      // Only set main isLoading to false on initial load
      if (isLoading) {
        setIsLoading(false)
      }
    }
  }, [showNotification, t, usersPerPage, currentPage, searchTerm, sortColumn, sortDirection, levelFilter, isLoading])

  const handleRevokeSession = async (user: User) => {
    if (!confirm(`Are you sure you want to revoke all sessions for ${user.email}? This will log them out from all devices.`)) {
      return
    }

    try {
      // Admin token is in HTTP cookie, sent automatically with credentials: 'include'
      const response = await adminApiRequest('/.netlify/functions/admin-revoke-session', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        showNotification(`Successfully revoked all sessions for ${user.email}`, 'success')
        // Refresh user list to show updated status
        loadUsers()
      } else {
        throw new Error(result.error || 'Failed to revoke session')
      }
    } catch (error) {
      console.error('Failed to revoke session:', error)
      showNotification('Failed to revoke session: ' + (error as Error).message, 'error')
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to permanently delete user ${user.email}? This action cannot be undone.`)) {
      return
    }

    try {
      console.log('Attempting to delete user:', user.id, user.email)

      const response = await adminApiRequest(`/.netlify/functions/admin-delete-user/${user.id}`, {
        method: 'DELETE'
      })

      console.log('Delete user response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Delete user failed with status:', response.status, 'Response:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('Delete user result:', result)

      if (result.success) {
        showNotification(`Successfully deleted user ${user.email}`, 'success')
        // Refresh user list to remove deleted user
        loadUsers()
      } else {
        throw new Error(result.error || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Failed to delete user:', error)

      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes('Session expired')) {
        showNotification('Admin session expired. Please log out and log back in as admin.', 'error')
      } else {
        showNotification('Failed to delete user: ' + (error as Error).message, 'error')
      }
    }
  }

  const loadContent = useCallback(async () => {
    try {
      // Load lessons
      const lessonsResponse = await apiClient.getAdminLessons()
      const lessonsData = lessonsResponse.success && lessonsResponse.data?.lessons ? lessonsResponse.data.lessons : []
      setLessons(lessonsData)
      console.log('Loaded lessons:', lessonsData.length)

      // Load evaluation tests
      const testsResponse = await apiClient.getAdminEvaluationTests()
      const testsData = testsResponse.success && testsResponse.data?.tests ? testsResponse.data.tests : []
      setEvaluationTests(testsData)
      console.log('Loaded evaluation tests:', testsData.length, 'Response:', testsResponse)

      // Calculate stats
      const totalLessons = lessonsData.length
      const publishedLessons = lessonsData.filter((lesson: any) => !lesson.is_draft).length
      const draftLessons = lessonsData.filter((lesson: any) => lesson.is_draft).length
      const evaluationTestsCount = testsData.length

      setContentStats({
        totalLessons,
        publishedLessons,
        draftLessons,
        evaluationTests: evaluationTestsCount
      })
    } catch (error) {
      console.error('Content load error:', error)
    }
  }, [])

  const loadStats = useCallback(async (period: 'week' | 'month' | 'year' = 'month') => {
    try {
      const response = await adminApiRequest(`/.netlify/functions/admin-get-stats?period=${period}`, {
        method: 'GET'
      })
      console.log('Response received, status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

        const result = await response.json()
        console.log('Admin stats API response status:', response.status);
        console.log('Admin stats API full response:', result);

        if (result.success) {
          console.log('Admin stats response:', result.stats)
          console.log('Total users from API:', result.stats.users.total)
        setStats({
          totalUsers: result.stats.users.total,
          activeToday: result.stats.users.activeToday,
          newThisWeek: result.stats.users.newThisWeek,
          averageLevel: result.stats.users.averageLevel
        })

        // Create chart data based on current stats
        const userGrowth = createMinimalUserGrowth(result.stats.users.total)
        const activity = createMinimalActivity(result.stats.users.activeToday)

        setChartData({
          userGrowth,
          activity,
          period: result.charts?.period || 'month',
          hasRealData: true
        })
      } else {
        throw new Error(result.error || 'Failed to load stats')
      }
    } catch (error) {
      const errorMessage = (error as Error).message
      // Don't show notification or update state if it's a 401 - redirect is happening
      if (errorMessage.includes('Admin session expired') || errorMessage.includes('401')) {
        console.log('Admin session expired, redirecting...')
        return // Exit early, redirect is handled by adminApiRequest
      }
      console.error('Failed to load stats:', error)
      showNotification('Failed to load statistics: ' + errorMessage, 'error')
      setStats({
        totalUsers: 0,
        activeToday: 0,
        newThisWeek: 0,
        averageLevel: 'A1'
      })
      setChartData({
        userGrowth: [],
        activity: [],
        period: 'month',
        hasRealData: false
      })
    }
  }, [showNotification])

  const handlePeriodChange = (newPeriod: 'week' | 'month' | 'year') => {
    setChartPeriod(newPeriod)
    loadStats(newPeriod)
  }

  const handleViewUser = async (user: User) => {
    setSelectedUser(user)
    setIsUserLessonsModalOpen(true)
    setIsLoadingLessons(true)
    
    try {
      const response = await adminApiRequest(`/.netlify/functions/admin-get-user-lessons?userId=${user.id}`, {
        method: 'GET'
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.success) {
        setUserLessons(result.lessons || [])
      } else {
        throw new Error(result.error || 'Failed to load user lessons')
      }
    } catch (error) {
      console.error('Failed to load user lessons:', error)
      showNotification('Failed to load user lessons: ' + (error as Error).message, 'error')
      setUserLessons([])
    } finally {
      setIsLoadingLessons(false)
    }
  }


  const handleLogout = async () => {
    try {
      // Call logout API to clear cookies (including admin_token)
      const { apiClient } = await import('@/lib/api')
      const response = await apiClient.logout()
      
      if (response.success) {
        console.log('Logout successful, cookies cleared')
      } else {
        console.warn('Logout API returned error:', response.error)
      }
    } catch (error) {
      console.error('Logout API error:', error)
      // Continue with logout even if API fails
    }
    
    // Clear auth-related localStorage items, but preserve cookie consent
    // Cookie consent is for essential cookies only and doesn't need to be cleared on logout
    const cookieConsentData = localStorage.getItem('cookie_consent_data')
    
    // Clear all localStorage
    localStorage.clear()
    
    // Restore cookie consent if it existed (essential cookies don't require re-consent)
    if (cookieConsentData) {
      localStorage.setItem('cookie_consent_data', cookieConsentData)
    }
    
    // Use window.location for hard redirect to ensure clean state
    // This will trigger a full page reload and reset auth context
    window.location.href = '/'
  }

  // Handle search with debounce - reset to page 1 when search changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      // Load users will be triggered by the effect below
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset to page 1 when level filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [levelFilter])

  // Load users when search, page, sort, or level filter changes
  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, sortColumn, sortDirection, levelFilter])

  // Handle column sorting
  const handleSort = (column: string) => {
    console.log('Sort clicked:', column, 'Current sort:', sortColumn, sortDirection)
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString()
  }

  const getLevelColor = (level: string) => {
    const colors = {
      A1: 'bg-green-100 text-green-800',
      A2: 'bg-blue-100 text-blue-800',
      B1: 'bg-yellow-100 text-yellow-800',
      B2: 'bg-orange-100 text-orange-800',
      C1: 'bg-red-100 text-red-800',
      C2: 'bg-purple-100 text-purple-800'
    }
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>{t('loading', 'Loading admin dashboard...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100 text-slate-800">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-2xl">🛡️</div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">TutorCat Admin</h1>
              <p className="text-purple-600 text-sm">Administrator Dashboard</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-slate-700">
              {t('welcome', 'Welcome')}, {localStorage.getItem('adminEmail')}
            </span>
              <Button
                onClick={() => router.push('/admin/content')}
                variant="secondary"
                size="sm"
              >
                📝 {t('contentManagement', 'Content')}
              </Button>
              
              {/* Language Selector */}
              <div className="relative">
                <motion.button
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className="flex items-center justify-center space-x-2 h-9 px-3 rounded-lg border border-purple-300 bg-white text-slate-700 hover:border-purple-400 hover:bg-purple-50 transition-all duration-200"
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
                      className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border border-purple-200 bg-white z-50"
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="py-1">
                        {languages.map((lang) => (
                          <motion.button
                            key={lang.code}
                            onClick={() => handleLanguageChange(lang.code)}
                            className={`flex items-center space-x-3 w-full px-4 py-3 text-left transition-colors hover:bg-purple-50 text-slate-700 ${
                              currentLang?.code === lang.code ? 'bg-purple-50' : ''
                            }`}
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
                                className="ml-auto"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                              >
                                <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
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

              <Button onClick={handleLogout} variant="secondary" size="sm">
                {t('logout', 'Logout')}
              </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <Card.Body className="text-center">
                <div className="text-3xl mb-2">👥</div>
                <div className="text-2xl font-bold text-sky-500">{stats.totalUsers.toLocaleString()}</div>
                <div className="text-purple-600">{t('totalUsers', 'Total Users')}</div>
              </Card.Body>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <Card.Body className="text-center">
                <div className="text-3xl mb-2">📈</div>
                <div className="text-2xl font-bold text-emerald-500">{stats.activeToday}</div>
                <div className="text-purple-600">{t('activeToday', 'Active Today')}</div>
              </Card.Body>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <Card.Body className="text-center">
                <div className="text-3xl mb-2">🆕</div>
                <div className="text-2xl font-bold text-violet-500">{stats.newThisWeek}</div>
                <div className="text-purple-600">{t('newThisWeek', 'New This Week')}</div>
              </Card.Body>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
              <Card.Body className="text-center">
                <div className="text-3xl mb-2">📚</div>
                <div className="text-2xl font-bold text-amber-500">{stats.averageLevel}</div>
                <div className="text-purple-600">{t('averageLevel', 'Average Level')}</div>
              </Card.Body>
            </Card>
          </motion.div>
        </div>

        {/* Lessons Overview Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
            <Card.Header>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{t('contentOverview', 'Content Overview')}</h3>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => {
                      if (evaluationTests.length > 0) {
                        router.push(`/admin/content/evaluation/${evaluationTests[0].id}`)
                      } else {
                        // If no test exists, redirect to content page
                        router.push('/admin/content')
                      }
                    }}
                    variant="secondary"
                    size="sm"
                    className="bg-gradient-to-r from-violet-400 to-purple-500 hover:from-violet-500 hover:to-purple-600"
                  >
                    🎯 {t('evaluationTest', 'Evaluation Test')}
                  </Button>
                  <Button
                    onClick={() => router.push('/admin/content/lessons/new')}
                    variant="primary"
                    size="sm"
                    className="bg-gradient-to-r from-sky-400 to-purple-500 hover:from-sky-500 hover:to-purple-600"
                  >
                    ➕ {t('createLesson', 'Create Lesson')}
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                {/* Content list - Lessons and Evaluation Test */}
                {(lessons.length > 0 || evaluationTests.length > 0) ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {/* Evaluation Test (only one exists) */}
                    {evaluationTests.length > 0 && (
                      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border border-purple-200 hover:from-violet-100 hover:to-purple-100 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-slate-700">🎯 Evaluation Test</span>
                            {!evaluationTests[0].is_active && (
                              <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-full">
                                Draft
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 truncate">{evaluationTests[0].description || 'Evaluation test for students'}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-500">
                            {evaluationTests[0].questions?.length || 0} questions
                          </span>
                          <Button
                            onClick={() => router.push(`/admin/content/evaluation/${evaluationTests[0].id}`)}
                            variant="secondary"
                            size="sm"
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Lessons */}
                    {lessons.slice(0, evaluationTests.length > 0 ? 2 : 3).map((lesson: any) => (
                      <div key={lesson.id} className="flex items-center justify-between p-3 bg-white/50 rounded-lg border border-purple-200 hover:bg-white/70 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-slate-700">
                              {lesson.level} - Lesson {lesson.lesson_number}
                            </span>
                            {lesson.is_draft && (
                              <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-full">
                                Draft
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 truncate">{lesson.topic}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-500">
                            {lesson.activity_count} activities
                          </span>
                          <Button
                            onClick={() => router.push(`/admin/content/lessons/${lesson.id}`)}
                            variant="secondary"
                            size="sm"
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}

                    {lessons.length > (evaluationTests.length > 0 ? 2 : 3) && (
                      <div className="text-center pt-2">
                        <Button
                          onClick={() => router.push('/admin/content')}
                          variant="secondary"
                          size="sm"
                        >
                          View All Lessons ({lessons.length})
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <div className="text-4xl mb-2">📚</div>
                    <p>{t('noLessonsYet', 'No lessons created yet')}</p>
                    <p className="text-sm">{t('clickCreateToStart', 'Click "Create Lesson" to get started')}</p>
                  </div>
                )}

                {/* Quick stats in one line */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-purple-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-sky-500">{contentStats.totalLessons}</div>
                    <div className="text-sm text-slate-600">{t('totalLessons', 'Total Lessons')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-500">{contentStats.publishedLessons}</div>
                    <div className="text-sm text-slate-600">{t('publishedLessons', 'Published')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-500">{contentStats.draftLessons}</div>
                    <div className="text-sm text-slate-600">{t('draftLessons', 'Drafts')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-violet-500">{contentStats.evaluationTests > 0 ? '✓' : '✗'}</div>
                    <div className="text-sm text-slate-600">{t('evaluationTest', 'Eval Test')}</div>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </motion.div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <UserGrowthChart
              data={chartData.userGrowth}
              period={chartPeriod}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <ActivityChart
              data={chartData.activity}
              period={chartPeriod}
            />
          </motion.div>
        </div>

        {/* Period Selector */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center space-x-4 bg-slate-800 p-4 rounded-lg">
            <span className="text-white font-medium">{t('timePeriod', 'Time Period:')}</span>
            <div className="flex space-x-2">
              {(['week', 'month', 'year'] as const).map((period) => (
                <Button
                  key={period}
                  onClick={() => handlePeriodChange(period)}
                  variant={chartPeriod === period ? 'primary' : 'secondary'}
                  size="sm"
                  className="capitalize"
                >
                  {t(period, period)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* User Management */}
        <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <Card.Header>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{t('userManagement', 'User Management')}</h2>
              <div className="flex items-center space-x-4">
                <Input
                  placeholder={t('searchUsers', 'Search users...')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white border-purple-200 text-slate-800 placeholder-purple-400 w-64 focus:border-purple-400"
                />
                <Select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="bg-white border-purple-200 text-slate-800 w-48 focus:border-purple-400"
                >
                  <option value="">{t('allLevels', 'All Levels')}</option>
                  <option value="Not Assessed">{t('notAssessed', 'Not Assessed')}</option>
                  <option value="Pre-A1">Pre-A1</option>
                  <option value="A1">A1</option>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                </Select>
              </div>
            </div>
          </Card.Header>

          <Card.Body>
            <Table>
              <Header>
                <Row>
                  <Head 
                    className={`text-slate-600 bg-purple-100 select-none ${isLoadingUsers ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-purple-200'}`}
                    onClick={() => !isLoadingUsers && handleSort('email')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('email', 'Email')}</span>
                      {sortColumn === 'email' && (
                        <span className="text-purple-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </Head>
                  <Head 
                    className={`text-slate-600 bg-purple-100 select-none ${isLoadingUsers ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-purple-200'}`}
                    onClick={() => !isLoadingUsers && handleSort('username')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('username', 'Username')}</span>
                      {sortColumn === 'username' && (
                        <span className="text-purple-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </Head>
                  <Head 
                    className={`text-slate-600 bg-purple-100 select-none ${isLoadingUsers ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-purple-200'}`}
                    onClick={() => !isLoadingUsers && handleSort('level')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('level', 'Level')}</span>
                      {sortColumn === 'level' && (
                        <span className="text-purple-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </Head>
                  <Head 
                    className={`text-slate-600 bg-purple-100 select-none ${isLoadingUsers ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-purple-200'}`}
                    onClick={() => !isLoadingUsers && handleSort('total_stars')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('stars', 'Stars')}</span>
                      {sortColumn === 'total_stars' && (
                        <span className="text-purple-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </Head>
                  <Head 
                    className={`text-slate-600 bg-purple-100 select-none ${isLoadingUsers ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-purple-200'}`}
                    onClick={() => !isLoadingUsers && handleSort('last_login')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('lastLogin', 'Last Login')}</span>
                      {sortColumn === 'last_login' && (
                        <span className="text-purple-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </Head>
                  <Head 
                    className={`text-slate-600 bg-purple-100 select-none ${isLoadingUsers ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-purple-200'}`}
                    onClick={() => !isLoadingUsers && handleSort('email_verified')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{t('status', 'Status')}</span>
                      {sortColumn === 'email_verified' && (
                        <span className="text-purple-600">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </Head>
                  <Head className="text-slate-600 bg-purple-100">{t('actions', 'Actions')}</Head>
                </Row>
              </Header>
              <Body>
                {isLoadingUsers ? (
                  <Row>
                    <Cell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-3 border-purple-500 border-t-transparent rounded-full mr-3"></div>
                        <span className="text-slate-600">{t('loading', 'Loading...')}</span>
                      </div>
                    </Cell>
                  </Row>
                ) : users.length === 0 ? (
                  <Row>
                    <Cell colSpan={7} className="text-center py-8 text-slate-600">
                      {t('noUsers', 'No users found')}
                    </Cell>
                  </Row>
                ) : (
                  users.map((user) => (
                  <Row key={user.id} className="border-purple-200 hover:bg-purple-25">
                    <Cell className="text-slate-700">{user.email}</Cell>
                    <Cell className="text-slate-700">
                      {user.username || <span className="text-purple-500 italic">Not set</span>}
                    </Cell>
                    <Cell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(user.level)}`}>
                        {user.level || 'Not Assessed'}
                      </span>
                    </Cell>
                    <Cell className="text-slate-700">{user.total_stars} ⭐</Cell>
                    <Cell className="text-slate-700">{formatDate(user.last_login || null)}</Cell>
                    <Cell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.email_verified
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.email_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </Cell>
                    <Cell>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleViewUser(user)}
                          disabled={isLoadingUsers}
                        >
                          {t('view', 'View')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleRevokeSession(user)}
                          disabled={isLoadingUsers}
                        >
                          {t('revokeSession', 'Revoke Session')}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDeleteUser(user)}
                          disabled={isLoadingUsers}
                        >
                          {t('delete', 'Delete')}
                        </Button>
                      </div>
                    </Cell>
                  </Row>
                  ))
                )}
              </Body>
            </Table>

            {/* Pagination - only show when not searching */}
            {!searchTerm && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-purple-600">
                  {t('showing', 'Showing')} {((currentPage - 1) * usersPerPage) + 1} {t('to', 'to')}{' '}
                  {Math.min(currentPage * usersPerPage, totalUsers)} {t('of', 'of')}{' '}
                  {totalUsers} {t('users', 'users')}
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage === 1 || isLoadingUsers}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                  >
                    {t('previous', 'Previous')}
                  </Button>

                  {/* Page Number Buttons */}
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 7) {
                        // Show all pages if 7 or fewer
                        pageNum = i + 1
                      } else if (currentPage <= 4) {
                        // Show first 5 pages, then ... and last
                        if (i < 5) {
                          pageNum = i + 1
                        } else if (i === 5) {
                          return <span key="ellipsis1" className="px-2 text-slate-400">...</span>
                        } else {
                          pageNum = totalPages
                        }
                      } else if (currentPage >= totalPages - 3) {
                        // Show first, then ... and last 5 pages
                        if (i === 0) {
                          pageNum = 1
                        } else if (i === 1) {
                          return <span key="ellipsis1" className="px-2 text-slate-400">...</span>
                        } else {
                          pageNum = totalPages - 6 + i
                        }
                      } else {
                        // Show first, ... current-1, current, current+1, ... last
                        if (i === 0) {
                          pageNum = 1
                        } else if (i === 1) {
                          return <span key="ellipsis1" className="px-2 text-slate-400">...</span>
                        } else if (i < 5) {
                          pageNum = currentPage - 2 + i
                        } else if (i === 5) {
                          return <span key="ellipsis2" className="px-2 text-slate-400">...</span>
                        } else {
                          pageNum = totalPages
                        }
                      }

                      if (pageNum === undefined) return null

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'primary' : 'secondary'}
                          size="sm"
                          disabled={isLoadingUsers}
                          onClick={() => setCurrentPage(pageNum)}
                          className="min-w-[2.5rem]"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={currentPage === totalPages || isLoadingUsers}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    {t('next', 'Next')}
                  </Button>
                </div>
              </div>
            )}

            {/* Search Results Count - show when searching */}
            {searchTerm && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-purple-600">
                  {t('showing', 'Showing')} {users.length} {t('of', 'of')} {totalUsers} {t('users', 'users')} {t('matching', 'matching')} "{searchTerm}"
                </div>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          {/* Removed Content Management and System Health sections as requested */}
        </div>
      </div>

      {/* User Lessons Modal */}
      <Modal
        isOpen={isUserLessonsModalOpen}
        onClose={() => {
          setIsUserLessonsModalOpen(false)
          setSelectedUser(null)
          setUserLessons([])
        }}
        title={selectedUser ? `${t('userLessons', 'User Lessons')} - ${selectedUser.email}` : t('userLessons', 'User Lessons')}
        size="lg"
      >
        {isLoadingLessons ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600">{t('loadingLessons', 'Loading lessons...')}</p>
          </div>
        ) : userLessons.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-600">{t('noCompletedLessons', 'No completed lessons found for this user.')}</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-700">
                <strong>{t('totalCompleted', 'Total Completed:')}</strong> {userLessons.length} {t('lessons', 'lessons')}
              </p>
            </div>
            
            {userLessons.map((lesson: any, index: number) => {
              const score = lesson.score || 0
              const scorePercentage = Math.round(score)
              const completedDate = lesson.completed_at 
                ? new Date(lesson.completed_at).toLocaleDateString() 
                : t('unknown', 'Unknown')
              const lessonKey = lesson.id || `lesson-${index}`
              const isExpanded = expandedLessons.has(lessonKey)
              
              // Helper function to calculate speaking activity average score from answers.feedback
              const calculateSpeakingScore = (activity: any): number => {
                // For speaking_with_feedback, calculate average from answers.feedback data
                if (activity.activity_type === 'speaking_with_feedback') {
                  try {
                    // Get answers data (could be in answers field or feedback field)
                    let answersData = activity.answers
                    
                    // Parse if it's a string
                    if (typeof answersData === 'string') {
                      answersData = JSON.parse(answersData)
                    }
                    
                    // If answers is null/undefined, try feedback field
                    if (!answersData && activity.feedback) {
                      answersData = typeof activity.feedback === 'string' 
                        ? JSON.parse(activity.feedback) 
                        : activity.feedback
                    }
                    
                    // Check if answers has feedback structure with prompts
                    if (answersData?.feedback && typeof answersData.feedback === 'object') {
                      const promptScores: number[] = []
                      
                      // Extract overall_score from each prompt (prompt-0, prompt-1, etc.)
                      Object.keys(answersData.feedback).forEach((key) => {
                        if (key.startsWith('prompt-')) {
                          const prompt = answersData.feedback[key]
                          if (prompt && typeof prompt.overall_score === 'number') {
                            promptScores.push(prompt.overall_score)
                          }
                        }
                      })
                      
                      // Calculate average from all prompts
                      if (promptScores.length > 0) {
                        const average = promptScores.reduce((sum, score) => sum + score, 0) / promptScores.length
                        console.log(`Speaking activity scores:`, promptScores, `Average:`, average)
                        return Math.round(average)
                      }
                    }
                    
                    console.warn('No valid feedback scores found in answers.feedback for speaking activity')
                  } catch (error) {
                    console.error('Error parsing speaking answers/feedback:', error, activity)
                  }
                }
                
                // Fallback to regular score calculation for non-speaking or if parsing fails
                return activity.max_score > 0 
                  ? Math.round((activity.score / activity.max_score) * 100) 
                  : 0
              }
              
              return (
                <motion.div
                  key={lessonKey}
                  className="bg-white border border-purple-200 rounded-lg p-4 hover:shadow-md transition-all duration-200"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedLessons)
                          if (isExpanded) {
                            newExpanded.delete(lessonKey)
                          } else {
                            newExpanded.add(lessonKey)
                          }
                          setExpandedLessons(newExpanded)
                        }}
                        className="flex items-center gap-2 text-left w-full hover:text-purple-600 transition-colors"
                      >
                        <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        <h4 className="font-semibold text-slate-800 mb-1">
                          {lesson.topic || `Lesson ${lesson.lesson_number}`}
                        </h4>
                      </button>
                      <div className="flex items-center space-x-4 text-sm text-slate-600">
                        <span>
                          <strong>{t('level', 'Level:')}</strong> {lesson.level || 'N/A'}
                        </span>
                        <span>
                          <strong>{t('lessonNumber', 'Lesson:')}</strong> {lesson.lesson_number || 'N/A'}
                        </span>
                        <span>
                          <strong>{t('completedDate', 'Completed:')}</strong> {completedDate}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className={`text-2xl font-bold ${
                        scorePercentage >= 90 ? 'text-green-600' :
                        scorePercentage >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {scorePercentage}%
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {t('score', 'Score')}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>{t('progress', 'Progress')}</span>
                      <span>{scorePercentage}%</span>
                    </div>
                    <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${
                          scorePercentage >= 90 ? 'bg-green-500' :
                          scorePercentage >= 70 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${scorePercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Activity Details - Only show when expanded */}
                  {isExpanded && lesson.activityResults && lesson.activityResults.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-purple-100">
                      <p className="text-xs font-semibold text-slate-700 mb-2">
                        {t('activityDetails', 'Activity Details:')}
                      </p>
                      <div className="space-y-1">
                        {lesson.activityResults.map((activity: any, actIndex: number) => {
                          const actScore = calculateSpeakingScore(activity)
                          const activityName = activity.activity_type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || `Activity ${activity.activity_order}`
                          
                          return (
                            <div key={actIndex} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 text-xs bg-slate-50 p-2 rounded">
                              <span className="text-slate-700 break-words min-w-0 flex-1">
                                {activityName}
                              </span>
                              <span className={`font-medium flex-shrink-0 ${
                                actScore >= 90 ? 'text-green-600' :
                                actScore >= 70 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {activity.activity_type === 'speaking_with_feedback' 
                                  ? `${actScore}% (avg)`
                                  : `${actScore}% (${activity.score}/${activity.max_score})`
                                }
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Time Spent */}
                  {lesson.time_spent && (
                    <div className="mt-2 text-xs text-slate-500">
                      <strong>{t('timeSpent', 'Time Spent:')}</strong> {Math.round(lesson.time_spent / 60)} {t('minutes', 'minutes')}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
