/**
 * Testing Helpers for Lesson Flow
 * 
 * Utilities to help test background saving and progress recovery
 */

import { lessonProgressStorage } from '@/services/LessonProgressStorage';
import { backgroundSaveQueue } from '@/services/BackgroundSaveQueue';

/**
 * Test background saving functionality
 * 
 * Usage:
 * 1. Complete an activity
 * 2. Check console logs for save queue status
 * 3. Verify activity appears in localStorage
 * 4. Check network tab for API calls (should be debounced)
 */
export function testBackgroundSaving() {
  console.group('🧪 Testing Background Saving');
  
  // Check localStorage for saved progress
  const testUserId = 'test-user-id';
  const testLessonId = 'A1-L1';
  const savedProgress = lessonProgressStorage.loadProgress(testUserId, testLessonId);
  
  console.log('📦 LocalStorage Progress:', savedProgress);
  console.log('📊 Save Queue Status:', {
    queueLength: backgroundSaveQueue.getQueueSize(),
    isProcessing: backgroundSaveQueue.isQueueProcessing()
  });
  
  // Monitor save queue
  const checkInterval = setInterval(() => {
    const queueLength = backgroundSaveQueue.getQueueSize();
    if (queueLength === 0) {
      console.log('✅ Save queue is empty - all saves completed');
      clearInterval(checkInterval);
    } else {
      console.log(`⏳ Save queue has ${queueLength} items pending...`);
    }
  }, 500);
  
  // Clear after 10 seconds
  setTimeout(() => {
    clearInterval(checkInterval);
    console.log('⏱️ Test timeout - check network tab for API calls');
  }, 10000);
  
  console.groupEnd();
  
  return {
    savedProgress,
    queueLength: backgroundSaveQueue.getQueueSize(),
    isProcessing: backgroundSaveQueue.isQueueProcessing()
  };
}

/**
 * Test progress recovery functionality
 * 
 * Usage:
 * 1. Complete some activities
 * 2. Refresh the page
 * 3. Check console logs for recovery process
 * 4. Verify activities are restored correctly
 */
export function testProgressRecovery(userId: string, lessonId: string) {
  console.group('🧪 Testing Progress Recovery');
  
  // Step 1: Check localStorage
  console.log('Step 1: Checking localStorage...');
  const localStorageProgress = lessonProgressStorage.loadProgress(userId, lessonId);
  
  if (localStorageProgress) {
    console.log('✅ Found progress in localStorage:', {
      activities: localStorageProgress.activities?.length || 0,
      currentActivityIndex: localStorageProgress.currentActivityIndex,
      startedAt: localStorageProgress.startedAt,
      lastSavedAt: localStorageProgress.lastSavedAt,
      isExpired: false // Progress doesn't expire in current implementation
    });
  } else {
    console.log('❌ No progress found in localStorage');
  }
  
  // Step 2: Check if expired (progress doesn't expire in current implementation)
  // Note: Progress is cleared only on final submission, not by expiration
  
  // Step 3: Simulate database fallback (would need API call)
  console.log('Step 2: Database fallback would be checked here');
  console.log('💡 To test: Check network tab for get-lesson API call with userId');
  
  console.groupEnd();
  
  return {
    localStorageProgress,
    shouldFallbackToDB: !localStorageProgress // Progress doesn't expire in current implementation
  };
}

/**
 * Clear all test data
 */
export function clearTestData(userId: string, lessonId: string) {
  console.log('🧹 Clearing test data...');
  lessonProgressStorage.clearProgress(userId, lessonId);
  console.log('✅ Test data cleared');
}

/**
 * Log current lesson state for debugging
 */
export function logLessonState(
  userId: string | undefined,
  lessonId: string | null,
  currentStep: string,
  stepProgress: Record<string, boolean>,
  activityResults: any[]
) {
  if (!userId || !lessonId) {
    console.log('⚠️ Cannot log lesson state - missing userId or lessonId');
    return;
  }
  
  console.group('📊 Current Lesson State');
  console.log('User ID:', userId);
  console.log('Lesson ID:', lessonId);
  console.log('Current Step:', currentStep);
  console.log('Step Progress:', stepProgress);
  console.log('Activity Results:', activityResults);
  
  const savedProgress = lessonProgressStorage.loadProgress(userId, lessonId);
  console.log('Saved Progress:', savedProgress);
  
  console.log('Save Queue:', {
    length: backgroundSaveQueue.getQueueSize(),
    isProcessing: backgroundSaveQueue.isQueueProcessing()
  });
  
  console.groupEnd();
}

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).testBackgroundSaving = testBackgroundSaving;
  (window as any).testProgressRecovery = testProgressRecovery;
  (window as any).clearTestData = clearTestData;
  (window as any).logLessonState = logLessonState;
  
  console.log('🧪 Testing helpers available:');
  console.log('  - testBackgroundSaving()');
  console.log('  - testProgressRecovery(userId, lessonId)');
  console.log('  - clearTestData(userId, lessonId)');
  console.log('  - logLessonState(userId, lessonId, currentStep, stepProgress, activityResults)');
}

