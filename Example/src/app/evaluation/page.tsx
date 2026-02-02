'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ProtectedRoute, useUser } from '@/components/auth/ProtectedRoute'
import { Button, Card, Mascot, ProgressBar } from '@/components/ui'
import Modal from '@/components/ui/Modal'
import MascotThinking from '@/components/ui/MascotThinking'
import { useNotification } from '@/contexts/NotificationContext'
import { useApi } from '@/hooks/useApi'
import VocabularyTest from '@/components/evaluation/VocabularyTest'
import GrammarTest from '@/components/evaluation/GrammarTest'
import SpeakingTest from '@/components/evaluation/SpeakingTest'
import { CEFR_MAPPING, calculateCEFRLevel, calculateLevelFromScores } from '@/lib/evaluationConfig'

interface EvaluationTest {
  id: string;
  test_name: string;
  test_type: string;
  description: string;
  passing_score: number;
  allowed_time: number;
  questions: Array<{
    id: string;
    question_type: string;
    prompt: string;
    content?: any;
    correct_answer?: string;
    points: number;
  }>;
}

type EvaluationStep = 'intro' | 'test' | 'results'

function EvaluationContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const { user } = useUser()
  const { showNotification } = useNotification()
  const { makeAuthenticatedRequest } = useApi()

  // Check if this is speaking-only mode
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const isSpeakingOnly = searchParams.get('mode') === 'speaking'
  const testId = 'EVAL-1' // Single evaluation test

  const [currentStep, setCurrentStep] = useState<EvaluationStep>(isSpeakingOnly ? 'test' : 'intro')
  const [evaluationTest, setEvaluationTest] = useState<EvaluationTest | null>(null)
  const [evaluationResults, setEvaluationResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [submissionSuccess, setSubmissionSuccess] = useState(false)
  const hasSubmittedRef = useRef(false)

  // Local storage key for student progress
  const getProgressStorageKey = () => `evaluation-progress-${user?.id}-${testId}`

  // Load progress from localStorage
  const loadProgressFromStorage = useCallback(() => {
    if (typeof window === 'undefined' || !user?.id) return null

    try {
      const savedData = localStorage.getItem(getProgressStorageKey())
      if (savedData) {
        const parsed = JSON.parse(savedData)
        // Check if data is still valid (not older than 24 hours)
        const savedAt = new Date(parsed.savedAt)
        const now = new Date()
        const hoursDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60)

        if (hoursDiff < 24) {
          return parsed
        } else {
          // Remove expired data
          localStorage.removeItem(getProgressStorageKey())
        }
      }
    } catch (error) {
      console.warn('Failed to load evaluation progress from localStorage:', error)
      localStorage.removeItem(getProgressStorageKey())
    }
    return null
  }, [user?.id, testId, getProgressStorageKey])

  // Save progress to localStorage
  const saveProgressToStorage = useCallback((data: any) => {
    if (typeof window === 'undefined' || !user?.id) return

    try {
      const dataToSave = {
        ...data,
        savedAt: new Date().toISOString(),
        userId: user.id,
        testId
      }
      localStorage.setItem(getProgressStorageKey(), JSON.stringify(dataToSave))
    } catch (error) {
      console.warn('Failed to save evaluation progress to localStorage:', error)
    }
  }, [user?.id, testId, getProgressStorageKey])

  // Load evaluation test from database
  const loadEvaluationTest = useCallback(async () => {
    if (!testId) {
      setError('No test ID provided')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await makeAuthenticatedRequest(`/.netlify/functions/get-evaluation-test?test_id=${testId}`)

      if (response.ok) {
        const result = await response.json()
        setEvaluationTest(result.data)
      } else {
        throw new Error('Failed to load test')
      }
    } catch (error) {
      console.error('Error loading evaluation test:', error)
      setError(error instanceof Error ? error.message : 'Failed to load test')
      showNotification('Failed to load evaluation test', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [testId, makeAuthenticatedRequest, showNotification])

  // Check if user has already completed evaluation test and redirect to dashboard
  useEffect(() => {
    if (user) {
      const userLevel = user.level
      const hasEvalResult = user.evalTestResult || user.eval_test_result
      
      // If user already has a level and eval test result, redirect to dashboard
      if (userLevel && userLevel.trim() !== '' && userLevel !== 'Not Assessed' && hasEvalResult) {
        console.log('User has already completed evaluation test, redirecting to dashboard', { 
          userLevel, 
          hasEvalResult,
          evalTestResult: user.evalTestResult,
          eval_test_result: user.eval_test_result
        })
        showNotification(t('evaluation.alreadyCompleted', 'You have already completed the evaluation test.'), 'info')
        router.push('/dashboard')
        return
      }
    }
  }, [user, router, showNotification, t])

  useEffect(() => {
    loadEvaluationTest()
  }, [loadEvaluationTest])

  // Submit evaluation results to server
  const submitEvaluationResults = useCallback(async (results: any, finalLevel: string) => {
    if (isSubmitting) return // Prevent double submission

    try {
      setIsSubmitting(true)
      setSubmissionError(null)

      // Transform results to match backend format
      const submissionData = {
        results: {
          evaluation: {
            score: results.score,
            maxScore: results.maxScore,
            percentage: results.percentage,
            timeSpent: results.timeSpent,
            answers: results.answers
          }
        },
        calculatedLevel: finalLevel,
        completedAt: new Date().toISOString()
      }

      const response = await makeAuthenticatedRequest('/.netlify/functions/submit-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit evaluation' }))
        throw new Error(errorData.error || 'Failed to submit evaluation')
      }

      const result = await response.json()
      
      if (result.success) {
        // Clear localStorage progress
        if (typeof window !== 'undefined' && user?.id) {
          localStorage.removeItem(getProgressStorageKey())
        }
        
        // Mark submission as successful - don't redirect automatically
        setSubmissionSuccess(true)
        console.log('✅ Evaluation results submitted successfully')
      } else {
        throw new Error(result.error || 'Failed to submit evaluation')
      }
    } catch (error: any) {
      console.error('Error submitting evaluation:', error)
      setSubmissionError(error.message || 'Failed to submit evaluation. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [isSubmitting, makeAuthenticatedRequest, user?.id, getProgressStorageKey])

  // Submit evaluation results when results screen is shown (only once)
  useEffect(() => {
    if (currentStep === 'results' && evaluationResults && !isSubmitting && !submissionError && !hasSubmittedRef.current) {
      // Calculate level from test percentage
      const calculatedLevel = calculateCEFRLevel(evaluationResults.percentage)
      
      // Collect AI-assessed speaking percentages from speaking feedback
      const aiSpeakingPercentages: number[] = []
      if (evaluationResults.answers) {
        Object.values(evaluationResults.answers).forEach((answer: any) => {
          if (answer.feedback?.overall_score !== undefined) {
            aiSpeakingPercentages.push(answer.feedback.overall_score)
          }
          if (answer.result?.feedback?.overall_score !== undefined) {
            aiSpeakingPercentages.push(answer.result.feedback.overall_score)
          }
        })
      }

      // Calculate average speaking percentage if multiple speaking questions
      let averageSpeakingPercentage = 0
      if (aiSpeakingPercentages.length > 0) {
        const sum = aiSpeakingPercentages.reduce((acc, score) => acc + score, 0)
        averageSpeakingPercentage = sum / aiSpeakingPercentages.length
      }

      // Calculate final level using 50/50 weighted formula
      const grammarTestPercentage = evaluationResults.percentage
      const finalLevel = calculateLevelFromScores(averageSpeakingPercentage, grammarTestPercentage)
      
      hasSubmittedRef.current = true
      submitEvaluationResults(evaluationResults, finalLevel)
    }
  }, [currentStep, evaluationResults, isSubmitting, submissionError, submitEvaluationResults])

  const handleStartEvaluation = () => {
    setCurrentStep('test')
  }


  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <Mascot size="lg" emotion="thinking" className="mx-auto mb-4" />
          <p className="text-xl text-neutral-600">{t('evaluation.loading', 'Loading evaluation...')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex items-center justify-center">
        <div className="container mx-auto px-4 text-center">
          <Card className="max-w-md mx-auto">
            <Card.Body>
              <div className="text-red-600 mb-4">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h2 className="text-xl font-semibold mb-2">Error Loading Test</h2>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={() => router.push('/dashboard')}>
                  Back to Dashboard
                </Button>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    )
  }

  // Intro screen - test selection
  if (currentStep === 'intro' && !isSpeakingOnly) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-8">
        <div className="container mx-auto px-4">
          <motion.div
            {...({ className: "text-center mb-8" } as any)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Mascot
              size="xl"
              emotion="excited"
              speechText={t('evaluation.welcome', 'Let\'s find your English level!')}
              className="mx-auto mb-6"
            />

            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
              {t('evaluation.title', 'English Level Evaluation')}
            </h1>

            <p className="text-xl text-neutral-600 mb-8 max-w-2xl mx-auto">
              {t('evaluation.description', 'This evaluation will assess your English skills across vocabulary, grammar, and speaking to determine your CEFR level (Pre-A1 to C2).')}
            </p>
          </motion.div>

          {/* Evaluation Description */}
          <Card className="mb-8">
            <Card.Body className="text-center py-8">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-2xl font-bold mb-4">{t('evaluation.title', 'English Level Evaluation')}</h3>
              <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
                {t('evaluation.description', 'This comprehensive evaluation will assess your English skills across vocabulary, grammar, and speaking to determine your CEFR level.')}
              </p>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm max-w-lg mx-auto">
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <div className="font-semibold text-blue-600 text-lg mb-1">📚 {t('evaluation.vocabulary', 'Vocabulary')}</div>
                  <div className="text-blue-500">{t('evaluation.vocabularyDesc', 'Word knowledge & matching')}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg text-center">
                  <div className="font-semibold text-green-600 text-lg mb-1">📝 {t('evaluation.grammar', 'Grammar')}</div>
                  <div className="text-green-500">{t('evaluation.grammarDesc', 'Sentence structure & rules')}</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <div className="font-semibold text-purple-600 text-lg mb-1">🎤 {t('evaluation.speaking', 'Speaking')}</div>
                  <div className="text-purple-500">{t('evaluation.speakingDesc', 'Oral communication skills')}</div>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* CEFR Level Overview */}
          <Card className="mb-8">
            <Card.Header>
              <h3 className="text-xl font-semibold text-center">{t('evaluation.cefrLevels', 'CEFR English Levels')}</h3>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
                {CEFR_MAPPING.map((cefr, index) => {
                  const descriptions = {
                    'Pre-A1': t('evaluation.preA1', 'Very basic English'),
                    'A1': t('evaluation.a1', 'Basic phrases'),
                    'A2': t('evaluation.a2', 'Simple conversations'),
                    'B1': t('evaluation.b1', 'Independent user'),
                    'B2': t('evaluation.b2', 'Fluent conversations'),
                    'C1': t('evaluation.c1', 'Complex texts'),
                    'C2': t('evaluation.c2', 'Near-native fluency')
                  };
                  return (
                    <div key={cefr.level} className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="font-bold text-lg text-primary-600">{cefr.level}</div>
                      <div className="text-xs text-neutral-600">{descriptions[cefr.level as keyof typeof descriptions]}</div>
                    </div>
                  );
                })}
              </div>
            </Card.Body>
          </Card>

          {/* Start Button */}
          <div className="text-center">
            <Button onClick={handleStartEvaluation} size="lg" className="px-8">
              {t('evaluation.start', 'Start Evaluation')}
            </Button>
            <p className="text-sm text-neutral-500 mt-4">
              {t('evaluation.duration', 'Estimated time: 20-30 minutes')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Results screen
  if (currentStep === 'results' && evaluationResults) {
    // Calculate level from test percentage
    const calculatedLevel = calculateCEFRLevel(evaluationResults.percentage)
    
    // Collect AI-assessed speaking percentages from speaking feedback
    const aiSpeakingPercentages: number[] = []
    if (evaluationResults.answers) {
      Object.values(evaluationResults.answers).forEach((answer: any) => {
        // Check if this is a speaking answer with AI feedback
        if (answer.feedback?.overall_score !== undefined) {
          aiSpeakingPercentages.push(answer.feedback.overall_score)
        }
        // Also check if feedback is nested in result object
        if (answer.result?.feedback?.overall_score !== undefined) {
          aiSpeakingPercentages.push(answer.result.feedback.overall_score)
        }
      })
    }

    // Calculate average speaking percentage if multiple speaking questions
    let averageSpeakingPercentage = 0
    if (aiSpeakingPercentages.length > 0) {
      const sum = aiSpeakingPercentages.reduce((acc, score) => acc + score, 0)
      averageSpeakingPercentage = sum / aiSpeakingPercentages.length
    }

    // Calculate final level using 50/50 weighted formula
    const grammarTestPercentage = evaluationResults.percentage
    const finalLevel = calculateLevelFromScores(averageSpeakingPercentage, grammarTestPercentage)

    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-8">
        <div className="container mx-auto px-4">
          <motion.div
            {...({ className: "text-center mb-8" } as any)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Mascot
              size="xl"
              emotion="celebrating"
              speechText={t('evaluation.congratulations', 'Congratulations on completing your evaluation!')}
              className="mx-auto mb-6"
            />

            <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
              {t('evaluation.results.title', 'Your English Level')}
            </h1>
          </motion.div>

          {/* Level Result */}
          <Card className="mb-8">
            <Card.Body className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold text-primary-600 mb-2">
                {t('evaluation.level', 'Level')} {finalLevel}
              </h2>
              <p className="text-xl text-neutral-600">
                {t(`evaluation.levels.${finalLevel}.description`, 'You have achieved this level!')}
              </p>
            </Card.Body>
          </Card>

          {/* Test Results */}
          <Card className="mb-8">
            <Card.Header>
              <h3 className="text-xl font-semibold text-center">
                {evaluationTest?.test_name || 'Evaluation Test'}
              </h3>
            </Card.Header>
            <Card.Body>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary-600 mb-2">
                  {evaluationResults.score}/{evaluationResults.maxScore}
                </div>
                <ProgressBar
                  progress={evaluationResults.percentage}
                  color="primary"
                />
                <div className="text-lg text-neutral-600 mt-2">
                  {evaluationResults.percentage}% correct
                </div>
                <div className="text-sm text-neutral-500 mt-2">
                  Time spent: {Math.round(evaluationResults.timeSpent / 60)} minutes
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Next Steps */}
          <Card className="mb-8">
            <Card.Header>
              <h3 className="text-xl font-semibold">{t('evaluation.nextSteps', 'Your Next Steps')}</h3>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{t('evaluation.nextSteps.lesson', 'Start with level-appropriate lessons')}</h4>
                    <p className="text-sm text-neutral-600">
                      {t('evaluation.nextSteps.lessonDesc', 'We\'ll recommend lessons that match your current level.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-secondary-100 rounded-full flex items-center justify-center">
                    <span className="text-secondary-600 font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{t('evaluation.nextSteps.progress', 'Track your progress')}</h4>
                    <p className="text-sm text-neutral-600">
                      {t('evaluation.nextSteps.progressDesc', 'Regular practice will help you advance to the next level.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-accent-100 rounded-full flex items-center justify-center">
                    <span className="text-accent-600 font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{t('evaluation.nextSteps.retake', 'Retake evaluation')}</h4>
                    <p className="text-sm text-neutral-600">
                      {t('evaluation.nextSteps.retakeDesc', 'You can retake this evaluation after 30 days to check your progress.')}
                    </p>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Submission Status */}
          {isSubmitting && (
            <Card className="mb-8">
              <Card.Body className="text-center py-6">
                <div className="flex items-center justify-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                  <p className="text-lg text-neutral-600">
                    {t('evaluation.submitting', 'Submitting your results...')}
                  </p>
                </div>
              </Card.Body>
            </Card>
          )}

          {submissionError && (
            <Card className="mb-8 border-red-200 bg-red-50">
              <Card.Body className="text-center py-6">
                <p className="text-lg text-red-600 mb-4">
                  {t('evaluation.submissionError', 'Error submitting results')}: {submissionError}
                </p>
                <Button 
                  onClick={() => {
                    setSubmissionError(null)
                    // Retry submission
                    if (evaluationResults) {
                      const aiSpeakingPercentages: number[] = []
                      if (evaluationResults.answers) {
                        Object.values(evaluationResults.answers).forEach((answer: any) => {
                          if (answer.feedback?.overall_score !== undefined) {
                            aiSpeakingPercentages.push(answer.feedback.overall_score)
                          }
                          if (answer.result?.feedback?.overall_score !== undefined) {
                            aiSpeakingPercentages.push(answer.result.feedback.overall_score)
                          }
                        })
                      }

                      // Calculate average speaking percentage
                      let averageSpeakingPercentage = 0
                      if (aiSpeakingPercentages.length > 0) {
                        const sum = aiSpeakingPercentages.reduce((acc, score) => acc + score, 0)
                        averageSpeakingPercentage = sum / aiSpeakingPercentages.length
                      }

                      // Calculate final level using 50/50 weighted formula
                      const grammarTestPercentage = evaluationResults.percentage
                      const finalLevel = calculateLevelFromScores(averageSpeakingPercentage, grammarTestPercentage)
                      hasSubmittedRef.current = false
                      submitEvaluationResults(evaluationResults, finalLevel)
                    }
                  }}
                  variant="primary"
                  size="lg"
                >
                  {t('evaluation.retry', 'Retry')}
                </Button>
              </Card.Body>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="text-center space-x-4">
            {submissionSuccess ? (
              <Button 
                onClick={() => {
                  // Force a page reload to refresh user context
                  window.location.href = '/dashboard'
                }} 
                size="lg"
                className="px-8"
              >
                {t('evaluation.continueToDashboard', 'Continue to Dashboard')}
              </Button>
            ) : (
              <>
                {!isSubmitting && !submissionError && (
                  <p className="text-sm text-neutral-500 mb-4">
                    {t('evaluation.submittingResults', 'Submitting your results...')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Test rendering
  if (currentStep === 'test' && evaluationTest) {
    return (
      <EvaluationTestRenderer
        testData={evaluationTest}
        onComplete={(results) => {
          setEvaluationResults(results)
          setCurrentStep('results')
          // Clear localStorage progress when evaluation is completed
          if (typeof window !== 'undefined' && user?.id) {
            localStorage.removeItem(getProgressStorageKey())
          }
        }}
        onCancel={() => router.push('/dashboard')}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header with progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">
              {t('evaluation.title', 'English Level Evaluation')}
            </h1>
            <Button onClick={() => router.push('/dashboard')} variant="secondary">
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="text-center mt-8">
            <div className="inline-flex items-center space-x-2 text-primary-600">
              <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
              <span>{t('evaluation.loading', 'Loading evaluation...')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Speaking Question Component for evaluation test (single question, not multiple prompts like SpeakingTest)
function SpeakingQuestion({ question, onComplete, disabled, savedAnswer }: {
  question: any;
  onComplete: (results: { answer: string; score: number; maxScore: number; feedback: any; transcript: string }) => void;
  disabled: boolean;
  savedAnswer?: any;
}) {
  const { t } = useTranslation();
  const { makeAuthenticatedRequest } = useApi();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);
  const [currentStep, setCurrentStep] = useState<'idle' | 'transcribing' | 'analyzing' | 'feedback'>('idle');
  const [transcript, setTranscript] = useState<string>(savedAnswer?.transcript || '');
  const [feedback, setFeedback] = useState<any>(savedAnswer?.feedback || null);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check microphone permission
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (navigator.permissions) {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (permissionStatus.state === 'granted') {
            setHasMicPermission(true);
          }
        }
      } catch (err) {
        console.log('Could not check microphone permission:', err);
      }
    };
    checkPermission();
  }, []);

  // Request microphone permission
  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasMicPermission(true);
      setError(null);
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      const error = err as Error;
      if (error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access and try again.');
      } else {
        setError(`Microphone access failed: ${error.message}`);
      }
    }
  };

  // Get supported audio format (platform-specific)
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
      // Fallback for iOS if detection fails
      return 'audio/mp4';
    }

    // Android/Desktop: Prioritize WebM/Opus (better quality)
    const preferredTypes = [
      'audio/webm;codecs=opus',      // Best quality for speech
      'audio/webm',                   // WebM fallback
      'audio/mp4;codecs=mp4a.40.2',  // MP4 AAC fallback
      'audio/mp4'                     // Generic MP4 last resort
    ];
    const supportedType = preferredTypes.find(type => MediaRecorder.isTypeSupported(type));
    if (supportedType) {
      console.log(`✅ Non-iOS: Using audio format: ${supportedType}`);
      return supportedType;
    }
    // Fallback
    return 'audio/webm';
  };

  // Convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Start recording
  const startRecording = async () => {
    if (isRecording || disabled) return;

    try {
      // Platform-specific audio constraints
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      const audioConstraints = isIOSDevice
        ? { audio: { echoCancellation: true } } // iOS: minimal constraints
        : { audio: true }; // Others: default constraints

      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedMimeType();
      
      // Platform-specific MediaRecorder options
      const recorderOptions = isIOSDevice
        ? { mimeType } // iOS: no audioBitsPerSecond (not supported)
        : { mimeType }; // Others: default options

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);
        await handleRecordingComplete(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at 60 seconds
          if (newTime >= 60 && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('⏰ Auto-stopping recording after 1 minute');
            mediaRecorderRef.current.stop();
            if (recordingIntervalRef.current) {
              clearInterval(recordingIntervalRef.current);
              recordingIntervalRef.current = null;
            }
            return 60; // Cap at 60 seconds
          }
          return newTime;
        });
      }, 1000);

      // Auto-stop after 1 minute (60 seconds) - backup timeout
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('⏰ Auto-stopping recording after 1 minute (timeout)');
          mediaRecorderRef.current.stop();
        }
      }, 60000);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please try again.');
    }
  };

  // Stop recording - Show confirmation modal first
  const stopRecording = () => {
    setShowStopConfirmation(true);
  };

  // Confirm stop recording - Actually stop the recording
  const confirmStopRecording = () => {
    setShowStopConfirmation(false);
    
    // Immediately disable button and show gray state
    setIsStopping(true);
    
    if (!isRecording || !mediaRecorderRef.current) {
      setIsStopping(false);
      return;
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsProcessing(true);
    setCurrentStep('transcribing');
  };

  // Handle recording complete
  const handleRecordingComplete = async (audioBlob: Blob) => {
    if (!audioBlob || audioBlob.size < 1000) {
      setError('Audio recording is invalid. Please record again.');
      setIsProcessing(false);
      return;
    }

    setCurrentStep('transcribing');
    setError(null);

    try {
      const base64Audio = await blobToBase64(audioBlob);

      // Call single API: ai-feedback (which handles both transcription and feedback)
      setCurrentStep('transcribing');
      
      const feedbackResponse = await fetch('/.netlify/functions/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_blob: base64Audio,
          audio_mime_type: audioBlob.type || 'audio/webm',
          prompt: question.prompt,
          criteria: {
            grammar: true,
            vocabulary: true,
            pronunciation: true,
            topic_validation: true
          }
        })
      });

      const feedbackResult = await feedbackResponse.json();

      if (!feedbackResult.success) {
        throw new Error(feedbackResult.error || 'Analysis failed');
      }

      // Extract transcript from response
      const transcriptText = feedbackResult.transcript || '';
      setTranscript(transcriptText);
      
      // Show analyzing state briefly before showing feedback
      setCurrentStep('analyzing');
      
      // Small delay to show analyzing state
      await new Promise(resolve => setTimeout(resolve, 500));

      const feedbackData = {
        overall_score: feedbackResult.overall_score,
        feedback: feedbackResult.feedback,
        grammar_corrections: feedbackResult.grammar_corrections || [],
        vocabulary_corrections: feedbackResult.vocabulary_corrections || [],
        assessed_level: feedbackResult.assessed_level || 'A1'
      };

      setFeedback(feedbackData);
      setCurrentStep('feedback');
      setIsProcessing(false);

      // Don't call onComplete here - wait for user to click "Continue" button
    } catch (err: any) {
      console.error('Error processing recording:', err);
      setError(err.message || 'Failed to process recording. Please try again.');
      setCurrentStep('idle');
      setIsProcessing(false);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (!hasMicPermission) {
    return (
      <div className="space-y-6">
        <h3 className="text-xl font-semibold text-center mb-6">
          {question.prompt}
        </h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800 text-center">
            💡 <strong>{t('evaluation.tip', 'Tip')}:</strong> {t('evaluation.speakLonger', 'Speak longer for more accurate results. The more you say, the better we can assess your level.')}
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-orange-800 text-center">
            ⚠️ {t('evaluation.noReRecordWarning', 'Note that when you press stop, you cannot rerecord, your speech will be immediately sent for evaluation.')}
          </p>
        </div>
        <div className="text-center">
          <Button onClick={requestMicPermission} size="lg">
            Allow Microphone Access
          </Button>
          {error && <p className="text-red-500 mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-center mb-6">
        {question.prompt}
      </h3>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-yellow-800 text-center">
          💡 <strong>{t('evaluation.tip', 'Tip')}:</strong> {t('evaluation.speakLonger', 'Speak longer for more accurate results. The more you say, the better we can assess your level.')}
        </p>
      </div>
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-orange-800 text-center">
          ⚠️ {t('evaluation.noReRecordWarning', 'Note that when you press stop, you cannot rerecord, your speech will be immediately sent for evaluation.')}
        </p>
      </div>

      {/* Processing states */}
      {(currentStep === 'transcribing' || currentStep === 'analyzing') && (
        <div className="flex flex-col items-center justify-center py-12">
          <MascotThinking 
            size="md"
            speechText={currentStep === 'transcribing' 
              ? 'Transcribing your speech...'
              : 'Analyzing your Meow meow'}
            alwaysShowSpeech={true}
          />
        </div>
      )}

      {/* Feedback display */}
      {currentStep === 'feedback' && feedback && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 mb-2">🤖 AI Feedback:</h4>
            <p className="text-gray-700 mb-4">{feedback.feedback}</p>
            
            {feedback.grammar_corrections && feedback.grammar_corrections.length > 0 && (
              <div className="mt-4">
                <h5 className="font-semibold text-green-800 mb-2">Grammar Corrections:</h5>
                {feedback.grammar_corrections.map((correction: any, index: number) => (
                  <p key={index} className="text-gray-700 mb-1">
                    <span className="line-through text-red-600">{correction.mistake}</span> → <span className="text-green-600">{correction.correction}</span>
                  </p>
                ))}
              </div>
            )}
            
            {feedback.vocabulary_corrections && feedback.vocabulary_corrections.length > 0 && (
              <div className="mt-4">
                <h5 className="font-semibold text-green-800 mb-2">Vocabulary Suggestions:</h5>
                {feedback.vocabulary_corrections.map((correction: any, index: number) => (
                  <p key={index} className="text-gray-700 mb-1">
                    <span className="line-through text-red-600">{correction.mistake}</span> → <span className="text-green-600">{correction.correction}</span>
                  </p>
                ))}
              </div>
            )}
            
            {feedback.assessed_level && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Assessed Level:</strong> {feedback.assessed_level}
                </p>
              </div>
            )}
          </div>
          
          <div className="text-center">
            <Button
              onClick={() => {
                // Call onComplete when user clicks Continue
                const isCorrect = feedback.overall_score >= 50; // 50% threshold
                onComplete({
                  answer: transcript,
                  score: isCorrect ? question.points : Math.round((feedback.overall_score / 100) * question.points),
                  maxScore: question.points,
                  feedback: feedback,
                  transcript: transcript
                });
              }}
              size="lg"
              className="px-8"
            >
              {t('evaluation.continue', 'Continue')}
            </Button>
          </div>
        </div>
      )}

      {/* Recording controls */}
      {!isProcessing && currentStep !== 'transcribing' && currentStep !== 'analyzing' && !feedback && (
        <div className="text-center">
          {!isRecording ? (
            <div className="flex flex-col items-center gap-4">
              <img 
                src="/mic-start.png" 
                alt="Start Recording" 
                className="w-16 h-16 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={disabled ? undefined : startRecording}
                style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                onError={(e) => {
                  console.error('Failed to load mic-start.png');
                  e.currentTarget.style.display = 'none';
                }}
              />
              <p className="text-sm text-gray-600">{t('evaluation.clickToStartRecording', 'Click to start recording')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                <p className={`text-lg font-semibold ${recordingTime >= 55 ? 'text-red-600' : ''}`}>
                  Recording: {formatTime(recordingTime)}
                  {recordingTime >= 55 && recordingTime < 60 && (
                    <span className="ml-2 text-sm">(Auto-stopping soon...)</span>
                  )}
                </p>
                {recordingTime >= 60 && (
                  <p className="text-sm text-red-600 font-medium">Recording stopped automatically (1 minute limit)</p>
                )}
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
                <p className="text-sm text-gray-600">Click to stop recording (max 1 minute)</p>
              </div>
            </div>
          )}
          {error && <p className="text-red-500 mt-4">{error}</p>}
        </div>
      )}
      
      {/* Stop Recording Confirmation Modal */}
      <Modal
        isOpen={showStopConfirmation}
        onClose={() => setShowStopConfirmation(false)}
        title={t('evaluation.speaking.stopRecordingTitle', 'Stop Recording?')}
        size="sm"
      >
        <div className="text-center">
          <p className="text-gray-600 mb-6">
            {t('evaluation.speaking.stopRecordingConfirm', 'Are you sure you want to stop recording?')}
          </p>
          <div className="flex justify-center space-x-4">
            <Button
              onClick={() => setShowStopConfirmation(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800"
            >
              {t('common.no', 'No')}
            </Button>
            <Button
              onClick={confirmStopRecording}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {t('common.yes', 'Yes')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Component to render evaluation questions like lesson activities
function EvaluationTestRenderer({ testData, onComplete, onCancel }: {
  testData: EvaluationTest;
  onComplete: (results: any) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation()
  const { user } = useUser()
  const { showNotification } = useNotification()

  const getProgressStorageKey = () => `evaluation-progress-${user?.id}-${testData.id}`

  // Load progress from localStorage on component mount (without side effects)
  const loadSavedProgress = useCallback(() => {
    if (typeof window === 'undefined' || !user?.id) return null

    try {
      const savedData = localStorage.getItem(getProgressStorageKey())
      if (savedData) {
        const parsed = JSON.parse(savedData)
        // Check if data is still valid (not older than 24 hours)
        const savedAt = new Date(parsed.savedAt)
        const now = new Date()
        const hoursDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60)

        if (hoursDiff < 24) {
          return parsed
        } else {
          // Remove expired data
          localStorage.removeItem(getProgressStorageKey())
        }
      }
    } catch (error) {
      console.warn('Failed to load evaluation progress:', error)
      localStorage.removeItem(getProgressStorageKey())
    }
    return null
  }, [user?.id, testData.id, getProgressStorageKey])

  // Save progress to localStorage
  const saveProgress = useCallback((progressData: any) => {
    if (typeof window === 'undefined' || !user?.id) return

    try {
      const dataToSave = {
        ...progressData,
        savedAt: new Date().toISOString(),
        userId: user.id,
        testId: testData.id
      }
      localStorage.setItem(getProgressStorageKey(), JSON.stringify(dataToSave))
    } catch (error) {
      console.warn('Failed to save evaluation progress:', error)
    }
  }, [user?.id, testData.id, getProgressStorageKey])

  // Initialize state from localStorage or defaults
  const savedProgress = loadSavedProgress()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(savedProgress?.currentQuestionIndex || 0)
  const [answers, setAnswers] = useState<Record<string, any>>(savedProgress?.answers || {})
  const [completedQuestions, setCompletedQuestions] = useState<Set<string>>(new Set(savedProgress?.completedQuestions || []))
  const [questionStartTimes, setQuestionStartTimes] = useState<Record<string, number>>(savedProgress?.questionStartTimes || {})
  const [partialAnswers, setPartialAnswers] = useState<Record<string, any>>(savedProgress?.partialAnswers || {})
  const [startTime] = useState(savedProgress?.startTime || Date.now())
  
  // Use ref to store answers synchronously (for immediate access in handleFinishTest)
  // This ensures answers are available immediately even if React state hasn't updated yet
  const answersRef = useRef<Record<string, any>>(savedProgress?.answers || {})
  
  // Initialize ref from state on mount (only once)
  useEffect(() => {
    if (Object.keys(answersRef.current).length === 0 && Object.keys(answers).length > 0) {
      answersRef.current = answers
    }
  }, []) // Only run on mount


  // Track question start time when question changes
  useEffect(() => {
    if (testData && testData.questions[currentQuestionIndex] && !questionStartTimes[testData.questions[currentQuestionIndex].id]) {
      const question = testData.questions[currentQuestionIndex]
      setQuestionStartTimes(prev => ({
        ...prev,
        [question.id]: Date.now()
      }))
    }
  }, [currentQuestionIndex, testData, questionStartTimes])

  // Auto-save ALL progress data whenever anything changes
  useEffect(() => {
    const progressData = {
      currentQuestionIndex,
      answers: { ...answers }, // Deep copy to ensure all data is captured
      partialAnswers: { ...partialAnswers }, // Include any partial/unsubmitted answers
      completedQuestions: Array.from(completedQuestions),
      questionStartTimes: { ...questionStartTimes },
      startTime,
      lastActivity: Date.now() // Track when user was last active
    }
    saveProgress(progressData)
  }, [currentQuestionIndex, answers, partialAnswers, completedQuestions, questionStartTimes, startTime, saveProgress])

  const currentQuestion = testData.questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === testData.questions.length - 1

  // Handle partial answer updates (for real-time saving)
  const handlePartialAnswerUpdate = useCallback((questionId: string, partialAnswer: any) => {
    setPartialAnswers(prev => ({ ...prev, [questionId]: partialAnswer }))
  }, [])

  const handleFinishTest = useCallback(() => {
    // Calculate final results
    const timeSpent = Math.round((Date.now() - startTime) / 1000)
    let totalScore = 0
    let totalMaxScore = 0

    // Use ref for immediate access (synchronous) - includes latest answers even if state hasn't updated
    const currentAnswers = answersRef.current
    console.log('🎯 Calculating final test results:', { 
      answersFromState: answers, 
      answersFromRef: currentAnswers,
      questions: testData.questions.length 
    })

    testData.questions.forEach(question => {
      // Check both ref (most up-to-date) and state, prefer ref
      const answer = currentAnswers[question.id] || answers[question.id]
      console.log(`📝 Question ${question.id} (${question.question_type}):`, answer)
      
      if (answer && typeof answer === 'object' && answer.score !== undefined) {
        // Answer is an object with score/maxScore
        totalScore += answer.score
        totalMaxScore += answer.maxScore || question.points
        console.log(`  ✓ Score: ${answer.score}/${answer.maxScore || question.points}`)
      } else if (typeof answer === 'string' && answer.startsWith('drag_match_')) {
        // Parse drag_match string: "drag_match_score_maxScore"
        const parts = answer.split('_')
        if (parts.length >= 4) {
          const score = parseInt(parts[2]) || 0
          const maxScore = parseInt(parts[3]) || question.points
          totalScore += score
          totalMaxScore += maxScore
          console.log(`  ✓ Drag match parsed: ${score}/${maxScore} from "${answer}"`)
        } else {
          console.warn(`  ⚠ Invalid drag_match format: "${answer}"`)
          totalMaxScore += question.points
        }
      } else if (answer) {
        // Simple correct/incorrect - check if answer matches correct_answer
        const isCorrect = answer === question.correct_answer
        if (isCorrect) {
          totalScore += question.points
          totalMaxScore += question.points
          console.log(`  ✓ Correct answer: ${answer}`)
        } else {
          totalMaxScore += question.points
          console.log(`  ✗ Incorrect answer: ${answer} (expected: ${question.correct_answer})`)
        }
      } else {
        totalMaxScore += question.points
        console.log(`  ⚠ No answer provided`)
      }
    })

    const percentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0

    onComplete({
      score: totalScore,
      maxScore: totalMaxScore,
      percentage,
      timeSpent,
      answers: currentAnswers, // Use ref version which has latest answers
      testId: testData.id
    })
  }, [answers, startTime, testData, onComplete])

  const handleQuestionComplete = useCallback((questionId: string, result: any) => {
    // Calculate time spent on this question
    const questionStartTime = questionStartTimes[questionId]
    const timeSpent = questionStartTime ? Date.now() - questionStartTime : 0

    // Include timing data in the result
    const completeResult = {
      ...result,
      timeSpent,
      completedAt: Date.now()
    }

    // Update ref IMMEDIATELY (synchronous) so handleFinishTest can access it
    answersRef.current = { ...answersRef.current, [questionId]: completeResult }
    
    // Also update state (for React re-renders)
    setAnswers(prev => ({ ...prev, [questionId]: completeResult }))
    setCompletedQuestions(prev => new Set(prev).add(questionId))

    // Clear partial answer for this question since it's now complete
    setPartialAnswers(prev => {
      const updated = { ...prev }
      delete updated[questionId]
      return updated
    })

    // Don't auto-advance - let user click Next button manually
    // Auto-finish only when last question is completed
    if (isLastQuestion) {
      setTimeout(() => {
        handleFinishTest()
      }, 1500) // Brief pause to show completion
    }
  }, [isLastQuestion, questionStartTimes, handleFinishTest, completedQuestions])

  const renderQuestion = () => {
    if (!currentQuestion) return null

    switch (currentQuestion.question_type) {
      case 'multiple_choice':
      case 'fill_blank':
      case 'drag_match':
        // Use VocabularyTest component
        return (
          <VocabularyTest
            questions={[{
              id: currentQuestion.id,
              type: currentQuestion.question_type === 'multiple_choice' ? 'multiple_choice' :
                    currentQuestion.question_type === 'drag_match' ? 'drag_match' : 'fill_blank',
              prompt: currentQuestion.prompt,
              options: currentQuestion.content?.options || [],
              pairs: currentQuestion.content?.pairs || [],
              correct: currentQuestion.correct_answer || '',
              level: 'evaluation'
            }]}
            onComplete={(results) => {
              // Transform results to match expected format
              const userAnswer = results.answers?.[currentQuestion.id] || ''
              let score = results.score || 0
              let maxScore = results.maxScore || currentQuestion.points
              
              // Handle drag_match format: "drag_match_score_maxScore"
              if (typeof userAnswer === 'string' && userAnswer.startsWith('drag_match_')) {
                const parts = userAnswer.split('_')
                if (parts.length >= 4) {
                  // parts[0] = "drag", parts[1] = "match", parts[2] = score, parts[3] = maxScore
                  score = parseInt(parts[2]) || 0
                  maxScore = parseInt(parts[3]) || currentQuestion.points
                  console.log(`🎯 Parsed drag_match: ${score}/${maxScore} from "${userAnswer}"`)
                }
              } else if (userAnswer === currentQuestion.correct_answer) {
                score = currentQuestion.points
                maxScore = currentQuestion.points
              }
              
              console.log(`📝 Vocabulary question ${currentQuestion.id} completed:`, { userAnswer, score, maxScore, results })
              
              handleQuestionComplete(currentQuestion.id, {
                answer: userAnswer,
                score: score,
                maxScore: maxScore
              })
            }}
          />
        )

      case 'dropdown':
      case 'drag_fill':
        // Use GrammarTest component
        return (
          <GrammarTest
            questions={[{
              id: currentQuestion.id,
              type: currentQuestion.question_type === 'dropdown' ? 'dropdown' :
                    currentQuestion.question_type === 'drag_fill' ? 'drag_fill' : 'fill_blank',
              prompt: currentQuestion.prompt,
              options: currentQuestion.content?.options || [],
              words: currentQuestion.content?.words || [],
              correct: currentQuestion.correct_answer || '',
              level: 'evaluation'
            }]}
            onComplete={(results) => {
              // Transform results to match expected format
              const score = results.score || (results.answers?.[currentQuestion.id] === currentQuestion.correct_answer ? currentQuestion.points : 0)
              handleQuestionComplete(currentQuestion.id, {
                answer: results.answers?.[currentQuestion.id] || '',
                score: score,
                maxScore: currentQuestion.points
              })
            }}
          />
        )

      case 'speaking':
        // Use SpeakingQuestion component for single question (SpeakingTest is for multiple prompts)
        return (
          <SpeakingQuestion
            question={currentQuestion}
            onComplete={(results) => handleQuestionComplete(currentQuestion.id, results)}
            disabled={completedQuestions.has(currentQuestion.id)}
            savedAnswer={answers[currentQuestion.id]}
          />
        )

      default:
        return <div>Unknown question type: {currentQuestion.question_type}</div>
    }
  }

  const progress = ((currentQuestionIndex + 1) / testData.questions.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{testData.test_name}</h1>
            <Button onClick={onCancel} variant="secondary">
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm text-neutral-600 mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <ProgressBar progress={progress} color="primary" />
          </div>

          <div className="text-center">
            <h2 className="text-lg font-semibold">
              Question {currentQuestionIndex + 1} of {testData.questions.length}
            </h2>
          </div>
        </div>

        {/* Question Content */}
        {currentQuestion?.question_type === 'drag_match' ? (
          // For drag_match questions, VocabularyMatchingDrag provides its own Card
          <div className="mb-6">
            {renderQuestion()}
          </div>
        ) : (
          <Card className="mb-6">
            <Card.Body className="min-h-[400px] flex items-center justify-center">
              {renderQuestion()}
            </Card.Body>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-neutral-600">
            {completedQuestions.has(currentQuestion.id) ? '✓ Completed' : 'In Progress'}
          </div>

          {!isLastQuestion && (
            <Button
              onClick={() => setCurrentQuestionIndex((prev: number) => prev + 1)}
              disabled={!completedQuestions.has(currentQuestion.id)}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EvaluationPage() {
  return (
    <ProtectedRoute>
      <EvaluationContent />
    </ProtectedRoute>
  )
}
