/**
 * LessonActivityFlow Service
 * 
 * Manages continuous activity flow within a lesson session.
 * Handles activity progression, state management, and automatic advancement.
 */

import { lessonProgressStorage, type LessonProgressStorage } from './LessonProgressStorage';
import { backgroundSaveQueue, type ActivityResult } from './BackgroundSaveQueue';

export interface Activity {
  id: string;
  activityType: string;
  activityOrder: number;
  title?: string;
  description?: string;
  data: any; // Activity-specific data
  status: 'pending' | 'in_progress' | 'completed';
  result?: {
    score?: number;
    maxScore?: number;
    attempts: number;
    timeSpent?: number;
    answers?: any;
    feedback?: any;
  };
  completedAt?: string;
}

export interface LessonSession {
  lessonId: string;
  userId: string;
  currentActivityIndex: number;
  activities: Activity[];
  startedAt: string;
  lastSavedAt: string;
}

class LessonActivityFlowService {
  /**
   * Create activities directly from database activities array (preserves activity_order)
   */
  createActivitiesFromDatabase(activitiesFromDB: any[]): Activity[] {
    return activitiesFromDB.map((dbActivity: any) => {
      // Map database activity to Activity interface
      const activity: Activity = {
        id: dbActivity.id,
        activityType: dbActivity.activity_type,
        activityOrder: dbActivity.activity_order, // Use actual order from database
        title: dbActivity.title || undefined,
        description: dbActivity.description || undefined,
        data: dbActivity.content || {}, // Activity-specific content
        status: 'pending'
      };

      // Add related data based on activity type
      if (dbActivity.vocabulary_items && Array.isArray(dbActivity.vocabulary_items) && dbActivity.vocabulary_items.length > 0) {
        activity.data.vocabulary_items = dbActivity.vocabulary_items;
      }
      if (dbActivity.grammar_sentences && Array.isArray(dbActivity.grammar_sentences) && dbActivity.grammar_sentences.length > 0) {
        // Transform words_array to words for compatibility with GrammarDragSentence
        activity.data.grammar_sentences = dbActivity.grammar_sentences.map((sentence: any) => ({
          id: sentence.id,
          words: sentence.words_array || [],
          correct: sentence.correct_sentence
        }));
      }

      return activity;
    }).sort((a, b) => a.activityOrder - b.activityOrder); // Ensure sorted by activity_order
  }

  /**
   * Transform lesson data from API (step-based) to activity array
   * This is a fallback method when database activities are not available
   */
  transformLessonDataToActivities(lessonData: any): Activity[] {
    const activities: Activity[] = [];

    // Warm-up speaking
    if (lessonData.steps?.warmup?.prompt) {
      activities.push({
        id: 'warmup',
        activityType: 'warm_up_speaking',
        activityOrder: 1,
        title: 'Warm-up',
        description: 'Speak about the topic',
        data: lessonData.steps.warmup,
        status: 'pending'
      });
    }

    // Vocabulary activities
    if (lessonData.steps?.vocabulary?.words?.length) {
      activities.push({
        id: 'vocabulary-intro',
        activityType: 'vocabulary_intro',
        activityOrder: 2,
        title: 'Vocabulary Introduction',
        description: 'Learn new words',
        data: { words: lessonData.steps.vocabulary.words },
        status: 'pending'
      });
    }

    if (lessonData.steps?.vocabulary?.exercises?.matching?.length) {
      activities.push({
        id: 'vocabulary-matching',
        activityType: 'vocabulary_matching_drag',
        activityOrder: 3,
        title: 'Vocabulary Matching',
        description: 'Match words with meanings',
        data: { exercises: lessonData.steps.vocabulary.exercises },
        status: 'pending'
      });
    }

    // Create separate activity for each fill blanks exercise (support multiple fill blanks)
    if (lessonData.steps?.vocabulary?.exercises?.fillBlanks?.length) {
      lessonData.steps.vocabulary.exercises.fillBlanks.forEach((fillBlanksExercise: any, index: number) => {
        activities.push({
          id: `vocabulary-fill-blanks-${index}`,
          activityType: 'vocabulary_fill_blanks',
          activityOrder: fillBlanksExercise.activityOrder || (4 + index), // Use actual activity_order from database, or calculate
          title: `Fill in the Blanks ${index + 1}`,
          description: 'Complete the sentences',
          data: { exercise: fillBlanksExercise, exerciseIndex: index },
          status: 'pending'
        });
      });
    }

    // Grammar explanation
    if (lessonData.steps?.grammar?.explanation || lessonData.steps?.grammar?.examples?.length) {
      activities.push({
        id: 'grammar-explanation',
        activityType: 'grammar_explanation',
        activityOrder: 5,
        title: 'Grammar Rules',
        description: 'Learn grammar rules',
        data: {
          explanation: lessonData.steps.grammar.explanation,
          examples: lessonData.steps.grammar.examples
        },
        status: 'pending'
      });
    }

    // Grammar sentences
    if (lessonData.steps?.grammar?.sentences?.length) {
      activities.push({
        id: 'grammar-sentences',
        activityType: 'grammar_drag_sentence',
        activityOrder: 6,
        title: 'Build Sentences',
        description: 'Arrange words to form sentences',
        data: { sentences: lessonData.steps.grammar.sentences },
        status: 'pending'
      });
    }

    // Speaking practice
    if (lessonData.steps?.speaking?.prompts?.length) {
      activities.push({
        id: 'speaking-practice',
        activityType: 'speaking_with_feedback',
        activityOrder: 7,
        title: 'Speaking Practice',
        description: 'Practice speaking with AI feedback',
        data: lessonData.steps.speaking,
        status: 'pending'
      });
    }

    // Speaking improvement - always add after speaking practice
    // The improved transcript comes from localStorage (from AI feedback), not database
    if (lessonData.steps?.speaking?.prompts?.length) {
      activities.push({
        id: 'speaking-improvement',
        activityType: 'speaking_improvement',
        activityOrder: 8,
        title: 'Speaking Improvement',
        description: 'Read the improved version',
        data: {
          type: 'speaking_improvement',
          // improvedText will be loaded from localStorage in SpeakingImprovement component
          similarityThreshold: lessonData.steps?.improvement?.similarityThreshold || 70
        },
        status: 'pending'
      });
    }

    // Reading improvement (fallback for language_improvement_reading)
    if (lessonData.steps?.improvement?.targetText && !lessonData.steps?.improvement?.improvedText) {
      activities.push({
        id: 'reading-improvement',
        activityType: 'language_improvement_reading',
        activityOrder: 9,
        title: 'Reading Practice',
        description: 'Read the text aloud',
        data: lessonData.steps.improvement,
        status: 'pending'
      });
    }

    return activities.sort((a, b) => a.activityOrder - b.activityOrder);
  }

