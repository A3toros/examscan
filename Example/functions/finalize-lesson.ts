import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { validateJWT } from './auth-validate-jwt.js';

interface FinalizeLessonRequest {
  lessonId: string;
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

    // Parse request body
    let request: FinalizeLessonRequest;
    try {
      request = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
      } as any;
    }

    if (!request.lessonId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required field: lessonId' })
      } as any;
    }

    // Query all activity results for this lesson and user
    const activityResults = await sql`
      SELECT 
        score,
        max_score,
        activity_order,
        activity_type,
        completed_at
      FROM lesson_activity_results
      WHERE user_id = ${userId} AND lesson_id = ${request.lessonId}
      ORDER BY activity_order ASC
    `;

    // Allow finalization even if there are no activity results (e.g., non-assessed activities or missing writes)
    const totalScore = activityResults.reduce((sum, result) => sum + (result.score || 0), 0);
    const maxScore = activityResults.reduce((sum, result) => sum + (result.max_score || 0), 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const isPassed = percentage >= 60; // 60% passing threshold

    // Calculate stars earned (1-3 stars based on performance)
    // 60-79% = 1 star, 80-89% = 2 stars, 90-100% = 3 stars
    let starsEarned = 0;
    if (isPassed) {
      if (percentage >= 90) {
        starsEarned = 3;
      } else if (percentage >= 80) {
        starsEarned = 2;
      } else {
        starsEarned = 1;
      }
    }

    // Begin transaction
    await sql`BEGIN`;

    try {
      // Check if user_progress record exists
      const existingProgress = await sql`
        SELECT id, attempts FROM user_progress
        WHERE user_id = ${userId} AND lesson_id = ${request.lessonId}
      `;

      if (existingProgress.length > 0) {
        // Update existing record
        await sql`
          UPDATE user_progress
          SET score = ${totalScore},
              completed = true,
              completed_at = NOW(),
              attempts = ${existingProgress[0].attempts + 1}
          WHERE user_id = ${userId} AND lesson_id = ${request.lessonId}
        `;
      } else {
        // Insert new record
        await sql`
          INSERT INTO user_progress (user_id, lesson_id, score, completed, completed_at, attempts)
          VALUES (${userId}, ${request.lessonId}, ${totalScore}, true, NOW(), 1)
        `;
      }

      // If lesson was passed, award stars to user
      if (isPassed && starsEarned > 0) {
        await sql`
          UPDATE users
          SET total_stars = total_stars + ${starsEarned}
          WHERE id = ${userId}
        `;
      }


      // Commit transaction (after level progression is checked)
      await sql`COMMIT`;

      // Check and award achievements after lesson completion
      let newlyEarnedAchievements: any[] = [];
      try {
        const achievementResults = await sql`
          SELECT * FROM check_achievements_on_lesson_complete(${userId})
        `;
        newlyEarnedAchievements = achievementResults || [];
      } catch (achievementError) {
        // Log but don't fail the lesson completion
        console.error('Error checking achievements:', achievementError);
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            lessonId: request.lessonId,
            totalScore,
            maxScore,
            percentage,
            passed: isPassed,
            starsEarned,
            completedActivities: activityResults.length,
            completedAt: new Date().toISOString(),
            newlyEarnedAchievements: newlyEarnedAchievements.map((a: any) => ({
              code: a.achievement_code,
              name: a.achievement_name,
              icon: a.icon
            }))
          }
        })
      } as any;

    } catch (dbError) {
      // Rollback transaction on error
      await sql`ROLLBACK`;
      throw dbError;
    }

  } catch (error) {
    console.error('Finalize lesson error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to finalize lesson',
        details: error instanceof Error ? error.stack || error.message : 'Unknown error'
      })
    } as any;
  }
};

export { handler };

