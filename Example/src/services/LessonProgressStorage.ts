/**
 * LessonProgressStorage Service
 * 
 * Manages lesson progress in localStorage with automatic expiration.
 * Progress is stored per user and lesson, and cleared only on final submission.
 */

export interface LessonProgressStorage {
  lessonId: string;
  userId: string;
  currentActivityIndex: number;
  activities: Array<{
    activityId: string;
    activityOrder: number;
    activityType: string;
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
  }>;
  startedAt: string;
  lastSavedAt: string;
}

class LessonProgressStorageService {
  private readonly EXPIRATION_DAYS = 7;
  private readonly STORAGE_PREFIX = 'lesson-progress';

  /**
   * Get storage key for a specific user and lesson
   */
  private getStorageKey(userId: string, lessonId: string): string {
    return `${this.STORAGE_PREFIX}-${userId}-${lessonId}`;
  }

  /**
   * Save progress to localStorage
   * Called on every activity completion
   */
  saveProgress(userId: string, lessonId: string, progress: LessonProgressStorage): void {
    if (typeof window === 'undefined') return;

    try {
      const key = this.getStorageKey(userId, lessonId);
      const dataToSave: LessonProgressStorage = {
        ...progress,
        userId,
        lessonId,
        lastSavedAt: new Date().toISOString()
      };
      console.log('Saving to localStorage:', {
        key,
        userId,
        lessonId,
        activitiesCount: progress.activities?.length || 0,
        currentActivityIndex: progress.currentActivityIndex
      });
      localStorage.setItem(key, JSON.stringify(dataToSave));
      console.log('Successfully saved to localStorage with key:', key);
    } catch (error) {
      console.error('Failed to save progress to localStorage:', error);
      // Handle quota exceeded error
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing old progress');
        this.clearOldProgress();
      }
    }
  }

  /**
   * Load progress from localStorage
   * Returns null if not found or expired
   */
  loadProgress(userId: string, lessonId: string): LessonProgressStorage | null {
    if (typeof window === 'undefined') return null;

    try {
      const key = this.getStorageKey(userId, lessonId);
      console.log('Loading from localStorage:', {
        key,
        userId,
        lessonId,
        allKeys: Object.keys(localStorage).filter(k => k.startsWith('lesson-progress-'))
      });
      const data = localStorage.getItem(key);
      
      if (!data) {
        console.log('No data found in localStorage for key:', key);
        return null;
      }

      const parsed: LessonProgressStorage = JSON.parse(data);
      console.log('Loaded from localStorage:', {
        key,
        activitiesCount: parsed.activities?.length || 0,
        currentActivityIndex: parsed.currentActivityIndex,
        lastSavedAt: parsed.lastSavedAt
      });
      
      // Check if data is still valid (not older than expiration days)
      const savedAt = new Date(parsed.lastSavedAt);
      const now = new Date();
      const daysDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > this.EXPIRATION_DAYS) {
        console.log('Progress expired, removing:', key, 'daysDiff:', daysDiff);
        localStorage.removeItem(key);
        return null;
      }
      
      if (daysDiff < this.EXPIRATION_DAYS) {
        return parsed;
      } else {
        // Remove expired data
        this.clearProgress(userId, lessonId);
        return null;
      }
    } catch (error) {
      console.error('Failed to load progress from localStorage:', error);
      // Clear corrupted data
      this.clearProgress(userId, lessonId);
      return null;
    }
  }

  /**
   * Clear progress for a specific lesson
   * Called only on final submission
   * Preserves completion flag so lesson shows as completed on return
   */
  clearProgress(userId: string, lessonId: string): void {
    if (typeof window === 'undefined') return;

    try {
      const key = this.getStorageKey(userId, lessonId);
      const completionKey = this.getCompletionKey(userId, lessonId);
      
      // Store completion flag before clearing progress
      localStorage.setItem(completionKey, 'true');
      
      // Clear progress storage
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear progress from localStorage:', error);
    }
  }

  /**
   * Get completion key for a lesson
   */
  private getCompletionKey(userId: string, lessonId: string): string {
    return `lesson-completed-${userId}-${lessonId}`;
  }

  /**
   * Check if a lesson is completed (from localStorage)
   */
  isCompleted(userId: string, lessonId: string): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const completionKey = this.getCompletionKey(userId, lessonId);
      return localStorage.getItem(completionKey) === 'true';
    } catch (error) {
      console.error('Failed to check completion status:', error);
      return false;
    }
  }

  /**
   * Clear all old progress (helper for quota management)
   */
  private clearOldProgress(): void {
    if (typeof window === 'undefined') return;

    try {
      const keysToRemove: string[] = [];
      const now = Date.now();
      const expirationMs = this.EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed: LessonProgressStorage = JSON.parse(data);
              const savedAt = new Date(parsed.lastSavedAt).getTime();
              if (now - savedAt > expirationMs) {
                keysToRemove.push(key);
              }
            }
          } catch (e) {
            // Remove corrupted entries
            if (key) keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Failed to clear old progress:', error);
    }
  }

  /**
   * Check if progress exists for a lesson
   */
  hasProgress(userId: string, lessonId: string): boolean {
    if (typeof window === 'undefined') return false;
    const key = this.getStorageKey(userId, lessonId);
    return localStorage.getItem(key) !== null;
  }
}

// Export singleton instance
export const lessonProgressStorage = new LessonProgressStorageService();