  /**
   * Initialize lesson session from lesson data
   */
  initializeSession(
    lessonId: string,
    userId: string,
    lessonData: any,
    savedProgress?: LessonProgressStorage | null
  ): LessonSession {
    const activities = this.transformLessonDataToActivities(lessonData);

    // Restore progress from localStorage if available
    if (savedProgress) {
      console.log('Restoring session from saved progress:', {
        lessonId,
        savedLessonId: savedProgress.lessonId,
        lessonIdMatch: lessonId === savedProgress.lessonId,
        userId,
        savedUserId: savedProgress.userId,
        userIdMatch: userId === savedProgress.userId,
        savedActivitiesCount: savedProgress.activities?.length || 0,
        currentActivitiesCount: activities.length,
        savedActivities: savedProgress.activities?.map(a => ({
          activityType: a.activityType,
          activityOrder: a.activityOrder,
          status: a.status
        })),
        currentActivities: activities.map(a => ({
          activityType: a.activityType,
          activityOrder: a.activityOrder,
          status: a.status
        }))
      });
      
      // Verify lessonId and userId match
      if (lessonId !== savedProgress.lessonId || userId !== savedProgress.userId) {
        console.error('LessonId or userId mismatch! Cannot restore progress.', {
          expected: { lessonId, userId },
          saved: { lessonId: savedProgress.lessonId, userId: savedProgress.userId }
        });
        // Return new session instead of corrupted restore
        return {
          lessonId,
          userId,
          currentActivityIndex: 0,
          activities,
          startedAt: new Date().toISOString(),
          lastSavedAt: new Date().toISOString()
        };
      }

      // Map saved activities to current activities
      activities.forEach((activity, index) => {
        // Try to find saved activity by activityType and activityOrder
        let savedActivity = savedProgress.activities.find(
          a => a.activityType === activity.activityType && a.activityOrder === activity.activityOrder
        );
        
        // If not found by both, try just by activityType (in case activityOrder changed)
        if (!savedActivity) {
          savedActivity = savedProgress.activities.find(
            a => a.activityType === activity.activityType
          );
          if (savedActivity) {
            console.log('Found activity by type only (order mismatch):', {
              saved: { activityType: savedActivity.activityType, activityOrder: savedActivity.activityOrder },
              current: { activityType: activity.activityType, activityOrder: activity.activityOrder }
            });
          }
        }
        
        if (savedActivity && savedActivity.status === 'completed') {
          activity.status = 'completed';
          activity.result = savedActivity.result;
          activity.completedAt = savedActivity.completedAt;
          console.log('Restored activity:', {
            activityType: activity.activityType,
            activityOrder: activity.activityOrder,
            savedActivityOrder: savedActivity.activityOrder,
            status: activity.status
          });
        } else if (savedActivity) {
          console.log('Saved activity found but not completed:', {
            activityType: activity.activityType,
            savedStatus: savedActivity.status
          });
        } else {
          console.log('No saved activity found for:', {
            activityType: activity.activityType,
            activityOrder: activity.activityOrder,
            availableSavedTypes: savedProgress.activities.map(a => a.activityType)
          });
        }
      });

      // Find first incomplete activity
      const firstIncompleteIndex = activities.findIndex(a => a.status === 'pending');
      const currentActivityIndex = firstIncompleteIndex >= 0 ? firstIncompleteIndex : activities.length - 1;

      const completedCount = activities.filter(a => a.status === 'completed').length;
      console.log('Session restored:', {
        totalActivities: activities.length,
        completedActivities: completedCount,
        currentActivityIndex,
        progress: Math.round((completedCount / activities.length) * 100) + '%'
      });

      return {
        lessonId,
        userId,
        currentActivityIndex,
        activities,
        startedAt: savedProgress.startedAt,
        lastSavedAt: savedProgress.lastSavedAt
      };
    }

    // New session - start from first activity
    return {
      lessonId,
      userId,
      currentActivityIndex: 0,
      activities,
      startedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString()
    };
  }

