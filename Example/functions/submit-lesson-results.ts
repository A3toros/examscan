/**
 * @deprecated This endpoint is deprecated and will be removed in a future version.
 * Use finalize-lesson.ts instead for final lesson submission.
 * 
 * This endpoint is redundant because:
 * 1. Activities are already saved incrementally via submit-lesson-activity
 * 2. It re-saves all activities unnecessarily
 * 3. finalize-lesson.ts calculates scores from existing records without re-saving
 * 
 * Migration path:
 * - Replace calls to submit-lesson-results with finalize-lesson
 * - finalize-lesson only requires lessonId (no need to send all activity results)
 */

import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { validateJWT } from './auth-validate-jwt.js';

interface LessonSubmission {
  lessonId: string;
  totalScore: number;
  maxScore: number;
  timeSpent: number; // in seconds
  completedActivities: number;
  totalActivities: number;
  results: Array<{
    activityType: string;
    activityOrder: number;
    score: number;
    maxScore: number;
    attempts: number;
    timeSpent: number;
    completed: boolean;
  }>;
}

const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    } as any;
  }

  // Log deprecation warning
  console.warn('[DEPRECATED] submit-lesson-results endpoint is deprecated. Use finalize-lesson instead.');

  try {
    // Validate authentication
    const cookies = event.headers?.cookie || '';
    const token = cookies.split(';').find(c => c.trim().startsWith('access_token='))?.split('=')[1];

    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Authentication required' })
      } as any;
    }

    const auth = await validateJWT(token);
    if (!auth.isValid || !auth.user) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid authentication' })
      } as any;
    }

    const userId = auth.user.id;

    // Parse request body
    const submission: LessonSubmission = JSON.parse(event.body || '{}');

    if (!submission.lessonId || !submission.results) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      } as any;
    }

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('NEON_DATABASE_URL not configured');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Database configuration error' })
      } as any;
    }

    const sql = neon(databaseUrl);

    // Calculate final results
    const totalScore = submission.results.reduce((sum, result) => sum + result.score, 0);
    const maxScore = submission.results.reduce((sum, result) => sum + result.maxScore, 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const isPassed = percentage >= 60; // 60% passing threshold

    // Calculate stars earned (1-3 stars based on performance)
    const starsEarned = isPassed ? Math.min(3, Math.max(1, Math.floor(percentage / 33.33) + 1)) : 0;

    // Begin transaction
    await sql`BEGIN`;

    try {
      // Update or insert user progress for the lesson
      await sql`
        INSERT INTO user_progress (user_id, lesson_id, score, completed, completed_at, attempts)
        VALUES (${userId}, ${submission.lessonId}, ${totalScore}, ${isPassed}, NOW(), 1)
        ON CONFLICT (user_id, lesson_id)
        DO UPDATE SET
          score = EXCLUDED.score,
          completed = EXCLUDED.completed,
          completed_at = CASE WHEN EXCLUDED.completed THEN NOW() ELSE user_progress.completed_at END,
          attempts = user_progress.attempts + 1
      `;

      // Update user's total stars if lesson was completed and passed
      if (isPassed) {
        await sql`
          UPDATE users
          SET total_stars = total_stars + ${starsEarned}
          WHERE id = ${userId}
        `;
      }

      // Commit transaction
      await sql`COMMIT`;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            lessonId: submission.lessonId,
            totalScore,
            maxScore,
            percentage,
            passed: isPassed,
            starsEarned,
            timeSpent: submission.timeSpent,
            completedActivities: submission.completedActivities,
            totalActivities: submission.totalActivities
          }
        })
      } as any;

    } catch (dbError) {
      // Rollback transaction on error
      await sql`ROLLBACK`;
      throw dbError;
    }

  } catch (error) {
    console.error('Lesson submission error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to submit lesson results'
      })
    } as any;
  }
};

export { handler };
