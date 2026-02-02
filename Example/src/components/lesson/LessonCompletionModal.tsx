import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { Card, Button, Mascot, ProgressBar } from '../ui';
import StarRating from '../ui/StarRating';
import { useApi } from '@/hooks/useApi';
import { useNotification } from '@/contexts/NotificationContext';
import { lessonProgressStorage } from '@/services/LessonProgressStorage';
import { backgroundSaveQueue } from '@/services/BackgroundSaveQueue';
import { useAuth } from '@/contexts/AuthContext';

interface LessonResult {
  activityType: string;
  score: number;
  maxScore: number;
  timeSpent: number;
  attempts: number;
  completed: boolean;
}

interface LessonCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  lessonTitle: string;
  level: string;
  totalScore: number;
  maxScore: number;
  results: LessonResult[];
  timeSpent: number;
  onContinue: () => void;
  onRetry: () => void;
}

const LessonCompletionModal: React.FC<LessonCompletionModalProps> = ({
  isOpen,
  onClose,
  lessonId,
  lessonTitle,
  level,
  totalScore,
  maxScore,
  results,
  timeSpent,
  onContinue,
  onRetry
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { makeAuthenticatedRequest } = useApi();
  const { showNotification } = useNotification();
  const { user } = useAuth();
  const [showCelebration, setShowCelebration] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const isPassed = percentage >= 60; // 60% passing threshold

  // Finalize lesson (calculate scores from existing activity results and clear localStorage)
  const handleSubmitResults = async () => {
    if (!user?.id) {
      showNotification('User not authenticated', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Flush background queue to ensure all activities are saved
      await backgroundSaveQueue.flushImmediate();

      // 2. Call finalize-lesson endpoint (calculates from existing lesson_activity_results)
      const response = await makeAuthenticatedRequest('/.netlify/functions/finalize-lesson', {
        method: 'POST',
        body: JSON.stringify({ lessonId })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 3. Clear localStorage only after successful finalization
          lessonProgressStorage.clearProgress(user.id, lessonId);

          showNotification(
            `Lesson completed! You earned ${result.data.starsEarned} star${result.data.starsEarned !== 1 ? 's' : ''}!`,
            'success'
          );
        } else {
          throw new Error(result.error || 'Finalization failed');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to finalize lesson: ${response.status}`);
      }
    } catch (error) {
      console.error('Error finalizing lesson:', error);
      showNotification(
        error instanceof Error ? error.message : 'Failed to save lesson progress',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mascot emotion based on performance
  const getMascotEmotion = () => {
    if (percentage >= 90) return 'celebrating';
    if (percentage >= 70) return 'excited';
    if (percentage >= 60) return 'happy';
    return 'thinking';
  };

  // Mascot message based on performance
  const getMascotMessage = () => {
    if (percentage >= 90) return t('lesson.completion.excellent', 'Excellent work! You\'re a star!');
    if (percentage >= 80) return t('lesson.completion.great', 'Great job! Keep it up!');
    if (percentage >= 70) return t('lesson.completion.good', 'Good work! You\'re doing well!');
    if (percentage >= 60) return t('lesson.completion.passed', 'Well done! You passed the lesson!');
    return t('lesson.completion.keepTrying', 'Keep practicing! You\'ll get there!');
  };

  // Star rating (1-5 stars based on percentage)
  const starRating = Math.ceil((percentage / 100) * 5);

  useEffect(() => {
    if (isOpen) {
      // Automatically finalize lesson when modal opens (lesson is complete)
      const finalizeLesson = async () => {
        if (!user?.id) return;

        try {
          // 1. Flush background queue to ensure all activities are saved
          await backgroundSaveQueue.flushImmediate();

          // 2. Call finalize-lesson endpoint (calculates from existing lesson_activity_results)
          const response = await makeAuthenticatedRequest('/.netlify/functions/finalize-lesson', {
            method: 'POST',
            body: JSON.stringify({ lessonId })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              // 3. Clear localStorage only after successful finalization
              lessonProgressStorage.clearProgress(user.id, lessonId);
              console.log('Lesson automatically finalized when modal opened');
            } else {
              console.error('Finalization failed:', result.error);
            }
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Failed to finalize lesson:', errorData.error);
          }
        } catch (error) {
          console.error('Error auto-finalizing lesson:', error);
          // Don't show error to user - they can still manually finalize with Continue button
        }
      };

      finalizeLesson();

      // Trigger celebration animation after modal opens
      setTimeout(() => setShowCelebration(true), 500);
    } else {
      setShowCelebration(false);
    }
  }, [isOpen, user?.id, lessonId, makeAuthenticatedRequest]);

  const formatTime = (seconds: number) => {
    // Ensure we're working with seconds (not milliseconds)
    // If the value is suspiciously large (> 3600 seconds = 1 hour), it might be in milliseconds
    // Convert to seconds if it looks like milliseconds (e.g., > 3600000)
    let secs = Math.floor(seconds);
    if (secs > 3600000) {
      // Likely in milliseconds, convert to seconds
      secs = Math.floor(secs / 1000);
    }
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            {...({
              className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4",
              onClick: () => {
                onClose();
                router.push('/dashboard');
              }
            } as any)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Modal */}
            <motion.div
              {...({
                className: "bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto",
                onClick: (e: React.MouseEvent) => e.stopPropagation()
              } as any)}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header with Mascot */}
              <div className="relative bg-gradient-to-r from-primary-500 to-secondary-500 p-4 md:p-6 rounded-t-2xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-4 mb-3 md:mb-0">
                    <Mascot
                      size="lg"
                      emotion={getMascotEmotion()}
                      speechText={getMascotMessage()}
                      className="flex-shrink-0 self-center md:self-auto"
                    />
                    <div className="text-white min-w-0 flex-1 text-center md:text-left">
                      <h2 className="text-lg md:text-2xl font-bold truncate">
                        {t('lesson.completion.title', 'Lesson Complete!')}
                      </h2>
                      <p className="text-primary-100 text-xs md:text-sm truncate">
                        {lessonTitle} • {level}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      router.push('/dashboard');
                    }}
                    className="text-white hover:text-primary-200 transition-colors absolute top-4 right-4 md:relative md:top-0 md:right-0"
                  >
                    ✕
                  </button>
                </div>

                {/* Celebration effects */}
                <AnimatePresence>
                  {showCelebration && (
                    <motion.div
                      {...({ className: "absolute inset-0 pointer-events-none" } as any)}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                    >
                      {/* Confetti effect */}
                      {Array.from({ length: 20 }).map((_, i) => (
                        <motion.div
                          key={i}
                          {...({ className: "absolute w-2 h-2 bg-yellow-400 rounded-full" } as any)}
                          initial={{
                            x: Math.random() * 100 + '%',
                            y: '100%',
                            rotate: 0,
                            opacity: 0
                          }}
                          animate={{
                            y: '-100%',
                            rotate: 360,
                            opacity: [0, 1, 1, 0]
                          }}
                          transition={{
                            duration: 3,
                            delay: Math.random() * 2,
                            repeat: Infinity,
                            repeatDelay: 1
                          }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Overall Score */}
                <Card className="text-center">
                  <Card.Body>
                    <div className="text-2xl md:text-4xl font-bold text-primary-600 mb-2">
                      {percentage}%
                    </div>
                    <ProgressBar
                      progress={percentage}
                      color={isPassed ? 'success' : 'primary'}
                      className="mb-4"
                    />
                    <div className="text-sm md:text-lg text-gray-600 mb-2 break-words">
                      {totalScore} / {maxScore} {t('lesson.completion.points', 'points')}
                    </div>

                    {/* Star Rating */}
                    <div className="flex justify-center mb-2">
                      <StarRating rating={starRating} maxRating={5} size="lg" />
                    </div>
                    <div className="text-sm text-gray-500">
                      {starRating} {t('lesson.completion.stars', 'stars')}
                    </div>
                  </Card.Body>
                </Card>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                  <div className="text-center p-2 md:p-3 bg-blue-50 rounded-lg">
                    <div className="text-xl md:text-2xl font-bold text-blue-600">
                      {results.filter(r => r.completed).length}
                    </div>
                    <div className="text-xs md:text-sm text-blue-700 break-words">
                      {t('lesson.completion.activitiesCompleted', 'Activities Done')}
                    </div>
                  </div>

                  <div className="text-center p-2 md:p-3 bg-green-50 rounded-lg">
                    <div className="text-xl md:text-2xl font-bold text-green-600 break-words">
                      {formatTime(timeSpent)}
                    </div>
                    <div className="text-xs md:text-sm text-green-700 break-words">
                      {t('lesson.completion.timeSpent', 'Time Spent')}
                    </div>
                  </div>

                  <div className="text-center p-2 md:p-3 bg-purple-50 rounded-lg">
                    <div className="text-xl md:text-2xl font-bold text-purple-600">
                      {results.reduce((sum, r) => sum + r.attempts, 0)}
                    </div>
                    <div className="text-xs md:text-sm text-purple-700 break-words">
                      {t('lesson.completion.totalAttempts', 'Total Attempts')}
                    </div>
                  </div>

                  <div className="text-center p-2 md:p-3 bg-orange-50 rounded-lg">
                    <div className="text-xl md:text-2xl font-bold text-orange-600">
                      {results.filter(r => r.score === r.maxScore).length}
                    </div>
                    <div className="text-xs md:text-sm text-orange-700 break-words">
                      {t('lesson.completion.perfectScores', 'Perfect Scores')}
                    </div>
                  </div>
                </div>

                {/* Activity Breakdown */}
                <Card>
                  <Card.Header>
                    <h3 className="text-base md:text-lg font-semibold">
                      {t('lesson.completion.activityBreakdown', 'Activity Breakdown')}
                    </h3>
                  </Card.Header>
                  <Card.Body>
                    <div className="space-y-2 md:space-y-3">
                      {results.map((result, index) => (
                        <motion.div
                          key={index}
                          {...({ className: "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 p-2 md:p-3 bg-gray-50 rounded-lg" } as any)}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div className="flex items-center space-x-2 md:space-x-3 min-w-0 flex-1">
                            <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full flex-shrink-0 ${
                              result.score === result.maxScore ? 'bg-green-500' :
                              result.score > 0 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm md:text-base truncate">
                                {t(`lesson.activity.${result.activityType}`, result.activityType)}
                              </div>
                              <div className="text-xs md:text-sm text-gray-500 break-words">
                                {formatTime(result.timeSpent)} • {result.attempts} {t('lesson.attempts', 'attempts')}
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0 ml-auto sm:ml-0">
                            <div className="font-bold text-sm md:text-base">
                              {result.score}/{result.maxScore}
                            </div>
                            <div className="text-xs md:text-sm text-gray-500">
                              {result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0}%
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </Card.Body>
                </Card>

                {/* Performance Message */}
                <Card className={`border-2 ${
                  isPassed ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
                }`}>
                  <Card.Body>
                    <div>
                      <h4 className={`font-semibold text-sm md:text-base ${isPassed ? 'text-green-800' : 'text-orange-800'}`}>
                        {isPassed
                          ? t('lesson.completion.passed', 'Lesson Passed!')
                          : t('lesson.completion.keepPracticing', 'Keep Practicing!')
                        }
                      </h4>
                      <p className={`text-xs md:text-sm break-words ${isPassed ? 'text-green-700' : 'text-orange-700'}`}>
                        {isPassed
                          ? t('lesson.completion.passedMessage', 'Great work! You\'ve successfully completed this lesson. Ready for the next challenge?')
                          : t('lesson.completion.practiceMessage', 'You\'re making progress! Try again or continue practicing to improve your score.')
                        }
                      </p>
                    </div>
                  </Card.Body>
                </Card>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={async () => {
                      try {
                        await handleSubmitResults();
                      } catch (error) {
                        console.error('Error finalizing lesson:', error);
                        // Continue anyway - lesson is already auto-finalized when modal opens
                      }
                      onContinue();
                      router.push('/dashboard');
                    }}
                    disabled={isSubmitting}
                    className="flex-1"
                    size="lg"
                  >
                    {isSubmitting
                      ? t('lesson.completion.saving', 'Saving Progress...')
                      : t('lesson.completion.continue', 'Continue to Next Lesson')
                    }
                  </Button>

                  {!isPassed && (
                  <Button
                    onClick={onRetry}
                    variant="secondary"
                    className="flex-1"
                    size="lg"
                  >
                    {t('lesson.completion.retry', 'Try Again')}
                  </Button>
                )}

                <Button
                  onClick={() => {
                    onClose();
                    router.push('/dashboard');
                  }}
                  variant="secondary"
                  className="flex-1"
                  size="lg"
                >
                  {t('lesson.completion.close', 'Close')}
                </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LessonCompletionModal;