  /**
   * Complete current activity and move to next
   */
  completeActivity(
    session: LessonSession,
    activityIndex: number,
    result: ActivityResult
  ): { updatedSession: LessonSession; isLastActivity: boolean } {
    const updatedActivities = [...session.activities];
    const activity = updatedActivities[activityIndex];

    if (!activity) {
      return { updatedSession: session, isLastActivity: false };
    }

    // Mark activity as completed
    updatedActivities[activityIndex] = {
      ...activity,
      status: 'completed',
      result: {
        score: result.score,
        maxScore: result.maxScore,
        attempts: result.attempts,
        timeSpent: result.timeSpent,
        answers: result.answers,
        feedback: result.feedback
      },
      completedAt: result.completedAt
    };

    // Find next incomplete activity
    const nextIncompleteIndex = updatedActivities.findIndex(
      (a, idx) => idx > activityIndex && a.status === 'pending'
    );

    const isLastActivity = nextIncompleteIndex === -1;
    const nextActivityIndex = isLastActivity ? activityIndex : nextIncompleteIndex;

    const updatedSession: LessonSession = {
      ...session,
      activities: updatedActivities,
      currentActivityIndex: nextActivityIndex,
      lastSavedAt: new Date().toISOString()
    };

    // Save to localStorage
    const progress: LessonProgressStorage = {
      lessonId: session.lessonId,
      userId: session.userId,
      currentActivityIndex: nextActivityIndex,
      activities: updatedActivities.map(a => ({
        activityId: a.id,
        activityOrder: a.activityOrder,
        activityType: a.activityType,
        status: a.status,
        result: a.result,
        completedAt: a.completedAt
      })),
      startedAt: session.startedAt,
      lastSavedAt: updatedSession.lastSavedAt
    };

    console.log('completeActivity saving to localStorage:', {
      lessonId: session.lessonId,
      userId: session.userId,
      activitiesCount: progress.activities.length,
      completedCount: progress.activities.filter(a => a.status === 'completed').length,
      currentActivityIndex: nextActivityIndex,
      activities: progress.activities.map(a => ({
        activityType: a.activityType,
        activityOrder: a.activityOrder,
        status: a.status
      }))
    });
    lessonProgressStorage.saveProgress(session.userId, session.lessonId, progress);

    // Enqueue background save
    backgroundSaveQueue.enqueue(session.lessonId, activity.id, result);

    return { updatedSession, isLastActivity };
  }

  /**
   * Get current activity
   */
  getCurrentActivity(session: LessonSession): Activity | null {
    return session.activities[session.currentActivityIndex] || null;
  }

  /**
   * Get progress percentage
   */
  getProgressPercentage(session: LessonSession): number {
    if (!session.activities.length) return 0;
    const completedCount = session.activities.filter(a => a.status === 'completed').length;
    return Math.round((completedCount / session.activities.length) * 100);
  }

  /**
   * Check if all activities are completed
   */
  areAllActivitiesCompleted(session: LessonSession): boolean {
    return session.activities.every(a => a.status === 'completed');
  }
}

// Export singleton instance
export const lessonActivityFlow = new LessonActivityFlowService();

