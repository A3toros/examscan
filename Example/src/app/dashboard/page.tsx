'use client'

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { ProtectedRoute, useUser } from '@/components/auth/ProtectedRoute'
import { Card, Button, Mascot, ProgressBar, StarRating, LoadingSpinnerModal, Modal } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { User, Trophy, ChevronRight } from 'lucide-react'
import { AchievementModal } from '@/components/achievements/AchievementModal'

function DashboardContent() {
  const { t } = useTranslation()
  const { user, checkAuthStatus } = useUser()
  const { showNotification } = useNotification()
  const router = useRouter()

  // Real progress data from API
  const [userProgress, setUserProgress] = useState<any>(null)
  const [availableLessons, setAvailableLessons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingLessons, setLoadingLessons] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set())
  const [isAchievementModalOpen, setIsAchievementModalOpen] = useState(false)
  const [isRecentActivityModalOpen, setIsRecentActivityModalOpen] = useState(false)
  const [effectiveLevel, setEffectiveLevel] = useState<string | null>(null)
  const [levelAdvancedBanner, setLevelAdvancedBanner] = useState<string | null>(null)
  const [hasAutoAdvancedLevel, setHasAutoAdvancedLevel] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [finalizingNoLessons, setFinalizingNoLessons] = useState(false)
  const [viewLessonModal, setViewLessonModal] = useState<{ isOpen: boolean; lessonId: string | null; lessonData: any | null }>({
    isOpen: false,
    lessonId: null,
    lessonData: null
  })
  const [isNavigatingToLesson, setIsNavigatingToLesson] = useState(false)

  // Redirect admins away from student dashboard
  // This check happens first, before any other logic
  useEffect(() => {
    // Check if user is admin (role is most reliable)
    if (user?.role === 'admin') {
      window.location.href = '/admin/dashboard'
      return
    }

  }, [user])

  // Check if user has completed evaluation test and redirect if not
  // Only check this for non-admin users
  useEffect(() => {
    if (user) {
      // Skip evaluation check for admins
      const isAdmin = user?.role === 'admin'
      
      if (isAdmin) {
        return // Admin users don't need evaluation test
      }

      // Check if user has a level assigned (from evaluation test)
      // A user must have a level to access the dashboard
      const userLevel = user.level
      const hasEvalResult = user.evalTestResult || user.eval_test_result
      
      // If user doesn't have a level (null, undefined, or empty string), redirect to evaluation test
      // Also check if level is explicitly "Not Assessed" or similar
      if (!userLevel || userLevel.trim() === '' || userLevel === 'Not Assessed') {
        console.log('User has no level assigned, redirecting to evaluation test', { 
          userLevel, 
          hasEvalResult,
          evalTestResult: user.evalTestResult,
          eval_test_result: user.eval_test_result
        })
        router.push('/evaluation')
        return
      }
    }
  }, [user, router])

  useEffect(() => {
    let isMounted = true
    let lessonsAbortController: AbortController | null = null

    const fetchDashboardData = async () => {
      try {
        const response = await apiClient.getDashboardData()

        if (!isMounted) return

        if (response.success && response.data) {
          // The API client wraps the backend response, so we need response.data.data
          const dashboardData = response.data.data || response.data
          console.log('Dashboard data structure:', { 
            hasData: !!response.data, 
            hasNestedData: !!response.data.data,
            dashboardData: dashboardData 
          })
          setUserProgress(dashboardData)
          
          // Set loading to false immediately after dashboard data loads
          setLoading(false)
          
          // Determine effective current level (prefer the higher of user.level and progress.currentLevel)
          const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
          const backendLevel = dashboardData.user?.level
          const progressLevel = dashboardData.progress?.currentLevel
          const pickHigherLevel = (a?: string | null, b?: string | null) => {
            const ia = a ? levelOrder.indexOf(a) : -1
            const ib = b ? levelOrder.indexOf(b) : -1
            if (ia === -1) return b || null
            if (ib === -1) return a || null
            return ia >= ib ? a : b
          }
          const currentLevel = pickHigherLevel(backendLevel, progressLevel) || 'A1'
          setEffectiveLevel(currentLevel)
          
          // Only fetch if level is valid (not "Not Assessed")
          if (currentLevel && currentLevel !== 'Not Assessed') {
            // Set loading state for lessons separately
            setLoadingLessons(true)
            
            // Create abort controller for lessons request
            lessonsAbortController = new AbortController()
            
            try {
              const lessonsResponse = await apiClient.getLessonsByLevel(currentLevel)
              
              if (!isMounted) return
              
              if (lessonsResponse.success && lessonsResponse.data) {
                // Handle both wrapped and unwrapped responses
                const lessonsData = lessonsResponse.data.data || lessonsResponse.data
                if (lessonsData?.lessons) {
                  setAvailableLessons(lessonsData.lessons || [])
                }
              }
            } catch (lessonsError) {
              if (!isMounted) return
              // Only log if not aborted
              if (lessonsError instanceof Error && !lessonsError.message.includes('aborted')) {
                console.error('Failed to load available lessons:', lessonsError)
              }
              // Don't set error, just log - dashboard can still work without lessons
            } finally {
              if (isMounted) {
                setLoadingLessons(false)
              }
            }
          }
        } else {
          console.error('Failed to load dashboard data:', response.error)
          setError('Failed to load dashboard data')
          setLoading(false)
        }
      } catch (error) {
        if (!isMounted) return
        console.error('Dashboard data fetch error:', error)
        setError('Failed to load dashboard data')
        setLoading(false)
      }
    }

    if (user) {
      fetchDashboardData()
    }

    // Cleanup function to prevent state updates if component unmounts
    return () => {
      isMounted = false
      if (lessonsAbortController) {
        lessonsAbortController.abort()
      }
    }
  }, [user, refreshTick])

  // If all lessons in the current level are completed and there is a higher level, auto-advance locally
  useEffect(() => {
    if (!userProgress) return
    if (hasAutoAdvancedLevel) return

    const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    const backendLevel = userProgress.user?.level
    const progressLevel = userProgress.progress?.currentLevel
    const pickHigherLevel = (a?: string | null, b?: string | null) => {
      const ia = a ? levelOrder.indexOf(a) : -1
      const ib = b ? levelOrder.indexOf(b) : -1
      if (ia === -1) return b || null
      if (ib === -1) return a || null
      return ia >= ib ? a : b
    }

    const currentLevel = (effectiveLevel || pickHigherLevel(backendLevel, progressLevel) || '').trim()
    if (!currentLevel || currentLevel === 'Not Assessed') return

    // If backend level is already higher than currentLevel, do not auto-advance locally
    if (backendLevel && levelOrder.indexOf(backendLevel) > levelOrder.indexOf(currentLevel)) {
      return
    }

    // Only show congratulation message if user has actually completed all lessons in their level
    // Don't show it just because no lessons are available (which could be due to missing data)
    if (!availableLessons.length) {
      // No lessons available for this level - don't auto-advance
      return
    }

    const allCompleted = availableLessons.every((lesson: any) => lesson?.userProgress?.completed === true)
    if (!allCompleted) return

    console.log('🎯 Level advancement validation passed - all lessons completed')

    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    const idx = levels.indexOf(currentLevel)

    // Always try to advance level when all lessons are completed
    const lastCompletedLevel = [...availableLessons]
      .filter((l: any) => l.userProgress?.completed === true)
      .sort((a: any, b: any) => (b.lesson_number || 0) - (a.lesson_number || 0))[0]

    console.log('Last completed lesson:', lastCompletedLevel?.id, 'Current level:', currentLevel)

    ;(async () => {
      try {
        // First finalize the lesson
        if (lastCompletedLevel?.id) {
          console.log('Finalizing lesson:', lastCompletedLevel.id)
          await fetch('/.netlify/functions/finalize-lesson', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ lessonId: lastCompletedLevel.id })
          })
        }

        // Then try to advance level using the new API
        console.log('Attempting level advancement via advance-level API')
        try {
          const advanceResponse = await fetch('/.netlify/functions/advance-level', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          })
          if (advanceResponse.ok) {
            const result = await advanceResponse.json()
            console.log('Level advanced successfully via advance-level API:', result)

            // Show congratulation message if level was actually advanced
            if (result.toLevel && result.toLevel !== result.fromLevel) {
              setLevelAdvancedBanner(`🎉 Congratulations! You finished all ${result.fromLevel} lessons. We’ve moved you to ${result.toLevel}.`)
            }
          } else {
            const errorText = await advanceResponse.text()
            console.warn('advance-level API failed:', advanceResponse.status, errorText)
          }
        } catch (advanceErr) {
          console.warn('advance-level API call failed:', advanceErr)
        }

        await checkAuthStatus()
        setRefreshTick(prev => prev + 1)
      } catch (err) {
        console.error('Auto-finalize for level-up failed:', err)
      }
    })()

    if (idx >= 0 && idx < levels.length - 1) {
      // Do not set local next level; wait for backend refresh
      setHasAutoAdvancedLevel(true)
    } else {
      // Already at top level, just celebrate
      setLevelAdvancedBanner(`🎉 Congratulations! You completed all lessons for ${currentLevel}.`)
      setHasAutoAdvancedLevel(true)
    }
  }, [availableLessons, userProgress, effectiveLevel, hasAutoAdvancedLevel])

  if (loading) {
    return <LoadingSpinnerModal isOpen={true} message="Loading your progress..." />
  }

  if (!userProgress || !userProgress.progress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Failed to load dashboard data</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  // Extract real data from API response (userProgress is already the data object)
  const progress = userProgress.progress || {
    currentLevel: 'A1',
    levelProgress: 0,
    completionPercentage: 0,
    currentTitle: 'Tiny Whisker',
    nextTitle: 'Soft Paw',
    totalStars: 0,
    totalLessons: 0,
    completedLessons: 0,
    levelTotal: 0,
    levelCompleted: 0
  }
  const currentLevelDisplay = effectiveLevel || progress.currentLevel || user?.level || 'A1'

  const recentLessons = userProgress.recentLessons || []
  const weeklyGoal = userProgress.weeklyGoal || 7
  const weeklyProgress = userProgress.weeklyProgress || 0
  const currentStreak = userProgress.currentStreak || 0
  const dailyGoal = userProgress.dailyGoal || 1
  const dailyProgress = userProgress.dailyProgress || 0
  const hasTakenEvaluationTest = userProgress.evalTestResult != null

  // Get next lesson to continue (real data)
  // Priority: 1) Available lesson not completed, 2) First available lesson (only if no incomplete lessons exist)
  const nextLesson = (() => {
    // Find first available lesson that user hasn't completed
    const incompleteAvailable = availableLessons.find((lesson: any) => {
      // Check if lesson has userProgress and it's not completed
      if (lesson.userProgress) {
        // Explicitly check for true (not just truthy, to handle null/undefined/false)
        const isCompleted = lesson.userProgress.completed === true
        return !isCompleted
      }
      // If no userProgress, the lesson is not started (incomplete)
      return true
    })
    
    if (incompleteAvailable) {
      return incompleteAvailable
    }
    
    // If all available lessons are completed, find the next lesson in sequence
    if (availableLessons.length > 0) {
      // Find the next lesson after the last completed one
      const lastCompleted = availableLessons
        .filter((l: any) => l.userProgress?.completed === true)
        .sort((a: any, b: any) => (b.lesson_number || 0) - (a.lesson_number || 0))[0]
      
      if (lastCompleted) {
        // Find next lesson after last completed (must not be completed)
        const nextAfterCompleted = availableLessons.find((l: any) => 
          (l.lesson_number || 0) > (lastCompleted.lesson_number || 0) &&
          (!l.userProgress || l.userProgress.completed !== true)
        )
        if (nextAfterCompleted) return nextAfterCompleted
      }
      
      // If all lessons are completed, don't show any lesson
      // (all lessons in this level are done)
      return null
    }
    
    return null
  })()
  
  const currentLessonNumber = nextLesson?.lesson_number || (availableLessons.length > 0 ? availableLessons[0]?.lesson_number : progress.completedLessons + 1)

  const toggleLessonExpansion = (lessonId: string) => {
    setExpandedLessons(prev => {
      const newSet = new Set(prev)
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId)
      } else {
        newSet.add(lessonId)
      }
      return newSet
    })
  }

  const handleStartLesson = () => {
    if (isNavigatingToLesson) return
    setIsNavigatingToLesson(true)
    router.push('/lessons')
  }

  const handleContinueLesson = () => {
    if (isNavigatingToLesson) return
    setIsNavigatingToLesson(true)
    const lessonToUse = nextLesson || availableLessons[0]
    if (lessonToUse?.id) {
      router.push(`/lessons?lessonId=${lessonToUse.id}`)
    } else {
      router.push('/lessons')
    }
  }

  const handleViewProfile = () => {
    router.push('/profile')
  }

  const handleTakeTest = () => {
    router.push('/evaluation')
  }

  const handleFinalizeWhenNoLessons = async () => {
    if (finalizingNoLessons) return
    setFinalizingNoLessons(true)
    try {
      // Try to finalize using the last completed lesson (from recentLessons or any completed)
      const lastCompleted =
        recentLessons?.[0]?.id ||
        recentLessons?.[0]?.lesson_id ||
        availableLessons
          .filter((l: any) => l.userProgress?.completed)
          .sort((a: any, b: any) => (b.lesson_number || 0) - (a.lesson_number || 0))[0]?.id ||
        null

      if (lastCompleted) {
        await fetch('/.netlify/functions/finalize-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ lessonId: lastCompleted })
        })
        await checkAuthStatus()
        setRefreshTick(prev => prev + 1)
      }
    } catch (err) {
      console.error('Finalize when no lessons available failed:', err)
    } finally {
      setFinalizingNoLessons(false)
    }
  }

  const handleTestSpeaking = () => {
    router.push('/evaluation?mode=speaking')
  }

  const handleAdvanceLevel = async () => {
    try {
      const response = await fetch('/.netlify/functions/advance-level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })
      if (response.ok) {
        const result = await response.json()
        console.log('Advance-level response:', result)
        await checkAuthStatus()
        setRefreshTick(prev => prev + 1)
      } else {
        console.error('advance-level failed:', await response.text())
      }
    } catch (err) {
      console.error('advance-level error:', err)
    }
  }

  const handleRetryLesson = (lessonId: string) => {
    router.push(`/lessons?lessonId=${lessonId}`)
  }

  const handleReviewLesson = (lessonId: string) => {
    router.push(`/lessons?lessonId=${lessonId}&review=true`)
  }

  const handleViewLesson = async (lessonId: string) => {
    try {
      // Fetch lesson data with activity results
      const response = await apiClient.getLesson(lessonId)
      
      if (response.success && response.data) {
        // The response structure is: { lesson, userProgress, activityResults }
        const responseData = response.data as any
        const lessonData = responseData.lesson || responseData
        const activityResults = responseData.activityResults || []
        const userProgress = responseData.userProgress || null
        
        setViewLessonModal({
          isOpen: true,
          lessonId,
          lessonData: {
            ...lessonData,
            activityResults,
            userProgress
          }
        })
      } else {
        showNotification(response.error || 'Failed to load lesson details', 'error')
      }
    } catch (error) {
      console.error('Failed to load lesson:', error)
      showNotification('Failed to load lesson details', 'error')
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100">
        <div className="text-center">
          <p className="text-slate-600">{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-purple-50 to-indigo-100 text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <motion.div
          className="bg-white/80 backdrop-blur-sm border-b border-purple-200 rounded-xl shadow-sm px-6 py-4 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Mascot
                size="md"
                emotion="excited"
                className="hidden sm:block"
              />
              <div>
                <h1 className="text-2xl font-bold text-slate-800">
                  {t('dashboard.welcome', 'Welcome back, {{name}}!', { name: user.first_name || user.firstName || user.username || 'there' })}
                </h1>
                <p className="text-sm text-purple-600">
                  {t('dashboard.readyToContinue', 'Ready to continue your learning journey?')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleViewProfile}
                className="hidden sm:flex"
              >
                <User className="w-4 h-4 mr-2" />
                {t('dashboard.profile', 'Profile')}
              </Button>
            </div>
          </div>
        </motion.div>

        {levelAdvancedBanner && (
          <div className="mb-6">
            <Card className="bg-gradient-to-r from-green-50 to-emerald-100 border border-emerald-200">
              <Card.Body className="flex items-center justify-between gap-4">
                <div className="text-emerald-800 font-semibold">{levelAdvancedBanner}</div>
                <Button size="sm" onClick={() => setLevelAdvancedBanner(null)}>
                  {t('common.ok', 'OK')}
                </Button>
              </Card.Body>
            </Card>
          </div>
        )}

        {/* No lessons available state */}
        {availableLessons.length === 0 && (
          <div className="mb-8">
            <Card>
              <Card.Body className="text-center space-y-3">
                <div className="text-2xl">📚</div>
                <div className="text-lg font-semibold text-slate-800">No Lessons Available</div>
                <div className="text-sm text-slate-600">Check back soon for new lessons.</div>
                <div>
                  <Button
                    onClick={handleFinalizeWhenNoLessons}
                    disabled={finalizingNoLessons}
                    className="w-full sm:w-auto"
                  >
                    {finalizingNoLessons ? 'Finalizing…' : 'Refresh Progress'}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </div>
        )}

        {/* Quick Stats Grid */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 text-center p-4 hover:shadow-lg transition-all duration-300">
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {currentLevelDisplay}
            </div>
            <div className="text-sm font-medium text-slate-700">
              {t('dashboard.currentLevel', 'Current Level')}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-white to-sky-50 border-sky-200 text-center p-4 hover:shadow-lg transition-all duration-300">
            <div className="text-3xl font-bold text-sky-600 mb-1">
              {currentLessonNumber || 1}
            </div>
            <div className="text-sm font-medium text-slate-700">
              {t('dashboard.currentLesson', 'Current Lesson')}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-white to-yellow-50 border-yellow-200 text-center p-4 hover:shadow-lg transition-all duration-300">
            <div className="text-3xl font-bold text-yellow-600 mb-1">
              {progress.totalStars || 0}
            </div>
            <div className="text-sm font-medium text-slate-700">
              {t('dashboard.totalStars', 'Total Stars')}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-white to-green-50 border-green-200 text-center p-4 hover:shadow-lg transition-all duration-300">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {progress.completedLessons || 0}
            </div>
            <div className="text-sm font-medium text-slate-700">
              {t('dashboard.completed', 'Completed')}
            </div>
          </Card>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content Area (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Overview Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <Card.Header>
                  <h2 className="text-xl font-bold text-slate-800">
                    {t('dashboard.yourLearningProgress', 'Your Learning Progress')}
                  </h2>
                </Card.Header>
                <Card.Body className="space-y-6">
                  {/* XP Progress with Visual Ring */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-slate-700">{t('dashboard.xpProgress', 'XP Progress')}</span>
                      <span className="text-purple-600 font-bold text-lg">
                        {progress.completionPercentage || 0}%
                      </span>
                    </div>
                    <div className="relative w-full h-4 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-sky-500 to-purple-600 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.completionPercentage || 0}%` }}
                        transition={{ duration: 1, delay: 0.3 }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2 text-sm text-slate-600">
                      <span>
                        {t('dashboard.current', 'Current:')} <span className="font-semibold">{progress.currentTitle || 'Tiny Whisker'}</span>
                      </span>
                      <span>
                        {t('dashboard.next', 'Next:')} <span className="font-semibold">{progress.nextTitle || 'Soft Paw'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Level Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-semibold text-slate-700">
                        {progress.currentLevel || 'A1'} {t('dashboard.levelProgress', 'Level Progress')}
                      </span>
                      <span className="text-sky-600 font-bold text-lg">
                        {progress.levelCompleted || 0}/{progress.levelTotal || availableLessons.length || 1}
                      </span>
                    </div>
                    <div className="relative w-full h-4 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(() => {
                          const total = progress.levelTotal || availableLessons.length || 1;
                          return total > 0 ? ((progress.levelCompleted || 0) / total) * 100 : 0;
                        })()}%` }}
                        transition={{ duration: 1, delay: 0.4 }}
                      />
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </motion.div>

            {/* Continue Learning Card */}
            {nextLesson ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="bg-gradient-to-br from-white to-indigo-50 border-indigo-200 shadow-lg hover:shadow-xl transition-all duration-300">
                  <Card.Header>
                    <h2 className="text-xl font-bold text-slate-800">
                      {t('dashboard.continueLearning', 'Continue Learning')}
                    </h2>
                  </Card.Header>
                  <Card.Body>
                    {(() => {
                      const lessonToShow = nextLesson
                      if (!lessonToShow) return null
                      
                      const isCompleted = lessonToShow.userProgress?.completed === true
                      const hasProgress = lessonToShow?.userProgress && !isCompleted
                      const progressPercent = hasProgress ? (lessonToShow?.userProgress?.score || 0) : 0
                      
                      return (
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-lg font-bold text-slate-800 mb-1">
                                {lessonToShow.title || `Lesson ${lessonToShow.lesson_number || 1}: ${lessonToShow.topic || 'Getting Started'}`}
                              </h3>
                              <p className="text-sm text-slate-600">
                                Level {lessonToShow.level || progress.currentLevel || 'A1'} • ~15 minutes
                                {isCompleted ? ` • ${t('dashboard.completedLabel', 'Completed')}` : hasProgress && progressPercent > 0 ? (
                                  ` • ${Math.round(progressPercent)}% complete`
                                ) : null}
                              </p>
                            </div>
                          </div>
                          {hasProgress && progressPercent > 0 && !isCompleted && (
                            <div className="mb-4">
                              <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progressPercent}%` }}
                                  transition={{ duration: 0.8 }}
                                />
                              </div>
                              <p className="text-xs text-slate-600 mt-1">{t('dashboard.progress', 'Progress:')} {Math.round(progressPercent)}%</p>
                            </div>
                          )}
                          {isCompleted && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-sm text-green-700 font-medium">{t('dashboard.lessonCompleted', '✓ Lesson Completed')}</p>
                            </div>
                          )}
                          <Button
                            onClick={handleContinueLesson}
                            className="w-full bg-gradient-to-r from-sky-500 to-purple-600 hover:from-sky-600 hover:to-purple-700 text-white font-semibold py-3 text-lg"
                            disabled={isCompleted || isNavigatingToLesson}
                            loading={isNavigatingToLesson}
                          >
                            {isCompleted ? t('dashboard.lessonCompleted', '✓ Lesson Completed') : hasProgress ? t('dashboard.continueLesson', '▶ Continue Lesson') : t('dashboard.startLesson', '▶ Start Lesson')}
                          </Button>
                        </div>
                      )
                    })()}
                  </Card.Body>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg">
                  <Card.Body className="text-center py-12">
                    <div className="text-6xl mb-4">📚</div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{t('dashboard.noLessonsAvailable', 'No Lessons Available')}</h3>
                    <p className="text-slate-600 mb-6">{t('dashboard.checkBackSoon', 'Check back soon for new lessons!')}</p>
                    <Button 
                      onClick={handleStartLesson} 
                      variant="secondary"
                      disabled={isNavigatingToLesson}
                      loading={isNavigatingToLesson}
                    >
                      {t('dashboard.browseLessons', 'Browse Lessons')}
                    </Button>
                  </Card.Body>
                </Card>
              </motion.div>
            )}

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <Card.Header>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800">
                      {t('dashboard.recentActivity', 'Recent Activity')}
                    </h2>
                    {recentLessons.length > 3 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsRecentActivityModalOpen(true)}
                        className="text-purple-600 hover:text-purple-700"
                      >
                        {t('dashboard.viewAll', 'View All')}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </Card.Header>
                <Card.Body>
                  {recentLessons.length > 0 ? (
                    <div className="space-y-3">
                      {recentLessons.slice(0, 3).map((lesson: any, index: number) => (
                        <motion.div
                          key={`${lesson.id}-${index}`}
                          className="bg-white border border-purple-200 rounded-lg p-4 hover:shadow-md transition-all duration-200"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 * index }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 flex-1">
                              <div className="flex-1">
                                <h4 className="font-semibold text-slate-800">
                                  {lesson.title || `Lesson ${lesson.lesson_number}: ${lesson.topic}`}
                                </h4>
                                <p className="text-sm text-slate-600">
                                  {lesson.score ? `${Math.min(100, Math.round(lesson.score))}%` : t('dashboard.notStarted', 'Not started')} • {lesson.duration || '~15 min'} • {lesson.date || t('dashboard.recently', 'Recently')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleViewLesson(lesson.id)}
                                className="text-xs px-2 py-1"
                              >
                                {t('dashboard.view', 'View')}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-4">📝</div>
                      <p className="text-slate-600 mb-4">{t('dashboard.noRecentActivity', 'No recent activity yet.')}</p>
                      <Button 
                        onClick={handleStartLesson} 
                        variant="secondary"
                        disabled={isNavigatingToLesson}
                        loading={isNavigatingToLesson}
                      >
                        {t('dashboard.startYourFirstLesson', 'Start Your First Lesson')}
                      </Button>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar (1/3 width) */}
          <div className="space-y-6">
            {/* Today's Goals Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <Card.Header>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center">
                    <span className="text-2xl mr-2">🔥</span>
                    {t('dashboard.dailyStreak', 'Daily Streak')}
                  </h3>
                </Card.Header>
                <Card.Body>
                  <div className="text-center mb-4">
                    <div className="text-5xl font-bold text-purple-600 mb-2">
                      {currentStreak}
                    </div>
                    <div className="text-sm text-slate-600 mb-4">
                      {currentStreak === 1 ? t('dashboard.dayInARow', 'day in a row') : t('dashboard.daysInARow', 'days in a row')}
                    </div>
                    <div className="flex justify-center space-x-2">
                      {Array.from({ length: 7 }, (_, i) => (
                        <div
                          key={i}
                          className={`w-4 h-4 rounded-full transition-all duration-300 ${
                            i < currentStreak
                              ? 'bg-purple-500 shadow-lg scale-110'
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-purple-200">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700">{t('dashboard.dailyGoal', 'Daily Goal')}</span>
                        <span className="font-semibold">{dailyProgress}/{dailyGoal}</span>
                      </div>
                      <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${(dailyProgress / dailyGoal) * 100}%` }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700">{t('dashboard.weeklyGoal', 'Weekly Goal')}</span>
                        <span className="font-semibold">{weeklyProgress}/{weeklyGoal}</span>
                      </div>
                      <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${(weeklyProgress / weeklyGoal) * 100}%` }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </motion.div>

            {/* Achievements */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <Card.Header className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    {t('dashboard.achievements', 'Achievements')}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAchievementModalOpen(true)}
                    className="text-purple-600 hover:text-purple-700"
                  >
                    {t('dashboard.viewAll', 'View All')}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Card.Header>
                <Card.Body>
                  {userProgress?.lastEarnedAchievements && userProgress.lastEarnedAchievements.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {userProgress.lastEarnedAchievements.map((achievement: any, index: number) => (
                        <div key={achievement.code || index} className="p-3 rounded-lg border-2 border-purple-300 bg-purple-50">
                          <div className="flex flex-col items-center text-center gap-2">
                            <div className="text-3xl">{achievement.icon}</div>
                            <div className="flex-1 w-full">
                              {index === 0 && (
                                <div className="text-xs text-purple-700 font-semibold mb-1">{t('dashboard.lastEarned', 'Last Earned')}</div>
                              )}
                              <div className="text-xs font-bold text-slate-800">
                                {achievement.name}
                              </div>
                              {achievement.earnedAt && (
                                <div className="text-xs text-slate-600 mt-1">
                                  {new Date(achievement.earnedAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-600">{t('dashboard.noAchievementsEarned', 'No achievements earned yet')}</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </motion.div>
            
            {/* Achievement Modal */}
            <AchievementModal
              isOpen={isAchievementModalOpen}
              onClose={() => setIsAchievementModalOpen(false)}
            />

            {/* Recent Activity Modal */}
            <Modal
              isOpen={isRecentActivityModalOpen}
              onClose={() => setIsRecentActivityModalOpen(false)}
              title={t('dashboard.allRecentActivity', 'All Recent Activity')}
              size="lg"
            >
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {recentLessons.length > 0 ? (
                  recentLessons.map((lesson: any, index: number) => (
                    <motion.div
                      key={`${lesson.id}-${index}`}
                      className="bg-white border border-purple-200 rounded-lg p-4 hover:shadow-md transition-all duration-200"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * index }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-800">
                              {lesson.title || `Lesson ${lesson.lesson_number}: ${lesson.topic}`}
                            </h4>
                            <p className="text-sm text-slate-600">
                              {lesson.score ? `${Math.min(100, Math.round(lesson.score))}%` : t('dashboard.notStarted', 'Not started')} • {lesson.duration || '~15 min'} • {lesson.date || t('dashboard.recently', 'Recently')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          {lesson.completed ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setIsRecentActivityModalOpen(false)
                                handleReviewLesson(lesson.id)
                              }}
                            >
                              {t('dashboard.review', 'Review')}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setIsRecentActivityModalOpen(false)
                                handleViewLesson(lesson.id)
                              }}
                            >
                              {t('dashboard.view', 'View')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-600">{t('dashboard.noRecentActivity', 'No recent activity yet.')}</p>
                  </div>
                )}
              </div>
            </Modal>

            {/* View Lesson Results Modal */}
            <Modal
              isOpen={viewLessonModal.isOpen}
              onClose={() => setViewLessonModal({ isOpen: false, lessonId: null, lessonData: null })}
              title={viewLessonModal.lessonData ? `${viewLessonModal.lessonData.title || `Lesson ${viewLessonModal.lessonData.lesson_number || ''}`}: Results` : 'Lesson Results'}
            >
              {viewLessonModal.lessonData ? (
                <div className="space-y-6">
                  {/* Overall Lesson Score */}
                  {viewLessonModal.lessonData.userProgress && (
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3 md:p-4">
                      <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-2 md:mb-3">{t('dashboard.overallScore', 'Overall Score')}</h3>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-2xl md:text-3xl font-bold text-purple-600 break-words">
                            {viewLessonModal.lessonData.userProgress.score || 0}%
                          </p>
                          <p className="text-xs md:text-sm text-slate-600 mt-1 break-words">
                            {viewLessonModal.lessonData.userProgress.completed ? t('dashboard.completedLabel', 'Completed') : t('dashboard.inProgress', 'In Progress')}
                          </p>
                        </div>
                        {viewLessonModal.lessonData.userProgress.stars && (
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            {[1, 2, 3].map((star) => (
                              <svg
                                key={star}
                                viewBox="0 0 24 24"
                                fill={star <= (viewLessonModal.lessonData.userProgress.stars || 0) ? 'currentColor' : 'none'}
                                className={`w-5 h-5 md:w-6 md:h-6 ${star <= (viewLessonModal.lessonData.userProgress.stars || 0) ? 'text-yellow-400' : 'text-gray-300'}`}
                              >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Activity Results */}
                  {viewLessonModal.lessonData.activityResults && viewLessonModal.lessonData.activityResults.length > 0 ? (
                    <div>
                      <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-2 md:mb-3">{t('dashboard.activityScores', 'Activity Scores')}</h3>
                      <div className="space-y-2 md:space-y-3">
                        {viewLessonModal.lessonData.activityResults.map((activity: any, index: number) => {
                          const activityName = activity.activityType
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())
                          const percentage = activity.maxScore > 0 
                            ? Math.round((activity.score / activity.maxScore) * 100) 
                            : 0
                          
                          return (
                            <div key={index} className="bg-white border border-purple-200 rounded-lg p-3 md:p-4">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                                <h4 className="font-semibold text-sm md:text-base text-slate-800 break-words min-w-0 flex-1">{activityName}</h4>
                                <span className="text-xs md:text-sm font-medium text-purple-600 flex-shrink-0">{percentage}%</span>
                              </div>
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                <div className="flex-1 bg-slate-200 rounded-full h-2 w-full">
                                  <div
                                    className={`h-2 rounded-full ${
                                      percentage >= 90 ? 'bg-green-500' :
                                      percentage >= 70 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-600 flex-shrink-0 whitespace-nowrap">
                                  {activity.score}/{activity.maxScore} {t('dashboard.points', 'points')}
                                </span>
                              </div>
                              {activity.attempts > 1 && (
                                <p className="text-xs text-slate-500 mt-2 break-words">{t('dashboard.attempts', 'Attempts:')} {activity.attempts}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 md:py-8">
                      <p className="text-sm md:text-base text-slate-600 break-words">{t('dashboard.noActivityResults', 'No activity results available yet.')}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-3 pt-4 border-t border-purple-200">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setViewLessonModal({ isOpen: false, lessonId: null, lessonData: null })
                        handleRetryLesson(viewLessonModal.lessonId!)
                      }}
                      className="flex-1"
                    >
                      {t('dashboard.retryLesson', 'Retry Lesson')}
                    </Button>
                    <Button
                      onClick={() => setViewLessonModal({ isOpen: false, lessonId: null, lessonData: null })}
                      className="flex-1"
                    >
                      {t('dashboard.close', 'Close')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-600">{t('dashboard.loadingLessonDetails', 'Loading lesson details...')}</p>
                </div>
              )}
            </Modal>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}
