/**
 * BackgroundSaveQueue Service
 * 
 * Manages non-blocking background saves of activity results with debouncing.
 * Saves are batched and retried on failure.
 */

export interface ActivityResult {
  activityId?: string;
  activityType: string;
  activityOrder: number;
  score?: number;
  maxScore?: number;
  attempts: number;
  timeSpent?: number;
  completedAt: string;
  answers?: any;
  feedback?: any;
}

interface QueuedItem {
  lessonId: string;
  activityId?: string;
  result: ActivityResult;
  retryCount: number;
}

class BackgroundSaveQueue {
  private queue: QueuedItem[] = [];
  private isProcessing = false;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 500; // Wait 500ms before flushing
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000; // 1 second between retries

  /**
   * Add activity result to queue for background saving
   */
  enqueue(lessonId: string, activityId: string | undefined, result: ActivityResult): void {
    this.queue.push({
      lessonId,
      activityId,
      result,
      retryCount: 0
    });
    this.scheduleSave();
  }

  /**
   * Schedule save with debounce
   * Waits for additional items before flushing
   */
  private scheduleSave(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.DEBOUNCE_MS);
  }

  /**
   * Flush queue and save all results
   * Non-blocking: doesn't wait for completion
   */
  private async flush(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const itemsToSave = [...this.queue];
    this.queue = [];

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    try {
      // Save all items in parallel
      console.log(`🔄 BackgroundSaveQueue: Saving ${itemsToSave.length} activity results...`);
      await Promise.all(
        itemsToSave.map(item => this.saveActivityResult(item))
      );
      console.log(`✅ BackgroundSaveQueue: Successfully saved ${itemsToSave.length} activity results`);
    } catch (error) {
      console.error('Failed to save activity results:', error);
      // Re-queue failed items for retry
      itemsToSave.forEach(item => {
        if (item.retryCount < this.MAX_RETRIES) {
          item.retryCount++;
          this.queue.push(item);
        } else {
          console.error(`Max retries exceeded for activity ${item.activityId}, dropping from queue`);
        }
      });
    } finally {
      this.isProcessing = false;
      
      // If there are items in queue (from retries), schedule another flush
      if (this.queue.length > 0) {
        setTimeout(() => this.flush(), this.RETRY_DELAY_MS);
      }
    }
  }

  /**
   * Save a single activity result to backend
   */
  private async saveActivityResult(item: QueuedItem): Promise<void> {
    try {
      // Validate required fields before sending
      if (!item.lessonId || !item.result.activityType || item.result.activityOrder === undefined) {
        throw new Error(`Missing required fields: lessonId=${!!item.lessonId}, activityType=${!!item.result.activityType}, activityOrder=${item.result.activityOrder !== undefined}`);
      }

      const payload = {
        lessonId: item.lessonId,
        activityId: item.activityId,
        activityType: item.result.activityType,
        activityOrder: item.result.activityOrder,
        score: item.result.score ?? 0,
        maxScore: item.result.maxScore ?? 0,
        attempts: item.result.attempts ?? 1,
        timeSpent: item.result.timeSpent,
        completedAt: item.result.completedAt,
        answers: item.result.answers || {},
        feedback: item.result.feedback || {},
      };

      const response = await fetch('/.netlify/functions/submit-lesson-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        const errorMessage = errorData.error || errorData.details || `Failed to save activity: ${response.status} ${response.statusText}`;
        console.error(`Backend error for activity ${item.result.activityType} (order ${item.result.activityOrder}):`, errorMessage, errorData);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || result.details || 'Activity save failed');
      }

      console.log(`✅ BackgroundSaveQueue: Saved ${item.result.activityType} (order ${item.result.activityOrder}) for lesson ${item.lessonId}`);
    } catch (error) {
      console.error(`Failed to save activity result (attempt ${item.retryCount + 1}/${this.MAX_RETRIES}):`, {
        activityType: item.result.activityType,
        activityOrder: item.result.activityOrder,
        lessonId: item.lessonId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error; // Re-throw to trigger retry logic
    }
  }

  /**
   * Force immediate flush of queue (for final submission)
   */
  async flushImmediate(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    // Wait for current processing to complete
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Flush remaining items
    await this.flush();
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is processing
   */
  isQueueProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Clear queue (for testing or error recovery)
   */
  clear(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.queue = [];
    this.isProcessing = false;
  }
}

// Export singleton instance
export const backgroundSaveQueue = new BackgroundSaveQueue();

