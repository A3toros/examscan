'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter, useSearchParams } from 'next/navigation'
import { preloadNextActivity } from '@/utils/activityPreloader'
import { motion, AnimatePresence } from 'framer-motion'
import { ProtectedRoute, useUser } from '@/components/auth/ProtectedRoute'
import { Button, Card, Mascot, MascotThinking, ProgressBar, ActivityListItem } from '@/components/ui'
import { useNotification } from '@/contexts/NotificationContext'
import { useApi } from '@/hooks/useApi'
import LessonCompletionModal from '@/components/lesson/LessonCompletionModal'
import VocabularyMatchingDrag from '@/components/lesson/activities/VocabularyMatchingDrag'
import VocabularyFillBlanks from '@/components/lesson/activities/VocabularyFillBlanks'
import GrammarDragSentence from '@/components/lesson/activities/GrammarDragSentence'
import SpeakingWithFeedback from '@/components/lesson/activities/SpeakingWithFeedback'
import ReadingImprovement from '@/components/lesson/activities/ReadingImprovement'
import SpeakingImprovement from '@/components/lesson/activities/SpeakingImprovement'
import { getSpeakingHelper } from '@/utils/speakingHelper'
import { getAIFeedbackHelper } from '@/utils/aiFeedbackHelper'
import { getActivityIcon } from '@/utils/activityIcons'
import { lessonProgressStorage, type LessonProgressStorage } from '@/services/LessonProgressStorage'
import { backgroundSaveQueue, type ActivityResult } from '@/services/BackgroundSaveQueue'
import { lessonActivityFlow, type LessonSession, type Activity } from '@/services/LessonActivityFlow'
import '@/utils/lessonTestingHelpers' // Import testing helpers (makes functions available globally)

// Lesson step types
type LessonStep = 'warmup' | 'vocabulary' | 'grammar' | 'speaking' | 'improvement'

interface LessonData {
  id: string
  level: string
  number: number
  topic: string
  userProgress?: {
    score: number
    completed: boolean
    completed_at?: string
    attempts: number
  } | null
  steps: {
    warmup: {
      prompt: string
      aiFeedbackEnabled: boolean
    }
    vocabulary: {
      words: Array<{
        en: string
        th: string
        audioUrl?: string
      }>
      exercises: {
        matching: Array<{
          word: string
          meanings: string[]
          correct: number
        }>
        fillBlanks: Array<{
          activityOrder?: number
          sentence?: string
          text?: string
          options?: string[]
          correct?: number
          blanks?: Array<{
            id: string
            text: string
            options: string[]
            correctAnswer: string | number
          }>
        }>
      }
    }
    grammar: {
      explanation?: string
      examples?: string[]
      sentences: Array<{
        words: string[]
        correct: string
      }>
    }
    speaking: {
      prompts: Array<{ id: string; text: string }>
      feedbackCriteria: {
        grammar: boolean
        vocabulary: boolean
        pronunciation: boolean
      }
    }
    improvement: {
      type?: 'speaking_improvement' | 'reading_improvement'
      prompt?: string
      improvedText?: string
      targetText: string
      similarityThreshold: number
    }
  }
}

// All possible steps (used for mapping)
const allSteps: { id: LessonStep; label: string; icon: string }[] = [
  { id: 'warmup', label: 'Warm-up', icon: '🌅' },
  { id: 'vocabulary', label: 'Vocabulary', icon: '📚' },
  { id: 'grammar', label: 'Grammar', icon: '📝' },
  { id: 'speaking', label: 'Speaking', icon: '🎤' },
  { id: 'improvement', label: 'Improvement', icon: '✨' }
]

// Helper function to check if a step has content
const hasStepContent = (stepId: LessonStep, lessonData: LessonData | null): boolean => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33428b2c-5290-424a-9264-2f0b67af3763', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'hasStepContent entry',
      message: `Checking content for step: ${stepId}`,
      data: {
        stepId,
        lessonDataExists: !!lessonData,
        lessonDataKeys: lessonData ? Object.keys(lessonData) : null,
        stepsKeys: lessonData?.steps ? Object.keys(lessonData.steps) : null
      },
      timestamp: Date.now(),
      sessionId: 'debug-speaking-content',
      runId: 'hypothesis-test',
      hypothesisId: 'speaking-content-check'
    })
  }).catch(() => {});
  // #endregion

  if (!lessonData) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/33428b2c-5290-424a-9264-2f0b67af3763', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'hasStepContent null check',
        message: 'lessonData is null',
        data: { stepId },
        timestamp: Date.now(),
        sessionId: 'debug-speaking-content',
        runId: 'hypothesis-test',
        hypothesisId: 'speaking-content-check'
      })
    }).catch(() => {});
    // #endregion
    return false;
  }

  let result = false;

  switch (stepId) {
    case 'warmup':
      result = !!(lessonData.steps.warmup?.prompt);
      break;
    case 'vocabulary':
      result = !!(lessonData.steps.vocabulary?.words?.length ||
                lessonData.steps.vocabulary?.exercises?.matching?.length ||
                lessonData.steps.vocabulary?.exercises?.fillBlanks?.length);
      break;
    case 'grammar':
      result = !!(lessonData.steps.grammar?.sentences?.length ||
                lessonData.steps.grammar?.explanation ||
                lessonData.steps.grammar?.examples?.length);
      break;
    case 'speaking':
      // Speaking step just needs to exist - SpeakingStep handles empty prompts gracefully
      result = !!lessonData.steps.speaking;
      break;
    case 'improvement':
      // Improvement step should always be available if there's a speaking step
      // The improved transcript comes from localStorage (from AI feedback), not database
      result = !!(lessonData.steps.speaking?.prompts?.length || lessonData.steps.improvement?.targetText || lessonData.steps.improvement?.improvedText);
      break;
    default:
      result = false;
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33428b2c-5290-424a-9264-2f0b67af3763', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'hasStepContent result',
      message: `Step content check result for ${stepId}`,
      data: { stepId, result },
      timestamp: Date.now(),
      sessionId: 'debug-speaking-content',
      runId: 'hypothesis-test',
      hypothesisId: 'speaking-content-check'
    })
  }).catch(() => {});
  // #endregion

  return result;
}

/**
 * Dynamically map activity type to step based on activity type pattern and lesson data
 * This supports custom activity types created by admins
 */
const getStepFromActivityType = (activityType: string): LessonStep | null => {
  // Special cases first (important: improvement must not be treated as speaking)
  if (activityType === 'speaking_improvement' || activityType.includes('improvement')) {
    return 'improvement'
  }

  // Parse step from database activity_type prefix (scalable approach)
  const prefix = activityType.split('_')[0] // Get first part before underscore

  switch (prefix) {
    case 'warm': return 'warmup'      // warm_up_speaking -> warmup
    case 'vocabulary':
    case 'vocab': return 'vocabulary'  // vocabulary_matching_drag, vocab_match_drag -> vocabulary
    case 'grammar': return 'grammar'    // grammar_sentences -> grammar
    case 'speaking':
    case 'speak': return 'speaking'  // speaking_practice, speaking_with_feedback -> speaking
    case 'listening':
    case 'listen': return 'speaking'  // listening activities might be in speaking step
    case 'reading':
    case 'read': return 'improvement' // reading activities in improvement step
    case 'language': return 'improvement' // language_improvement_reading -> improvement
    default:
      console.warn(`Unknown activity type prefix: "${prefix}" for activity: "${activityType}". Using vocabulary as fallback.`)
      return 'vocabulary'
  }
}

function LessonContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { showNotification } = useNotification()
  const { makeAuthenticatedRequest } = useApi()

  // Activity-based session state (new - integrated)
  const [session, setSession] = useState<LessonSession | null>(null)
  const [activityUpdateCounter, setActivityUpdateCounter] = useState(0)
  
  // Legacy step-based state (for backward compatibility during transition)
  
  // Legacy step-based state (for backward compatibility)
  const [currentStep, setCurrentStep] = useState<LessonStep>('warmup')
  const [lessonData, setLessonData] = useState<LessonData | null>(null)
  const [stepProgress, setStepProgress] = useState<Record<LessonStep, boolean>>({
    warmup: false,
    vocabulary: false,
    grammar: false,
    speaking: false,
    improvement: false
  })
  const [activityResults, setActivityResults] = useState<any[]>([])
  const [partialActivityStates, setPartialActivityStates] = useState<Record<string, any>>({})
  const [activityStartTimes, setActivityStartTimes] = useState<Record<string, number>>({})
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [lessonStartTime, setLessonStartTime] = useState<number>(Date.now())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const hasInitializedFromStorage = React.useRef(false)


  // Get lesson ID from URL params
  const lessonId = searchParams.get('lessonId') || searchParams.get('id') || null

  // Local storage key for lesson progress - memoized to prevent recreation
  const lessonProgressKey = React.useMemo(
    () => `lesson-progress-${user?.id}-${lessonId}`,
    [user?.id, lessonId]
  )

  // Load lesson progress from localStorage (using new service)
  const loadLessonProgress = useCallback(() => {
    if (!user?.id || !lessonId) return null
    return lessonProgressStorage.loadProgress(user.id, lessonId)
  }, [user?.id, lessonId])

  // Load activity results from database (fallback if localStorage is empty/expired)
  const loadActivityResultsFromDB = useCallback(async () => {
    if (!user?.id || !lessonId) return null

    try {
      const response = await makeAuthenticatedRequest(
        `/.netlify/functions/get-lesson?lessonId=${lessonId}&userId=${user.id}`
      )
      
      if (!response.ok) return null
      
      const result = await response.json()
      if (!result.success || !result.userProgress) return null

      // Note: We would need a new endpoint to fetch lesson_activity_results
      // For now, we'll use the existing userProgress which indicates completion
      // In the future, we can add a get-lesson-activity-results endpoint
      return null // Placeholder - would fetch from lesson_activity_results table
    } catch (error) {
      console.error('Failed to load activity results from database:', error)
      return null
    }
  }, [user?.id, lessonId, makeAuthenticatedRequest])

  // Save lesson progress to localStorage
  const saveLessonProgress = useCallback((progressData: any) => {
    if (typeof window === 'undefined' || !user?.id || !lessonId) return

    try {
      const dataToSave = {
        ...progressData,
        savedAt: new Date().toISOString(),
        userId: user.id,
        lessonId
      }
      localStorage.setItem(lessonProgressKey, JSON.stringify(dataToSave))
    } catch (error) {
      console.warn('Failed to save lesson progress to localStorage:', error)
    }
  }, [user?.id, lessonId, lessonProgressKey])

  // Restore step-based state from session (runs after session is initialized)
  useEffect(() => {
    if (!session || !lessonData || hasInitializedFromStorage.current) return
    
    // Check if lesson is completed from database (source of truth)
    const isLessonCompleted = lessonData.userProgress?.completed || false
    
    if (isLessonCompleted) {
      console.log('Lesson already completed in database')
      // For completed lessons, set current step to last step for review
      setCurrentStep('improvement')
      hasInitializedFromStorage.current = true
      return
    }
    
    // Restore step progress from session activities
    const restoredProgress: Record<LessonStep, boolean> = {
      warmup: false,
      vocabulary: false,
      grammar: false,
      speaking: false,
      improvement: false
    }

    // Map completed activities to step progress using dynamic mapping
    // Only mark a step as completed if ALL activities in that step are completed
    const stepActivityTypes: Record<LessonStep, string[]> = {
      'warmup': ['warm_up_speaking'],
      'vocabulary': ['vocabulary_intro', 'vocabulary_matching_drag', 'vocab_match_drag', 'vocabulary_fill_blanks', 'vocab_fill_dropdown'],
      'grammar': ['grammar_explanation', 'grammar_drag_sentence', 'grammar_sentences'],
      'speaking': ['speaking_with_feedback', 'speaking_practice'],
      'improvement': ['speaking_improvement', 'language_improvement_reading']
    }

    // Check each step to see if all its activities are completed
    Object.entries(stepActivityTypes).forEach(([step, activityTypes]) => {
      const stepKey = step as LessonStep
      // Get all activities in this step that actually exist in the session
      const existingActivitiesInStep = session.activities.filter(a => 
        activityTypes.includes(a.activityType)
      )
      
      console.warn(`🔍 Checking step ${stepKey}:`, {
        activityTypes,
        existingActivitiesInStep: existingActivitiesInStep.map(a => ({
          type: a.activityType,
          status: a.status
        })),
        allCompleted: existingActivitiesInStep.length > 0 && existingActivitiesInStep.every(a => a.status === 'completed'),
        hasContent: hasStepContent(stepKey, lessonData)
      })
      
      // Only mark step as completed if:
      // 1. There are activities in this step in the session
      // 2. ALL of them are completed
      // 3. The step has content in lessonData
      const allCompleted = existingActivitiesInStep.length > 0 && 
        existingActivitiesInStep.every(a => a.status === 'completed')
      
      if (existingActivitiesInStep.length > 0 && 
          allCompleted &&
          hasStepContent(stepKey, lessonData)) {
        restoredProgress[stepKey] = true
        console.warn(`✅ [Restore] Marking step ${stepKey} as completed - all ${existingActivitiesInStep.length} activities completed`, {
          activities: existingActivitiesInStep.map(a => ({
            type: a.activityType,
            order: a.activityOrder,
            status: a.status
          }))
        })
      } else {
        console.warn(`⏳ [Restore] Step ${stepKey} not completed:`, {
          hasActivities: existingActivitiesInStep.length > 0,
          allCompleted,
          hasContent: hasStepContent(stepKey, lessonData),
          completedCount: existingActivitiesInStep.filter(a => a.status === 'completed').length,
          totalCount: existingActivitiesInStep.length,
          activities: existingActivitiesInStep.map(a => ({
            type: a.activityType,
            order: a.activityOrder,
            status: a.status
          }))
        })
      }
    })

    // Restore activity results from session
    const restoredActivityResults = session.activities
      .filter(a => a.status === 'completed')
      .map((activity) => ({
        activityType: activity.activityType,
        activityOrder: activity.activityOrder,
        score: activity.result?.score,
        maxScore: activity.result?.maxScore,
        attempts: activity.result?.attempts || 1,
        timeSpent: activity.result?.timeSpent || 0, // Keep in seconds
        completed: true,
        completedAt: activity.completedAt ? new Date(activity.completedAt).getTime() : Date.now(),
        answers: activity.result?.answers,
        feedback: activity.result?.feedback
      }))

    // Determine current step from session's first uncompleted activity
    // Find the first incomplete activity AFTER the last completed activity
    // This prevents going back to earlier activities if later ones are completed
    let firstIncompleteIndex = -1
    let lastCompletedIndex = -1
    
    // Find the last completed activity index
    for (let i = session.activities.length - 1; i >= 0; i--) {
      if (session.activities[i].status === 'completed') {
        lastCompletedIndex = i
        break
      }
    }
    
    // Find first incomplete activity after the last completed one
    // If no activities are completed, start from the beginning
    const startIndex = lastCompletedIndex >= 0 ? lastCompletedIndex + 1 : 0
    firstIncompleteIndex = session.activities.findIndex(
      (a, index) => index >= startIndex && a.status !== 'completed'
    )
    
    const currentActivity = firstIncompleteIndex >= 0 
      ? session.activities[firstIncompleteIndex]
      : session.activities[session.activities.length - 1] // Last activity if all completed
    
    console.warn('🔄 Restoring current step from session:', {
      currentActivityIndex: session.currentActivityIndex,
      lastCompletedIndex,
      firstIncompleteIndex,
      startIndex: lastCompletedIndex >= 0 ? lastCompletedIndex + 1 : 0,
      currentActivity: currentActivity ? {
        activityType: currentActivity.activityType,
        activityOrder: currentActivity.activityOrder,
        status: currentActivity.status
      } : null,
      allActivities: session.activities.map(a => ({
        type: a.activityType,
        order: a.activityOrder,
        status: a.status
      }))
    })
    
    if (currentActivity) {
      const mappedStep = getStepFromActivityType(currentActivity.activityType)
      if (mappedStep && hasStepContent(mappedStep, lessonData)) {
        // Don't skip steps just because they're marked as completed
        // Always show the step that corresponds to the current activity
        // The step completion status is just for UI display (checkmarks), not for skipping
        console.warn(`✅ Setting current step to: ${mappedStep} (from activity: ${currentActivity.activityType}, status: ${currentActivity.status})`)
        setCurrentStep(mappedStep)
        // Also update session's currentActivityIndex to match
        if (firstIncompleteIndex >= 0 && session.currentActivityIndex !== firstIncompleteIndex) {
          console.warn(`🔄 Updating session.currentActivityIndex from ${session.currentActivityIndex} to ${firstIncompleteIndex}`)
          setSession(prev => prev ? {
            ...prev,
            currentActivityIndex: firstIncompleteIndex
          } : null)
        }
      } else {
        console.warn(`⚠️ Cannot set step ${mappedStep}: step has no content or not mapped`, {
          mappedStep,
          hasContent: mappedStep ? hasStepContent(mappedStep, lessonData) : false
        })
      }
    } else {
      console.warn('⚠️ No current activity found in session')
    }

    setStepProgress(restoredProgress)
    setActivityResults(restoredActivityResults)
    setLessonStartTime(new Date(session.startedAt).getTime())
    hasInitializedFromStorage.current = true
    
    console.log('Progress restored from session:', {
      activities: session.activities.length,
      currentActivityIndex: session.currentActivityIndex,
      currentStep: currentActivity ? getStepFromActivityType(currentActivity.activityType) : 'warmup',
      completedActivities: session.activities.filter(a => a.status === 'completed').length
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, lessonData]) // Restore when session or lessonData changes

  // Reset initialization flag when lessonId or user changes
  useEffect(() => {
    hasInitializedFromStorage.current = false
  }, [user?.id, lessonId])

  // Note: Auto-save is now handled by LessonProgressStorage service in handleActivityComplete
  // Removed old auto-save useEffect to prevent circular reference errors

  // Track activity start time when step changes and preload next activity
  useEffect(() => {
    if (!lessonData) return

    // Map current step to activity types
    const stepToActivityTypes: Record<LessonStep, string[]> = {
      'warmup': ['warm_up_speaking'],
      'vocabulary': ['vocabulary_intro', 'vocabulary_matching_drag', 'vocabulary_fill_blanks'],
      'grammar': ['grammar_explanation', 'grammar_drag_sentence'],
      'speaking': ['speaking_with_feedback', 'speaking_practice'],
      'improvement': ['speaking_improvement', 'language_improvement_reading']
    }

    const activityTypes = stepToActivityTypes[currentStep] || []
    
    // Track start time for all activities in current step if not already tracked
    activityTypes.forEach(activityType => {
      if (!activityStartTimes[activityType]) {
        setActivityStartTimes(prev => ({ ...prev, [activityType]: Date.now() }))
      }
    })

    // Preload next activity assets and component code
    if (session) {
      const currentActivity = lessonActivityFlow.getCurrentActivity(session)
      if (currentActivity) {
        // Get next activity from session
        const nextActivityIndex = session.currentActivityIndex + 1
        const nextActivity = session.activities[nextActivityIndex] || null

        if (nextActivity) {
          // Map next activity type to step to get data using dynamic mapping
          const nextStep = getStepFromActivityType(nextActivity.activityType)
          if (nextStep && lessonData.steps) {
            let nextActivityData: any = null

            switch (nextStep) {
              case 'warmup':
                nextActivityData = lessonData.steps.warmup
                break
              case 'vocabulary':
                nextActivityData = lessonData.steps.vocabulary
                break
              case 'grammar':
                nextActivityData = lessonData.steps.grammar
                break
              case 'speaking':
                nextActivityData = lessonData.steps.speaking
                break
              case 'improvement':
                nextActivityData = lessonData.steps.improvement
                break
            }

            // Preload next activity assets
            preloadNextActivity(
              currentActivity.activityType,
              nextActivity.activityType,
              nextActivityData,
              router
            )
          }
        }
      }
    } else {
      // Fallback: determine next step based on current step
      const stepOrder: LessonStep[] = ['warmup', 'vocabulary', 'grammar', 'speaking', 'improvement']
      const currentIndex = stepOrder.indexOf(currentStep)
      const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : null

      if (nextStep && lessonData.steps) {
        let nextActivityData: any = null
        let nextActivityType: string | null = null
        const currentActivityType = activityTypes[0] || ''

        switch (nextStep) {
          case 'vocabulary':
            nextActivityType = 'vocabulary_intro'
            nextActivityData = lessonData.steps.vocabulary
            break
          case 'grammar':
            nextActivityType = 'grammar_explanation'
            nextActivityData = lessonData.steps.grammar
            break
          case 'speaking':
            nextActivityType = 'speaking_with_feedback'
            nextActivityData = lessonData.steps.speaking
            break
          case 'improvement':
            nextActivityType = 'speaking_improvement'
            nextActivityData = lessonData.steps.improvement
            break
        }

        if (nextActivityType && nextActivityData) {
          preloadNextActivity(currentActivityType, nextActivityType, nextActivityData, router)
        }
      }
    }
  }, [currentStep, lessonData, activityStartTimes, session, router])

  // Handle partial activity updates (for real-time saving)
  const handlePartialActivityUpdate = useCallback((activityType: string, partialState: any) => {
    setPartialActivityStates(prev => ({ ...prev, [activityType]: partialState }))

    // Track activity start time if not already tracked
    if (!activityStartTimes[activityType]) {
      setActivityStartTimes(prev => ({ ...prev, [activityType]: Date.now() }))
    }
  }, [activityStartTimes])

  // Map activity types to activity orders (based on typical lesson structure)
  const getActivityOrder = useCallback((activityType: string): number => {
    const orderMap: Record<string, number> = {
      'warm_up_speaking': 1,
      'vocabulary_intro': 2,
      'vocabulary_matching_drag': 2,
      'vocab_match_drag': 2,
      'vocabulary_matching': 2,
      'vocabulary_fill_blanks': 2,
      'vocab_fill_dropdown': 2,
      'grammar_explanation': 3,
      'grammar_drag_sentence': 4,
      'grammar_sentences': 4,
      'speaking_with_feedback': 5,
      'speaking_practice': 5,
      'language_improvement_reading': 6,
      'listening_practice': 6
    }
    return orderMap[activityType] || 0
  }, [])

  // Handle activity completion
  const handleActivityComplete = useCallback((activityType: string, result: any) => {
    console.warn('🟢 handleActivityComplete: Called', {
      activityType,
      result: result ? {
        activityId: result.activityId,
        activityOrder: result.activityOrder,
        score: result.score,
        maxScore: result.maxScore
      } : null,
      userId: user?.id,
      lessonId,
      isTransitioning,
      hasSession: !!session
    });

    if (!user?.id || !lessonId) {
      console.warn('⚠️ handleActivityComplete: Missing user or lessonId', { userId: user?.id, lessonId });
      return;
    }
    
    // Check if we're staying in the same step before setting transitioning
    // This prevents blocking when completing multiple activities in the same step
    let willStayInSameStep = false
    if (session && lessonData) {
      const currentStepFromActivity = getStepFromActivityType(activityType)
      
      // Find the next activity to check if we're staying in the same step
      const activityOrder = result.activityOrder || getActivityOrder(activityType)
      const activityIndex = session.activities.findIndex(
        a => a.activityType === activityType && 
             a.activityOrder === activityOrder && 
             a.status !== 'completed'
      )
      
      if (activityIndex >= 0) {
        // Check what the next activity will be after completing this one
        const nextActivityIndex = activityIndex + 1
        const nextActivity = session.activities[nextActivityIndex]
        if (nextActivity && currentStepFromActivity) {
          const nextStep = getStepFromActivityType(nextActivity.activityType)
          willStayInSameStep = nextStep === currentStepFromActivity
        }
      }
    }
    
    // In activity-based system, allow each activity to complete individually
    // Reset transitioning state to allow activity completion
    if (isTransitioning) {
      console.warn('⚠️ handleActivityComplete: Resetting isTransitioning to allow activity completion');
      setIsTransitioning(false);
    }
    
    // Set transitioning state to prevent multiple clicks (only if changing steps)
    if (!willStayInSameStep) {
      console.warn('🔄 handleActivityComplete: Setting isTransitioning to true');
      setIsTransitioning(true);
    } else {
      console.warn('ℹ️ handleActivityComplete: Staying in same step, not setting isTransitioning');
    }

    console.warn(`Activity ${activityType} completed:`, result)

    // Calculate time spent on this activity
    // Priority: 1) Use timeSpent from result (activities track their own time)
    //           2) Calculate from activityStartTimes
    //           3) Default to 0 if neither available
    let timeSpent = 0
    if (result.timeSpent !== undefined && result.timeSpent !== null) {
      // Activity already tracked its own time (in seconds)
      timeSpent = typeof result.timeSpent === 'number' ? result.timeSpent : 0
    } else {
      // Try to calculate from activity start time
      const activityStartTime = activityStartTimes[activityType]
      if (activityStartTime) {
        timeSpent = Math.floor((Date.now() - activityStartTime) / 1000)
      }
    }

    // Prepare activity result for background save
    const activityResult: ActivityResult = {
      activityId: result.activityId,
      activityType,
      activityOrder: result.activityOrder || getActivityOrder(activityType),
      score: result.score,
      maxScore: result.maxScore,
      attempts: result.attempts || 1,
      timeSpent,
      completedAt: new Date().toISOString(),
      answers: result.answers,
      feedback: result.feedback
    }

    // If using activity-based session, complete the activity through the flow service
    let updatedSession: LessonSession | null = null
    if (session) {
      // Find the activity by activityType (not just current activity)
      // Find activity by type and order (to handle multiple activities of same type, e.g., multiple fill blanks)
      const activityOrder = result.activityOrder || getActivityOrder(activityType)

      // Complete the current activity - that's what the user is completing
      // Find by type+order to avoid mismatches when currentActivityIndex lags
      const targetActivityOrder = result.activityOrder || getActivityOrder(activityType)
      const matchedIndex = session.activities.findIndex(
        a => a.activityType === activityType && a.activityOrder === targetActivityOrder
      )
      const finalActivityIndex = matchedIndex >= 0 ? matchedIndex : session.currentActivityIndex
      const currentActivity = session.activities[finalActivityIndex]

      // Strict validation: ensure we are completing the expected activity type
      if (!currentActivity || currentActivity.activityType !== activityType) {
        console.error('❌ handleActivityComplete: Current activity type mismatch', {
          expected: activityType,
          expectedOrder: targetActivityOrder,
          current: currentActivity?.activityType,
          currentOrder: currentActivity?.activityOrder,
          currentActivityIndex: session.currentActivityIndex,
          matchedIndex
        })
        return
      }
      
      if (finalActivityIndex >= 0) {
        const result = lessonActivityFlow.completeActivity(
          session,
          finalActivityIndex,
          activityResult
        )
        updatedSession = result.updatedSession
        const isLastActivity = result.isLastActivity

        console.warn('✅ Session updated after activity completion:', {
          activityType: activityType,
          activityIndex: finalActivityIndex,
          newStatus: updatedSession.activities[finalActivityIndex]?.status,
          currentActivityIndex: updatedSession.currentActivityIndex,
          totalActivities: updatedSession.activities.length
        })
        console.warn('🔄 handleActivityComplete: Calling setSession and setActivityUpdateCounter')
        setSession(updatedSession)
        setActivityUpdateCounter(prev => prev + 1)
        console.warn('✅ handleActivityComplete: State updates completed, should trigger re-render')

        // Map next activity to step and auto-advance
        const nextActivity = lessonActivityFlow.getCurrentActivity(updatedSession)
        if (nextActivity && !isLastActivity) {
          const nextStep = getStepFromActivityType(nextActivity.activityType)
          const currentStepFromActivity = getStepFromActivityType(activityType)
          const isSameStep = nextStep === currentStepFromActivity

          console.warn('🔍 handleActivityComplete: Step transition analysis', {
            currentActivity: activityType,
            nextActivity: nextActivity.activityType,
            currentStep: currentStepFromActivity,
            nextStep,
            isSameStep
          });

          if (isSameStep) {
            // Staying in the same step (e.g., multiple activities of same type)
            console.warn(`ℹ️ handleActivityComplete: Staying in same step (${nextStep}) - advancing to next activity in step`);
            // Advance activity index within the same step directly on updatedSession
            const nextIndex = Math.min(finalActivityIndex + 1, updatedSession.activities.length - 1)
            updatedSession = {
              ...updatedSession,
              currentActivityIndex: nextIndex
            }
            setSession(updatedSession)
            setIsTransitioning(false)
          } else if (nextStep && hasStepContent(nextStep, lessonData)) {
            // Crossing step boundary - only if target step has content
            console.warn(`✅ handleActivityComplete: CROSSING STEP BOUNDARY - ${currentStepFromActivity} → ${nextStep} for ${nextActivity?.activityType}`);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/33428b2c-5290-424a-9264-2f0b67af3763', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'handleActivityComplete before setCurrentStep',
                message: `About to call setCurrentStep(${nextStep})`,
                data: {
                  currentStep: currentStep,
                  nextStep,
                  nextActivityType: nextActivity?.activityType,
                  isTransitioning: isTransitioning,
                  hasStepContent: hasStepContent(nextStep, lessonData)
                },
                timestamp: Date.now(),
                sessionId: 'debug-ui-transition',
                runId: 'grammar-to-speaking',
                hypothesisId: 'ui-rerender-issue'
              })
            }).catch(() => {});
            // #endregion
            setCurrentStep(nextStep)
            // Reset isTransitioning immediately - React will handle the animation transition
            setIsTransitioning(false)
          } else {
            // Cannot cross to step without content
            console.warn(`⚠️ handleActivityComplete: BLOCKED step change - ${nextStep} has no content`);
            setIsTransitioning(false)
          }
        } else if (isLastActivity) {
          // Mark lesson as completed in localStorage (but don't clear progress yet)
          // Progress will be cleared after finalization in LessonCompletionModal
          if (user?.id && lessonId) {
            // Store completion flag
            const completionKey = `lesson-completed-${user.id}-${lessonId}`
            localStorage.setItem(completionKey, 'true')
            console.log('Lesson complete - marked as completed in localStorage')
          }
          setTimeout(() => {
            setShowCompletionModal(true)
            setIsTransitioning(false)
          }, 500)
        } else {
          // No next activity found in session, try to find next incomplete activity based on activity order
          console.warn('No next activity found, looking for next incomplete activity in session', { activityType, hasSession: !!session })
          
          if (updatedSession) {
            // Find the next incomplete activity after the current one
            const currentActivityOrder = activityResult.activityOrder || getActivityOrder(activityType)
            const nextIncompleteActivity = updatedSession.activities.find(
              a => a.activityOrder > currentActivityOrder && a.status !== 'completed'
            )
            
            if (nextIncompleteActivity) {
              const nextStep = getStepFromActivityType(nextIncompleteActivity.activityType)
              console.warn('Fallback progression - found next activity:', { 
                nextActivityType: nextIncompleteActivity.activityType, 
                nextActivityOrder: nextIncompleteActivity.activityOrder,
                nextStep,
                hasContent: nextStep ? hasStepContent(nextStep, lessonData) : false 
              })
              
              if (nextStep && hasStepContent(nextStep, lessonData)) {
                console.warn(`➡️ Advancing from ${activityType} to ${nextStep} (based on activity order)`)
                setCurrentStep(nextStep)
                // Update session to point to this activity
                const nextActivityIndex = updatedSession.activities.indexOf(nextIncompleteActivity)
                if (nextActivityIndex >= 0) {
                  setSession(prev => prev ? {
                    ...prev,
                    currentActivityIndex: nextActivityIndex
                  } : null)
                }
                setTimeout(() => {
                  setIsTransitioning(false)
                }, 300)
              } else {
                console.warn(`Cannot advance: nextStep=${nextStep}, hasContent=${nextStep ? hasStepContent(nextStep, lessonData) : false}`)
                setIsTransitioning(false)
              }
            } else {
              console.warn('No next incomplete activity found - lesson may be complete')
              setIsTransitioning(false)
            }
          } else {
            console.warn('No updated session available for fallback progression')
            setIsTransitioning(false)
          }
        }
      } else {
        // Activity not found in session - still enqueue for background save and try to advance
        console.warn(`Activity ${activityType} not found in session, but enqueuing for background save`)
        backgroundSaveQueue.enqueue(lessonId, result.activityId, activityResult)
        
        // Try to advance based on activity order in session (if available)
        if (session) {
          const currentActivityOrder = result.activityOrder || getActivityOrder(activityType)
          const nextIncompleteActivity = session.activities.find(
            a => a.activityOrder > currentActivityOrder && a.status !== 'completed'
          )
          
          if (nextIncompleteActivity) {
            const nextStep = getStepFromActivityType(nextIncompleteActivity.activityType)
            if (nextStep && hasStepContent(nextStep, lessonData)) {
              console.warn(`➡️ Advancing to ${nextStep} based on activity order (activity not in session)`)
              setCurrentStep(nextStep)
              const nextActivityIndex = session.activities.indexOf(nextIncompleteActivity)
              if (nextActivityIndex >= 0) {
                setSession(prev => prev ? {
                  ...prev,
                  currentActivityIndex: nextActivityIndex
                } : null)
              }
              setTimeout(() => {
                setIsTransitioning(false)
              }, 300)
            } else {
              setIsTransitioning(false)
            }
          } else {
            setIsTransitioning(false)
          }
        } else {
          setIsTransitioning(false)
        }
      }
    } else {
      // No session, reset transitioning
      setIsTransitioning(false)
    }

    // 1. Save to localStorage immediately (non-blocking)
    // If session exists, completeActivity() already saved the full session state.
    // We should NOT overwrite it with potentially stale data.
    // Only save if there's no session (legacy fallback)
    if (!session) {
      // Legacy path: no session, save manually
      const savedProgress = lessonProgressStorage.loadProgress(user.id, lessonId)
      const updatedProgress: LessonProgressStorage = {
        lessonId,
        userId: user.id,
        currentActivityIndex: savedProgress?.currentActivityIndex ?? 0,
        activities: savedProgress?.activities || [],
        startedAt: savedProgress?.startedAt || new Date().toISOString(),
        lastSavedAt: new Date().toISOString()
      }

      // Update or add activity in progress
      const activityIndex = updatedProgress.activities.findIndex(
        a => a.activityType === activityType && a.activityOrder === activityResult.activityOrder
      )

      const activityData = {
        activityId: result.activityId || `activity-${activityResult.activityOrder}`,
        activityOrder: activityResult.activityOrder,
        activityType,
        status: 'completed' as const,
        result: {
          score: activityResult.score,
          maxScore: activityResult.maxScore,
          attempts: activityResult.attempts,
          timeSpent: activityResult.timeSpent,
          answers: activityResult.answers,
          feedback: activityResult.feedback
        },
        completedAt: activityResult.completedAt
      }

      if (activityIndex >= 0) {
        updatedProgress.activities[activityIndex] = activityData
      } else {
        updatedProgress.activities.push(activityData)
      }

      // Find next incomplete activity index
      const nextIncompleteIndex = updatedProgress.activities.findIndex(
        a => a.status !== 'completed'
      )
      if (nextIncompleteIndex >= 0) {
        updatedProgress.currentActivityIndex = nextIncompleteIndex
      } else {
        updatedProgress.currentActivityIndex = Math.max(
          updatedProgress.currentActivityIndex,
          updatedProgress.activities.length - 1
        )
      }

      try {
        lessonProgressStorage.saveProgress(user.id, lessonId, updatedProgress)
        console.log('Progress saved to localStorage (legacy path, no session)')
      } catch (error) {
        console.error('Failed to save progress to localStorage:', error)
      }
    } else {
      // Session exists - completeActivity() already saved, no need to save again
      console.log('Session exists, completeActivity() already saved to localStorage, skipping duplicate save')
    }

    // 2. Enqueue background save (non-blocking)
    backgroundSaveQueue.enqueue(lessonId, result.activityId, activityResult)

    // 3. Update local state (for UI)
    const completeResult = {
      activityType,
      ...result,
      completed: true,
      timeSpent: timeSpent, // Keep in seconds (formatTime expects seconds)
      completedAt: Date.now(),
      partialStateHistory: partialActivityStates[activityType] || null
    }

    setActivityResults(prev => [...prev, completeResult])

    // Clear partial state for this activity since it's now complete
    setPartialActivityStates(prev => {
      const updated = { ...prev }
      delete updated[activityType]
      return updated
    })

    // Step progress is no longer maintained - using activity-level progress from session

    // Check if all activities are completed using session
    const allActivitiesCompleted = session ? lessonActivityFlow.areAllActivitiesCompleted(session) : false

    if (allActivitiesCompleted) {
      // Mark lesson as completed in localStorage (but don't clear progress yet)
      // Progress will be cleared after finalization in LessonCompletionModal
      if (user?.id && lessonId) {
        // Store completion flag
        const completionKey = `lesson-completed-${user.id}-${lessonId}`
        localStorage.setItem(completionKey, 'true')
        console.log('All steps completed - marked as completed in localStorage')
      }
      // Show completion modal after a short delay
      setTimeout(() => {
        setShowCompletionModal(true)
      }, 1000)
    }
  }, [user?.id, lessonId, stepProgress, activityResults, activityStartTimes, partialActivityStates, getActivityOrder])

  const loadLessonData = useCallback(async () => {
    if (!lessonId) {
      setError('Lesson ID is required')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await makeAuthenticatedRequest(`/.netlify/functions/get-lesson?lessonId=${lessonId}&userId=${user?.id || ''}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        // Merge userProgress into lesson data for easier access
        const lessonWithProgress = {
          ...result.lesson,
          userProgress: result.userProgress || null
        }
        setLessonData(lessonWithProgress)

        // Initialize activity-based session using LessonActivityFlow
        if (user?.id && lessonId) {
          // Check if lesson is completed from database (source of truth)
          const isLessonCompleted = result.userProgress?.completed || false
          
          // Always use activity results from database if available (even for incomplete lessons)
          // This ensures progress is restored after logout/login
          if (result.activityResults && result.activityResults.length > 0) {
            // Set activity results from database
            setActivityResults(result.activityResults)
            console.log('Loaded activity results from database:', result.activityResults.length)
          }
          
          // Try to restore from localStorage first (for in-progress work), but database takes precedence
          const savedProgress = loadLessonProgress()
          
          // Use database activities if available (preserves activity_order), otherwise fallback to transforming from lesson data
          let newSession: LessonSession | null = null
          if (result.activities && Array.isArray(result.activities) && result.activities.length > 0) {
            // Create activities directly from database (preserves order)
            let activities = lessonActivityFlow.createActivitiesFromDatabase(result.activities)
            // Sort activities by activityOrder for consistent indexing and proper progression
            activities.sort((a, b) => a.activityOrder - b.activityOrder)

            // Sort activities by activityOrder for consistent indexing
            activities.sort((a, b) => a.activityOrder - b.activityOrder)

            // Auto-complete non-assessed intro/explanation activities ONLY when restoring existing progress
            const hasPriorProgress = !!(savedProgress?.activities?.length) || !!(result.activityResults?.length)
            if (hasPriorProgress) {
              const autoCompleteTypes = new Set(['vocabulary_intro', 'grammar_explanation', 'vocabulary_matching_drag'])
              activities = activities.map(activity => {
                if (autoCompleteTypes.has(activity.activityType)) {
                  return {
                    ...activity,
                    status: 'completed' as const,
                    completedAt: activity.completedAt || new Date().toISOString(),
                    result: activity.result || {
                      score: 1,
                      maxScore: 1,
                      attempts: 1,
                      timeSpent: 0
                    }
                  }
                }
                return activity
              })
            }

            // Find first incomplete activity
            const firstIncompleteIndex = activities.findIndex(a => a.status === 'pending')
            const currentActivityIndex = firstIncompleteIndex >= 0 ? firstIncompleteIndex : activities.length - 1
            
            newSession = {
              lessonId,
              userId: user.id,
              currentActivityIndex,
              activities,
              startedAt: savedProgress?.startedAt || new Date().toISOString(),
              lastSavedAt: savedProgress?.lastSavedAt || new Date().toISOString()
            }
            
            // Restore progress from saved progress or database activity results
            if (savedProgress) {
              // Map saved activities to database activities
              activities.forEach((activity, index) => {
                const savedActivity = savedProgress.activities.find(
                  a => a.activityType === activity.activityType && a.activityOrder === activity.activityOrder
                )
                if (savedActivity && savedActivity.status === 'completed') {
                  activity.status = 'completed'
                  activity.result = savedActivity.result
                  activity.completedAt = savedActivity.completedAt
                }
              })
              
              // Update current activity index
              const firstIncomplete = activities.findIndex(a => a.status === 'pending')
              if (firstIncomplete >= 0) {
                newSession.currentActivityIndex = firstIncomplete
              }
            }
            
            // Also restore from database activity results
            if (result.activityResults && result.activityResults.length > 0) {
              result.activityResults.forEach((activityResult: any) => {
                const activity = activities.find(
                  a => a.activityType === activityResult.activityType && 
                       a.activityOrder === activityResult.activityOrder
                )
                if (activity) {
                  activity.status = 'completed'
                  activity.result = {
                    score: activityResult.score,
                    maxScore: activityResult.max_score,
                    attempts: activityResult.attempts,
                    timeSpent: activityResult.time_spent,
                    answers: activityResult.answers,
                    feedback: activityResult.feedback
                  }
                  activity.completedAt = activityResult.completed_at
                }
              })
              
              // Update current activity index after restoring from database
              const firstIncomplete = activities.findIndex(a => a.status === 'pending')
              if (firstIncomplete >= 0) {
                newSession.currentActivityIndex = firstIncomplete
              }
            }
          } else {
            // Fallback: use transformLessonDataToActivities if database activities not available
            newSession = lessonActivityFlow.initializeSession(
              lessonId,
              user.id,
              result.lesson,
              savedProgress
            )
          }
          
          // Always restore session from database activity results if they exist (completed or incomplete)
          if (newSession && result.activityResults && result.activityResults.length > 0) {
            // Map activity results to session activities
            newSession.activities = newSession.activities.map(activity => {
              const activityResult = result.activityResults.find(
                (ar: any) => ar.activityType === activity.activityType && 
                            ar.activityOrder === activity.activityOrder
              )
              
              if (activityResult) {
                return {
                  ...activity,
                  status: 'completed' as const,
                  result: {
                    score: activityResult.score,
                    maxScore: activityResult.maxScore,
                    attempts: activityResult.attempts,
                    timeSpent: activityResult.timeSpent, // Already in seconds (database stores seconds)
                    answers: activityResult.answers,
                    feedback: activityResult.feedback
                  },
                  completedAt: new Date(activityResult.completedAt).toISOString()
                }
              }
              return activity // Keep activity as-is if no result found
            })
            
            // Set current activity to first incomplete activity AFTER the last completed one
            // This prevents going back to earlier activities if later ones are completed
            let firstIncompleteIndex = -1
            let lastCompletedIndex = -1
            
            // Find the last completed activity index
            for (let i = newSession.activities.length - 1; i >= 0; i--) {
              if (newSession.activities[i].status === 'completed') {
                lastCompletedIndex = i
                break
              }
            }
            
            // Find first incomplete activity after the last completed one
            // If no activities are completed, start from the beginning
            const startIndex = lastCompletedIndex >= 0 ? lastCompletedIndex + 1 : 0
            firstIncompleteIndex = newSession.activities.findIndex(
              (a, index) => index >= startIndex && a.status !== 'completed'
            )
            
            if (firstIncompleteIndex >= 0) {
              newSession.currentActivityIndex = firstIncompleteIndex
            } else {
              // All activities completed
              newSession.currentActivityIndex = Math.max(0, newSession.activities.length - 1)
            }
          }
          
          setSession(newSession)
          console.log('Session initialized:', {
            lessonId,
            activitiesCount: newSession.activities.length,
            currentActivityIndex: newSession.currentActivityIndex,
            hasSavedProgress: !!savedProgress,
            isCompleted: isLessonCompleted,
            completedFromDB: result.userProgress?.completed,
            activityResultsFromDB: result.activityResults?.length || 0
          })
          
          // Sync step-based state for backward compatibility
          // Restore step from session's current activity
          // Only restore if there's actual progress (not a fresh start)
          const hasProgress = result.activityResults && result.activityResults.length > 0
          const currentActivity = newSession.activities[newSession.currentActivityIndex]
          if (currentActivity && hasProgress) {
            // Use dynamic step mapping to support custom activity types
            const mappedStep = getStepFromActivityType(currentActivity.activityType)
            if (mappedStep && hasStepContent(mappedStep, result.lesson)) {
              setCurrentStep(mappedStep)
              console.log('Step restored from session:', mappedStep, 'from activity:', currentActivity.activityType)
            }
          } else if (!hasProgress && currentActivity) {
            // Fresh lesson - ensure we start at warmup if it exists
            // For fresh lessons, always start at warmup if it exists, otherwise use the first activity's step
            if (hasStepContent('warmup', result.lesson)) {
              setCurrentStep('warmup')
              console.log('Fresh lesson - starting at warmup')
            } else {
              // Use dynamic step mapping for the first activity
              const mappedStep = getStepFromActivityType(currentActivity.activityType)
              if (mappedStep && hasStepContent(mappedStep, result.lesson)) {
                setCurrentStep(mappedStep)
                console.log('Fresh lesson - starting at:', mappedStep, 'from activity:', currentActivity.activityType)
              }
            }
          }
          
          // Step progress restoration removed - using activity-level progress from session
        }

        // Legacy step progress update removed - using activity-level progress
      } else {
        throw new Error(result.error || 'Failed to load lesson')
      }
    } catch (error) {
      console.error('Failed to load lesson:', error)
      setError(error instanceof Error ? error.message : 'Failed to load lesson')
      showNotification(t('lessons.loadError', 'Failed to load lesson'), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [lessonId, user?.id, makeAuthenticatedRequest, showNotification, t, loadLessonProgress])

  useEffect(() => {
    loadLessonData()
  }, [loadLessonData])

  // Get available activities from session (activity-based system)
  // Returns individual activities instead of grouped steps
  const availableActivities = React.useMemo(() => {
    if (!session || !session.activities.length) return []

    // Return activities sorted by activityOrder, with additional display properties
    const activities = session.activities
      .sort((a, b) => a.activityOrder - b.activityOrder)
      .map(activity => ({
        id: activity.activityOrder.toString(), // Use activityOrder as unique identifier
        label: activity.title || activity.activityType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        icon: getActivityIcon(activity.activityType),
        activity: activity // Keep full activity object for reference
      }))

    console.warn('📋 Available activities from session:', activities.map(a => `${a.id}: ${a.label} (${a.activity.status})`))
    return activities
  }, [session, activityUpdateCounter])

  // Validate current step when activities change
  useEffect(() => {
    if (lessonData && availableActivities.length > 0 && session) {
      // Get the current activity
      const currentActivity = session.activities[session.currentActivityIndex]
      if (currentActivity) {
        // Update current step to match current activity
        const step = getStepFromActivityType(currentActivity.activityType)
        if (step && step !== currentStep) {
          setCurrentStep(step)
          console.warn('Updated current step to match current activity:', { step, activityType: currentActivity.activityType })
        }
      }
    }
  }, [lessonData, availableActivities, session, currentStep])




  // Calculate progress percentage from session activities
  const progressPercentage = React.useMemo(() => {
    if (session) {
      return lessonActivityFlow.getProgressPercentage(session)
    }
    return 0 // No progress if no session yet
  }, [session])

  const getActivityStatus = (activityOrder: number) => {
    if (!session) return 'hidden'

    const activity = session.activities.find(a => a.activityOrder === activityOrder)
    if (!activity) return 'hidden'

    // Check if activity is accessible (all previous activities are completed)
    const previousActivities = session.activities
      .filter(a => a.activityOrder < activityOrder)
      .sort((a, b) => a.activityOrder - b.activityOrder)

    const allPreviousCompleted = previousActivities.every(a => a.status === 'completed')
    const isAccessible = allPreviousCompleted

    if (!isAccessible) return 'locked'
    if (activity.status === 'completed') return 'completed'
    if (session.currentActivityIndex === session.activities.indexOf(activity)) return 'active'
    return 'pending'
  }

  // Handle activity click - allow navigation to accessible activities
  const handleActivityClick = useCallback((activityOrder: number) => {
    if (!session) return

    const activity = session.activities.find(a => a.activityOrder === activityOrder)
    if (!activity) return

    const status = getActivityStatus(activityOrder)
    if (status === 'locked' || status === 'hidden') return // Don't allow navigation to locked activities

    // Find the activity index in the session
    const activityIndex = session.activities.indexOf(activity)
    if (activityIndex >= 0) {
      // Update current activity index
      setSession(prev => prev ? {
        ...prev,
        currentActivityIndex: activityIndex
      } : null)

      // Update current step based on activity type
      const step = getStepFromActivityType(activity.activityType)
      if (step) {
        setCurrentStep(step)
      }

      console.warn('🔄 Navigated to activity:', {
        activityOrder,
        activityType: activity.activityType,
        activityIndex,
        step
      })
    }
  }, [session, lessonData])


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Mascot size="lg" emotion="thinking" />
          <p className="mt-4 text-neutral-600">{t('lessons.loading', 'Loading lesson...')}</p>
        </div>
      </div>
    )
  }

  if (!lessonData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600">{t('lessons.notFound', 'Lesson not found')}</p>
          <Button onClick={() => window.history.back()} className="mt-4">
            {t('common.back', 'Back')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      {/* Header */}
      <div className="bg-white px-2 md:px-4 py-2 md:py-3">
        <div className="container mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
            <Button variant="secondary" size="sm" onClick={() => window.history.back()} className="flex-shrink-0">
              ← <span className="hidden sm:inline">{t('common.back', 'Back')}</span>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm md:text-lg font-semibold truncate">
                {t('lessons.lessonNumber', { number: lessonData.number })} - {lessonData.topic}
              </h1>
              <p className="text-xs md:text-sm text-neutral-600">
                {lessonData.level} • {t('lessons.progress', 'Progress')}: {progressPercentage}%
              </p>
            </div>
          </div>

          <div className="w-20 md:w-32 flex-shrink-0">
            <ProgressBar progress={progressPercentage} size="sm" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-2 md:px-4 py-4 md:py-6 pb-8 md:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Step Navigation Sidebar */}
          <div className="lg:col-span-1 hidden md:block">
            <Card>
              <Card.Header>
                <h3 className="text-base md:text-lg font-semibold">{t('lessons.activities', 'Lesson Activities')}</h3>
              </Card.Header>
              <Card.Body className="space-y-2">
                {availableActivities.map((activityItem, index) => {
                  const status = getActivityStatus(parseInt(activityItem.id))
                  if (status === 'hidden') return null

                  return (
                    <ActivityListItem
                      key={`${activityItem.id}-${activityItem.activity.status}-${status}`}
                      activity={activityItem.activity}
                      index={index + 1}
                      isActive={status === 'active'}
                      isAccessible={status !== 'locked'}
                      onClick={() => handleActivityClick(parseInt(activityItem.id))}
                    />
                  )
                })}
              </Card.Body>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {lessonId && (
                  <LessonStepContent
                    step={currentStep}
                    lessonData={lessonData}
                    currentActivity={session?.activities[session.currentActivityIndex]}
                    isCompleted={false} // No longer used in activity-based system
                    lessonId={lessonId}
                    handleActivityComplete={(activityType: string, result: any) => {
                      if (!isTransitioning) {
                        handleActivityComplete(activityType, result)
                      }
                    }}
                    isTransitioning={isTransitioning}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Lesson Completion Modal */}
      <LessonCompletionModal
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        lessonId={lessonData.id}
        lessonTitle={lessonData.topic}
        level={lessonData.level}
        totalScore={activityResults.reduce((sum, result) => sum + (result.score || 0), 0)}
        maxScore={activityResults.reduce((sum, result) => sum + (result.maxScore || 0), 0)}
        results={activityResults.map(result => ({
          activityType: result.activityType,
          score: result.score || 0,
          maxScore: result.maxScore || 0,
          timeSpent: result.timeSpent || 0,
          attempts: result.attempts || 1,
          completed: result.completed || false
        }))}
        timeSpent={Math.round((Date.now() - lessonStartTime) / 1000)}
        onContinue={() => {
          setShowCompletionModal(false)
          // localStorage is already cleared in LessonCompletionModal after successful finalization
          // Navigate to dashboard
          router.push('/dashboard')
        }}
        onRetry={() => {
          setShowCompletionModal(false)
          // Reset lesson state and start over
          setStepProgress({
            warmup: false,
            vocabulary: false,
            grammar: false,
            speaking: false,
            improvement: false
          })
          setCurrentStep('warmup')
          setActivityResults([])
          setLessonStartTime(Date.now())
        }}
      />
    </div>
  )
}

// Lesson Step Content Component
interface LessonStepContentProps {
  step: LessonStep
  lessonData: LessonData
  currentActivity?: Activity
  onComplete?: () => void // Made optional for activity-based system
  isCompleted: boolean
  lessonId: string
  handleActivityComplete: (activityType: string, result: any) => void
  isTransitioning?: boolean
}

function LessonStepContent({ step, lessonData, currentActivity, onComplete, isCompleted, lessonId, handleActivityComplete, isTransitioning = false }: LessonStepContentProps) {
  const { t } = useTranslation()

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33428b2c-5290-424a-9264-2f0b67af3763', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'LessonStepContent render',
      message: `LessonStepContent rendering for step: ${step}`,
      data: {
        step,
        isTransitioning,
        currentActivityType: currentActivity?.activityType,
        currentActivityOrder: currentActivity?.activityOrder,
        lessonDataSteps: lessonData?.steps ? Object.keys(lessonData.steps) : null,
        hasSpeakingStep: !!lessonData?.steps?.speaking,
        speakingPromptsLength: lessonData?.steps?.speaking?.prompts?.length || 0
      },
      timestamp: Date.now(),
      sessionId: 'debug-ui-transition',
      runId: 'grammar-to-speaking',
      hypothesisId: 'step-rerender-tracking'
    })
  }).catch(() => {});
  // #endregion

  const renderStepContent = () => {
    // Provide a no-op onComplete for backward compatibility with step components
    // In the activity-based system, individual activities handle their own completion
    const noopOnComplete = () => {}

    switch (step) {
      case 'warmup':
        return <WarmupStep data={lessonData.steps.warmup} onComplete={(result: any) => !isTransitioning && handleActivityComplete('warm_up_speaking', result)} isCompleted={isCompleted} isTransitioning={isTransitioning} />
      case 'vocabulary':
        return <VocabularyStep data={lessonData.steps.vocabulary} onComplete={onComplete || noopOnComplete} isCompleted={isCompleted} lessonId={lessonId} handleActivityComplete={handleActivityComplete} isTransitioning={isTransitioning} />
      case 'grammar':
        return <GrammarStep data={lessonData.steps.grammar} currentActivity={currentActivity} onComplete={onComplete || noopOnComplete} isCompleted={isCompleted} lessonId={lessonId} handleActivityComplete={handleActivityComplete} isTransitioning={isTransitioning} />
      case 'speaking':
        return <SpeakingStep data={lessonData.steps.speaking} currentActivity={currentActivity} onComplete={onComplete || noopOnComplete} isCompleted={isCompleted} lessonId={lessonId} handleActivityComplete={handleActivityComplete} isTransitioning={isTransitioning} />
      case 'improvement':
        return <ImprovementStep data={lessonData.steps.improvement} currentActivity={currentActivity} onComplete={onComplete || noopOnComplete} isCompleted={isCompleted} lessonId={lessonId} handleActivityComplete={handleActivityComplete} isTransitioning={isTransitioning} />
      default:
        return <div>Unknown step</div>
    }
  }

  return (
    <div className="space-y-6">
      {renderStepContent()}
    </div>
  )
}

// Warmup step with recording and API calls
function WarmupStep({ data, onComplete, isCompleted, isTransitioning = false }: any) {
  const { t } = useTranslation()
  const { showNotification } = useNotification()
  const { makeAuthenticatedRequest } = useApi()
  const [response, setResponse] = useState('')
  const [feedback, setFeedback] = useState<any>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [hasMicPermission, setHasMicPermission] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Check microphone permission
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (navigator.permissions) {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName })
          if (permissionStatus.state === 'granted') {
            setHasMicPermission(true)
          }
        }
      } catch (err) {
        console.log('Could not check microphone permission:', err)
      }
    }
    checkPermission()
  }, [])

  // Request microphone permission
  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setHasMicPermission(true)
      setError(null)
      stream.getTracks().forEach(track => track.stop())
    } catch (err) {
      const error = err as Error
      if (error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access.')
      } else {
        setError(`Microphone access failed: ${error.message}`)
      }
    }
  }

  // Get supported MIME type (platform-specific)
  const getSupportedMimeType = () => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOSDevice) {
      // iOS Safari only supports MP4 formats
      const iosTypes = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2'];
      const supportedType = iosTypes.find(type => MediaRecorder.isTypeSupported(type));
      if (supportedType) {
        console.log(`✅ iOS: Using audio format: ${supportedType}`);
        return supportedType;
      }
      throw new Error('MediaRecorder is not fully supported on this iOS version. Please update iOS or use a different browser.');
    }

    // Android/Desktop: Prioritize WebM/Opus (better quality)
    const preferredTypes = [
      'audio/webm;codecs=opus',      // Best quality for speech
      'audio/webm',                   // WebM fallback
      'audio/mp4;codecs=mp4a.40.2',  // MP4 AAC fallback
      'audio/mp4'                     // Generic MP4 last resort
    ];
    const supportedType = preferredTypes.find(type => MediaRecorder.isTypeSupported(type));
    if (!supportedType) {
      throw new Error("No supported audio format found.");
    }
    console.log(`✅ Non-iOS: Using audio format: ${supportedType}`);
    return supportedType;
  }

  // Convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Start recording
  const startRecording = useCallback(async () => {
    // Reset stopping state when starting a new recording
    setIsStopping(false)
    if (isRecording || !hasMicPermission) return

    try {
      setIsRecording(true)
      setError(null)

      // Platform-specific audio constraints
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      const audioConstraints = isIOSDevice
        ? { audio: { echoCancellation: true } } // iOS: minimal constraints
        : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }; // Others: full constraints

      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints)

      streamRef.current = stream
      const mimeType = getSupportedMimeType()
      
      // Platform-specific MediaRecorder options
      const recorderOptions = isIOSDevice
        ? { mimeType } // iOS: no audioBitsPerSecond (not supported)
        : { mimeType, audioBitsPerSecond: 64000 }; // Others: optimal bitrate for speech

      const mediaRecorder = new MediaRecorder(stream, recorderOptions)

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType })
        if (audioBlob.size === 0) {
          setError('No audio recorded. Please try again.')
          setIsProcessing(false)
          setIsRecording(false)
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
          }
          mediaRecorderRef.current = null
          return
        }

        setIsProcessing(true)
        setError(null)

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
        mediaRecorderRef.current = null

        try {
          const base64Audio = await blobToBase64(audioBlob)
          
          const response = await fetch('/.netlify/functions/ai-speech-to-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio_blob: base64Audio,
              audio_mime_type: mimeType,
              test_id: 'lesson_warmup',
              question_id: 'warmup',
              prompt: data.prompt
            })
          })

          const result = await response.json()

          if (!result.success) {
            throw new Error(result.error || result.message || 'Processing failed')
          }

          setResponse(result.transcript || '')
          
          // Map feedback structure - API returns properties at top level (matching SpeakingTest.tsx)
          if (result.overall_score !== undefined || result.feedback) {
            const mappedFeedback = {
              overall_score: result.overall_score,
              is_off_topic: result.is_off_topic || false,
              feedback: result.feedback,
              grammar_corrections: result.grammar_corrections || [],
              vocabulary_corrections: result.vocabulary_corrections || [],
              ai_feedback: result.ai_feedback || null
            };
            setFeedback(mappedFeedback);
          }
        } catch (error: any) {
          console.error('Processing error:', error)
          setError(error.message || 'Failed to process recording. Please try again.')
        } finally {
          setIsProcessing(false)
        }
      }

      mediaRecorder.start()
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData()
          mediaRecorderRef.current.stop()
        }
      }, 60000)
    } catch (error) {
      console.error('Failed to start recording:', error)
      setError('Failed to start recording. Please check your microphone permissions.')
      setIsRecording(false)
    }
  }, [isRecording, hasMicPermission, data.prompt])

  // Stop recording
  const stopRecording = useCallback(() => {
    // Immediately disable button and show gray state
    setIsStopping(true)
    
    if (!mediaRecorderRef.current) {
      setIsRecording(false)
      setIsStopping(false)
      return
    }

    const mediaRecorder = mediaRecorderRef.current
    if (mediaRecorder.state === 'recording') {
      setIsRecording(false)
      setIsProcessing(true)
      mediaRecorder.requestData()
      mediaRecorder.stop()
    } else {
      setIsRecording(false)
      setIsStopping(false)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      mediaRecorderRef.current = null
    }
  }, [])

  if (!hasMicPermission) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="mb-6">
            <div className="text-6xl mb-4">🎤</div>
            <h4 className="text-base md:text-lg font-semibold mb-2">Microphone Access Required</h4>
            <p className="text-neutral-600">
              This activity requires microphone access to record your spoken response.
            </p>
          </div>
          <Button onClick={requestMicPermission} size="lg" className="bg-blue-500 hover:bg-blue-600">
            🎤 Allow Microphone Access
          </Button>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="p-4 bg-neutral-50 rounded-lg">
          <p className="text-sm md:text-lg font-medium mb-3 md:mb-4">{data.prompt}</p>
          <p className="text-sm text-neutral-600">
            {t('lessons.warmupInstructions', 'Speak naturally about this topic. The AI will provide feedback.')}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {!isProcessing && !response && (
          <div className="flex justify-center">
            {isRecording ? (
              <img 
                src="/mic-stop.png" 
                alt="Stop Recording" 
                className={`w-16 h-16 transition-all duration-200 ${
                  isStopping 
                    ? 'opacity-50 grayscale cursor-not-allowed' 
                    : 'cursor-pointer hover:opacity-80'
                }`}
                onClick={isStopping ? undefined : stopRecording}
                onError={(e) => {
                  console.error('Failed to load mic-stop.png');
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <img 
                src="/mic-start.png" 
                alt="Start Recording" 
                className="w-16 h-16 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={startRecording}
                onError={(e) => {
                  console.error('Failed to load mic-start.png');
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>
        )}

        {isProcessing && (
          <div className="flex flex-col items-center justify-center py-12">
            <MascotThinking
              speechText="Analyzing your Meow meow"
              alwaysShowSpeech={true}
              className="scale-125"
            />
            <div className="mt-8 text-center">
              <div className="inline-flex space-x-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"
                    style={{
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: '1.5s'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {response && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">📝 Your Response:</h4>
              <p className="text-green-900 italic">&ldquo;{response}&rdquo;</p>
            </div>

            {feedback && (
              <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                <h4 className="font-semibold text-purple-800 mb-3">AI Feedback:</h4>
                
                {/* Show off-topic warning if applicable */}
                {feedback.is_off_topic && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-red-800 text-sm font-medium">⚠️ Your response seems off-topic. Please try to address the prompt more directly.</p>
                  </div>
                )}

                {/* Show feedback only if on-topic */}
                {!feedback.is_off_topic && (
                  <>
                    {feedback.overall_score !== undefined && (
                      <div className="mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Score:</span>
                          <div className="flex space-x-1">
                            {Array.from({ length: 5 }, (_, i) => (
                              <div
                                key={i}
                                className={`w-4 h-4 rounded ${
                                  i < Math.round(feedback.overall_score / 20) ? 'bg-yellow-400' : 'bg-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-600">({feedback.overall_score}/100)</span>
                        </div>
                      </div>
                    )}

                    {/* Grammar Corrections - filter out capitalization-only corrections for spoken responses */}
                    {feedback.grammar_corrections && feedback.grammar_corrections.length > 0 && (() => {
                      // Filter out capitalization-only corrections (not relevant for spoken language)
                      const meaningfulCorrections = feedback.grammar_corrections.filter((correction: any) => {
                        const mistake = (correction.mistake || '').toLowerCase();
                        const correctionText = (correction.correction || '').toLowerCase();
                        // Only show if the correction changes more than just capitalization
                        return mistake !== correctionText;
                      });
                      
                      if (meaningfulCorrections.length === 0) return null;
                      
                      return (
                        <div className="mb-3">
                          <h5 className="font-semibold text-purple-700 mb-2 text-sm">Grammar Corrections:</h5>
                          <ul className="list-disc list-inside space-y-1">
                            {meaningfulCorrections.map((correction: any, idx: number) => (
                              <li key={idx} className="text-sm text-purple-900">
                                <span className="line-through text-red-600">{correction.mistake}</span>
                                {' → '}
                                <span className="text-green-700 font-medium">{correction.correction}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* Vocabulary Corrections */}
                    {feedback.vocabulary_corrections && feedback.vocabulary_corrections.length > 0 && (
                      <div className="mb-3">
                        <h5 className="font-semibold text-purple-700 mb-2 text-sm">Vocabulary Suggestions:</h5>
                        <ul className="list-disc list-inside space-y-1">
                          {feedback.vocabulary_corrections.map((correction: any, idx: number) => (
                            <li key={idx} className="text-sm text-purple-900">
                              <span className="line-through text-red-600">{correction.mistake}</span>
                              {' → '}
                              <span className="text-green-700 font-medium">{correction.correction}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Overall Feedback */}
                    {feedback.feedback && (
                      <div className="mt-3 pt-3 border-t border-purple-200">
                        <p className="text-purple-900 text-sm leading-relaxed">{feedback.feedback}</p>
                      </div>
                    )}

                    {/* AI Feedback (if available) */}
                    {feedback.ai_feedback && (
                      <div className="mt-3 pt-3 border-t border-purple-200">
                        <p className="text-purple-800 text-xs italic">{feedback.ai_feedback}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {response && !isCompleted && (
          <div className="flex justify-center">
            <Button 
              onClick={() => {
                if (isTransitioning) return
                // Pass result object instead of event
                onComplete({
                  activityId: `warmup-${Date.now()}`,
                  activityOrder: 1,
                  score: feedback?.overall_score || 0,
                  maxScore: 100,
                  attempts: 1,
                  answers: {
                    transcript: response,
                    feedback: feedback
                  },
                  feedback: feedback
                })
              }} 
              disabled={isTransitioning}
              size="lg"
            >
              {isTransitioning ? t('common.loading', 'Loading...') : t('common.next', 'Next')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function VocabularyStep({ data, onComplete, isCompleted, lessonId, handleActivityComplete, isTransitioning = false }: any) {
  const { t } = useTranslation()
  const [vocabStep, setVocabStep] = useState<'intro' | 'matching' | 'fill_blanks'>('intro')
  const [currentMatchingIndex, setCurrentMatchingIndex] = useState(0)
  const [currentFillBlanksIndex, setCurrentFillBlanksIndex] = useState(0)

  const handleIntroComplete = () => {
    // Mark vocabulary intro as completed
    if (handleActivityComplete) {
      handleActivityComplete('vocabulary_intro', {
        activityOrder: 2,
        score: 1,
        maxScore: 1,
        attempts: 1,
        completed: true
      })
    }
    setVocabStep('matching')
  }

  const handleMatchingComplete = (result?: any) => {
    // Mark vocabulary matching as completed
    if (handleActivityComplete && result) {
      handleActivityComplete('vocabulary_matching_drag', result)
    } else if (handleActivityComplete) {
      handleActivityComplete('vocabulary_matching_drag', {
        activityOrder: 3 + currentMatchingIndex, // Support multiple matching activities
        score: 1,
        maxScore: 1,
        attempts: 1,
        completed: true
      })
    }

    // Check if there are more matching exercises
    // matching can be array of arrays (multiple exercises) or flat array (single exercise)
    const matchingExercises = Array.isArray(data.exercises?.matching?.[0]) 
      ? data.exercises.matching 
      : data.exercises?.matching?.length > 0 
        ? [data.exercises.matching] 
        : []

    if (currentMatchingIndex < matchingExercises.length - 1) {
      // Move to next matching exercise
      setCurrentMatchingIndex(prev => prev + 1)
    } else {
      // All matching activities completed, move to fill blanks
      setVocabStep('fill_blanks')
      setCurrentFillBlanksIndex(0) // Reset to first fill blanks exercise
    }
  }

  const handleFillBlanksComplete = (result?: any) => {
    console.log('🟡 VocabularyStep: handleFillBlanksComplete called', {
      hasResult: !!result,
      result: result ? {
        activityId: result.activityId,
        activityType: result.activityType,
        activityOrder: result.activityOrder
      } : null,
      currentFillBlanksIndex,
      fillBlanksExercisesCount: data.exercises?.fillBlanks?.length || 0,
      hasHandleActivityComplete: !!handleActivityComplete
    });

    // Mark current fill blanks exercise as completed
    if (handleActivityComplete && result) {
      console.log('📞 VocabularyStep: Calling handleActivityComplete for vocabulary_fill_blanks');
      handleActivityComplete('vocabulary_fill_blanks', result)
      console.log('✅ VocabularyStep: handleActivityComplete returned');
    } else {
      console.warn('⚠️ VocabularyStep: Cannot call handleActivityComplete', {
        hasHandleActivityComplete: !!handleActivityComplete,
        hasResult: !!result
      });
    }

    // Check if there are more fill blanks exercises
    const fillBlanksExercises = data.exercises?.fillBlanks || []
    if (currentFillBlanksIndex < fillBlanksExercises.length - 1) {
      console.log('➡️ VocabularyStep: Moving to next fill blanks exercise', {
        currentIndex: currentFillBlanksIndex,
        nextIndex: currentFillBlanksIndex + 1,
        totalExercises: fillBlanksExercises.length
      });
      // Move to next fill blanks exercise
      setCurrentFillBlanksIndex(prev => prev + 1)
    } else {
      console.log('✅ VocabularyStep: All fill blanks exercises completed - waiting for step advancement');
      // All fill blanks exercises completed
      // handleActivityComplete should handle step advancement automatically
      // But if it doesn't (e.g., no session), ensure we don't get stuck
      // The fallback logic in handleActivityComplete should advance to grammar
    }
    // Don't call onComplete() - handleActivityComplete handles step advancement automatically
  }

  return (
    <div className="space-y-6">
      {vocabStep === 'intro' && (
        <>
          <div>
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 text-center">{t('lessons.vocabularyIntro', 'Vocabulary Introduction')}</h3>
            {data.words && data.words.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.words.map((word: any, index: number) => (
                  <div key={index} className="p-4 border border-neutral-200 rounded-lg text-center">
                    <div className="font-medium text-base md:text-lg">{word.en}</div>
                    <div className="text-neutral-600">{word.th}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-neutral-50 rounded-lg text-center text-neutral-600">
                {t('lessons.noVocabulary', 'No vocabulary items available')}
              </div>
            )}
          </div>

          <div className="flex justify-center pt-4">
            <Button onClick={handleIntroComplete} size="sm">
              {t('common.next', 'Next')}
            </Button>
          </div>
        </>
      )}

      {vocabStep === 'matching' && (
        <>
          {(() => {
            // Support multiple matching exercises: matching can be array of arrays or flat array
            const matchingExercises = Array.isArray(data.exercises?.matching?.[0]) 
              ? data.exercises.matching 
              : data.exercises?.matching?.length > 0 
                ? [data.exercises.matching] 
                : []

            if (matchingExercises.length > 0) {
              const currentExercise = matchingExercises[currentMatchingIndex]
              if (!currentExercise) {
                return (
                  <div className="p-4 bg-neutral-50 rounded-lg text-center text-neutral-600">
                    {t('lessons.noMatchingExercise', 'No matching exercise available')}
                  </div>
                )
              }

              const leftWords = currentExercise.map((w: any) => w.word || '').filter((w: string) => w);
              const rightWords = currentExercise.map((w: any) => w.meaning || '').filter((w: string) => w);
              
              return (
                <div className="space-y-4">
                  {matchingExercises.length > 1 && (
                    <div className="text-sm text-neutral-600 text-center">
                      Matching Exercise {currentMatchingIndex + 1} of {matchingExercises.length}
                    </div>
                  )}
                  <VocabularyMatchingDrag
                    key={currentMatchingIndex}
                    lessonData={{
                      lessonId,
                      activityOrder: 3 + currentMatchingIndex, // Support multiple matching activities
                      leftWords,
                      rightWords,
                      correctPairs: leftWords.map((_: any, index: number) => index)
                    }}
                    onComplete={(result) => {
                      if (result) {
                        handleActivityComplete('vocabulary_matching_drag', result)
                      }
                      handleMatchingComplete(result)
                    }}
                  />
                </div>
              );
            } else if (data.words && data.words.length > 0) {
              // Fallback: use words if no matching exercises
              const leftWords = data.words.map((w: any) => w.en || '').filter((w: string) => w);
              const rightWords = data.words.map((w: any) => w.th || '').filter((w: string) => w);
              
              return (
                <VocabularyMatchingDrag
                  lessonData={{
                    lessonId,
                    activityOrder: 3,
                    leftWords,
                    rightWords,
                    correctPairs: leftWords.map((_: any, index: number) => index)
                  }}
                  onComplete={(result) => {
                    if (result) {
                      handleActivityComplete('vocabulary_matching_drag', result)
                    }
                    handleMatchingComplete(result)
                  }}
                />
              );
            } else {
              return (
                <div className="p-4 bg-neutral-50 rounded-lg text-center text-neutral-600">
                  {t('lessons.noMatchingExercise', 'No matching exercise available')}
                </div>
              );
            }
          })()}
        </>
      )}

      {vocabStep === 'fill_blanks' && (
        <>
          {data.exercises?.fillBlanks && data.exercises.fillBlanks.length > 0 ? (
            (() => {
              const currentExercise = data.exercises.fillBlanks[currentFillBlanksIndex]
              if (!currentExercise) {
                return (
                  <div className="p-4 bg-neutral-50 rounded-lg text-center text-neutral-600">
                    {t('lessons.noFillBlanksExercise', 'No fill-in-the-blanks exercise available')}
                  </div>
                )
              }

              return (
                <VocabularyFillBlanks
                  key={currentFillBlanksIndex}
                  lessonData={{
                    lessonId,
                    activityOrder: currentExercise.activityOrder || (4 + currentFillBlanksIndex), // Use actual activity_order from database, fallback to calculated
                    exerciseNumber: currentFillBlanksIndex + 1, // 1-based index for display
                    text: currentExercise.text,
                    sentence: currentExercise.sentence,
                    blanks: currentExercise.blanks,
                    options: currentExercise.options || [],
                    correct: currentExercise.correct !== undefined ? currentExercise.correct : -1
                  }}
                  onComplete={(result) => {
                    handleFillBlanksComplete(result)
                  }}
                />
              )
            })()
          ) : (
            <div className="p-4 bg-neutral-50 rounded-lg text-center text-neutral-600">
              {t('lessons.noFillBlanksExercise', 'No fill-in-the-blanks exercise available')}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function GrammarStep({ data, currentActivity, onComplete, isCompleted, lessonId, handleActivityComplete, isTransitioning = false }: any) {
  const { t } = useTranslation()
  const [showSentences, setShowSentences] = useState(false)

  // Show explanation first, then sentences after clicking Next
  const hasExplanation = data.explanation || data.examples?.length
  const hasSentences = data.sentences && data.sentences.length > 0

  // In activity-based system, show the current grammar activity
  const isCurrentActivityGrammar = currentActivity?.activityType === 'grammar_sentences' ||
                                   currentActivity?.activityType === 'grammar_explanation'

  // Use current activity's order and data if it's a grammar activity
  const currentGrammarActivity = isCurrentActivityGrammar
    ? {
        activityOrder: currentActivity.activityOrder,
        sentences: currentActivity.data?.grammar_sentences || data.sentences,
        activityType: currentActivity.activityType
      }
    : null

  // If grammar step is already completed, skip explanation and show sentences (or nothing)
  useEffect(() => {
    if (isCompleted && hasSentences) {
      // Grammar is completed, show sentences (which will be empty/disabled)
      setShowSentences(true)
    } else if (!hasExplanation && hasSentences) {
      // No explanation, show sentences immediately
      setShowSentences(true)
    }
  }, [isCompleted, hasExplanation, hasSentences])

  const handleExplanationNext = () => {
    // Mark grammar explanation as completed
    if (handleActivityComplete) {
      const activityOrder = currentActivity?.activityOrder || 6 // Default to 6 for explanation
      handleActivityComplete('grammar_explanation', {
        activityId: `grammar-explanation-${activityOrder}`,
        activityOrder: activityOrder,
        score: 1,
        maxScore: 1,
        attempts: 1,
        answers: {},
        feedback: {}
      })
      // handleActivityComplete will advance to the next activity automatically
    }
  }

  // In activity-based system, show different content based on current activity
  if (isCurrentActivityGrammar && currentActivity.activityType === 'grammar_explanation') {
    // Show explanation for grammar_explanation activity
    return (
      <div className="space-y-6">
        <Card>
          <Card.Header>
            <h3 className="text-xl font-semibold">Grammar Rules</h3>
          </Card.Header>
          <Card.Body>
            {data.explanation && (
              <div className="mb-4">
                <h4 className="font-semibold text-base md:text-lg mb-2">Rules:</h4>
                <div className="whitespace-pre-line text-neutral-700">
                  {data.explanation}
                </div>
              </div>
            )}
            {data.examples && data.examples.length > 0 && (
              <div>
                <h4 className="font-semibold text-base md:text-lg mb-2">Examples:</h4>
                <ul className="list-disc list-inside space-y-1 text-neutral-700">
                  {data.examples.map((example: string, index: number) => (
                    <li key={index}>{example}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card.Body>
        </Card>

        <div className="flex justify-center">
          <Button onClick={() => {
            if (handleActivityComplete) {
              handleActivityComplete('grammar_explanation', {
                activityId: `grammar-explanation-${currentActivity.activityOrder}`,
                score: 1,
                maxScore: 1,
                attempts: 1,
                answers: {},
                feedback: {}
              })
            }
          }} size="sm">
            {t('common.next', 'Next')}
          </Button>
        </div>
      </div>
    )
  }

  // If grammar is completed but we're viewing it (e.g., user navigated back or refreshing),
  // still show the explanation so they can review it
  // Only show the "completed" message if there's no explanation to show
  if (isCompleted && !hasExplanation && !hasSentences) {
    return (
      <div className="p-4 bg-neutral-50 rounded-lg text-center text-neutral-600">
        {t('lessons.grammarCompleted', 'Grammar activities are already completed.')}
      </div>
    )
  }

  if (!showSentences && hasExplanation && !isCurrentActivityGrammar) {
    // Show grammar explanation first
    return (
      <div className="space-y-6">
        <Card>
          <Card.Header>
            <h3 className="text-xl font-semibold">Grammar Rules</h3>
          </Card.Header>
          <Card.Body>
            {data.explanation && (
              <div className="mb-4">
                <h4 className="font-semibold text-base md:text-lg mb-2">Rules:</h4>
                <div className="whitespace-pre-line text-neutral-700">
                  {data.explanation}
                </div>
              </div>
            )}
            {data.examples && data.examples.length > 0 && (
              <div>
                <h4 className="font-semibold text-base md:text-lg mb-2">Examples:</h4>
                <ul className="list-disc list-inside space-y-1 text-neutral-700">
                  {data.examples.map((example: string, index: number) => (
                    <li key={index}>{example}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card.Body>
        </Card>

        <div className="flex justify-center">
          <Button onClick={handleExplanationNext} size="sm">
            {t('common.next', 'Next')}
          </Button>
        </div>
      </div>
    )
  }

  // Show grammar drag sentence activity after explanation
  return (
    <div className="space-y-6">
      {hasSentences && currentGrammarActivity && currentGrammarActivity.activityType === 'grammar_sentences' && (
        <GrammarDragSentence
            key={currentGrammarActivity.activityOrder} // Force remount per grammar activity (match vocab fresh mount)
            lessonData={{
              lessonId,
              activityOrder: currentGrammarActivity.activityOrder,
              sentences: currentGrammarActivity.sentences
            }}
            onComplete={(result) => {
              console.log('🟡 GrammarStep: onComplete called from GrammarDragSentence', {
                hasResult: !!result,
                result: result ? {
                  activityId: result.activityId,
                  activityType: result.activityType,
                  activityOrder: result.activityOrder
                } : null,
                hasHandleActivityComplete: !!handleActivityComplete
              });

              if (result && handleActivityComplete) {
                console.log('📞 GrammarStep: Calling handleActivityComplete for', result.activityType);
                // handleActivityComplete already handles step advancement, don't call onComplete
                handleActivityComplete(result.activityType, result)
                console.log('✅ GrammarStep: handleActivityComplete returned');
              } else {
                console.warn('⚠️ GrammarStep: Cannot call handleActivityComplete', {
                  hasResult: !!result,
                  hasHandleActivityComplete: !!handleActivityComplete
                });
              }
              // Don't call onComplete here - handleActivityComplete handles step advancement
            }}
          />
      )}
    </div>
  )
}

function SpeakingStep({ data, currentActivity, onComplete, isCompleted, lessonId, handleActivityComplete, isTransitioning = false }: any) {
  const { t } = useTranslation()

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/33428b2c-5290-424a-9264-2f0b67af3763', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'SpeakingStep render',
      message: 'SpeakingStep component rendering',
      data: {
        isTransitioning,
        currentActivityType: currentActivity?.activityType,
        currentActivityOrder: currentActivity?.activityOrder,
        dataExists: !!data,
        dataKeys: data ? Object.keys(data) : null,
        promptsLength: data?.prompts?.length || 0,
        hasFeedbackCriteria: !!data?.feedbackCriteria
      },
      timestamp: Date.now(),
      sessionId: 'debug-ui-transition',
      runId: 'grammar-to-speaking',
      hypothesisId: 'speaking-step-rendering'
    })
  }).catch(() => {});
  // #endregion

  return (
    <div className="space-y-6">
      <SpeakingWithFeedback
        lessonData={{
          lessonId,
          activityOrder: currentActivity?.activityOrder || 4,
          prompts: data.prompts || [],
          feedbackCriteria: data.feedbackCriteria
        }}
        onComplete={(result) => {
          if (result && handleActivityComplete) {
            // Use the DB activity type as-is (speaking_practice or speaking_with_feedback)
            const activityType = currentActivity?.activityType || 'speaking_practice'
            const activityOrder = result.activityOrder || currentActivity?.activityOrder || 4
            handleActivityComplete(activityType, {
              ...result,
              activityType,
              activityOrder
            })
          }
          // Don't call onComplete here - handleActivityComplete handles step advancement
        }}
      />
    </div>
  )
}

function ImprovementStep({ data, currentActivity, onComplete, isCompleted, lessonId, handleActivityComplete, isTransitioning = false }: any) {
  const { t } = useTranslation()

  // Check if this is a speaking improvement activity
  if (data?.type === 'speaking_improvement') {
    return (
      <div className="space-y-6">
        <SpeakingImprovement
          lessonData={{
            lessonId,
            activityOrder: currentActivity?.activityOrder || data.activityOrder || 6,
            prompt: data.prompt,
            improvedText: data.improvedText || data.targetText,
            similarityThreshold: data.similarityThreshold
          }}
          onComplete={(result) => {
            if (result && handleActivityComplete) {
              // handleActivityComplete already handles step advancement, don't call onComplete
              handleActivityComplete('speaking_improvement', result)
            }
            // Don't call onComplete here - handleActivityComplete handles step advancement
          }}
        />
      </div>
    )
  }

  // Default to reading improvement
  return (
    <div className="space-y-6">
      <ReadingImprovement
        lessonData={{
          lessonId,
          activityOrder: 5,
          targetText: data.targetText,
          similarityThreshold: data.similarityThreshold
        }}
        onComplete={onComplete}
      />
    </div>
  )
}

export default function LessonPage() {
  return (
    <ProtectedRoute>
      <LessonContent />
    </ProtectedRoute>
  )
}

// Force dynamic rendering for this page
export const runtime = 'edge'
