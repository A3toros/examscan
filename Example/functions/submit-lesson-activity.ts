import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { validateJWT } from './auth-validate-jwt.js';

interface LessonActivitySubmission {
  lessonId: string;
  activityId?: string; // Optional UUID from lesson_activities table
  activityType: 'warm_up_speaking' | 'vocabulary_intro' | 'vocab_match_drag' | 'vocabulary_matching_drag' | 'vocab_fill_dropdown' | 'vocabulary_fill_blanks' | 'grammar_drag_sentence' | 'grammar_sentences' | 'speaking_with_feedback' | 'speaking_practice' | 'speaking_improvement' | 'language_improvement_reading' | 'listening_practice';
  activityOrder: number;
  score?: number;
  maxScore?: number;
  attempts: number;
  timeSpent?: number; // in seconds
  completedAt: string;
  answers?: any; // Flexible structure for different activity types
  feedback?: any; // Flexible structure - can be any feedback format
  isFinal?: boolean; // true if this is the last activity in the lesson
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

    let submission: LessonActivitySubmission;
    try {
      submission = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
      } as any;
    }

    // Validate required fields
    if (!submission.lessonId || !submission.activityType || submission.activityOrder === undefined) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required fields: lessonId, activityType, activityOrder' })
      } as any;
    }

    // Store submission for error logging
    const submissionForLogging = {
      lessonId: submission.lessonId,
      activityType: submission.activityType,
      activityOrder: submission.activityOrder
    };

    // Determine if this is the final activity
    const isFinalActivity = submission.isFinal === true || submission.activityType === 'language_improvement_reading';
    const activityScore = submission.score || 0;
    const activityMaxScore = submission.maxScore || 0;

    // Helper function to validate UUID format
    const isValidUUID = (str: string | null | undefined): boolean => {
      if (!str) return false;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Get activity_id from lesson_activities if not provided or if provided value is not a valid UUID
    let activityId: string | null = null;
    
    // Only use submission.activityId if it's a valid UUID
    if (submission.activityId && isValidUUID(submission.activityId)) {
      activityId = submission.activityId;
    }
    
    // If we don't have a valid activityId, try to fetch it from the database
    if (!activityId) {
      const activityResult = await sql`
        SELECT id FROM lesson_activities
        WHERE lesson_id = ${submission.lessonId} 
          AND activity_order = ${submission.activityOrder}
          AND active = TRUE
        LIMIT 1
      `;
      if (activityResult.length > 0) {
        activityId = activityResult[0].id;
      }
    }

    // UPSERT activity result (update if exists, insert if not)
    // Use ON CONFLICT to handle race conditions atomically
    // Note: The unique constraint is on (user_id, lesson_id, activity_id)
    // If activity_id is null, we need to handle it differently
    if (activityId) {
      // Use activity_id for conflict resolution when available
      await sql`
        INSERT INTO lesson_activity_results (
          user_id, lesson_id, activity_id, activity_type, activity_order, score, max_score,
          attempts, time_spent, completed_at, answers, feedback
        ) VALUES (
          ${userId}, ${submission.lessonId}, ${activityId}, ${submission.activityType},
          ${submission.activityOrder}, ${activityScore}, ${activityMaxScore},
          ${submission.attempts}, ${submission.timeSpent}, ${submission.completedAt}::timestamp,
          ${JSON.stringify(submission.answers || {})}::jsonb, ${JSON.stringify(submission.feedback || {})}::jsonb
        )
        ON CONFLICT (user_id, lesson_id, activity_id)
        DO UPDATE SET
          activity_type = EXCLUDED.activity_type,
          activity_order = EXCLUDED.activity_order,
          score = EXCLUDED.score,
          max_score = EXCLUDED.max_score,
          attempts = EXCLUDED.attempts,
          time_spent = EXCLUDED.time_spent,
          completed_at = EXCLUDED.completed_at,
          answers = EXCLUDED.answers,
          feedback = EXCLUDED.feedback
      `;
    } else {
      // When activity_id is null, we need to use a different approach
      // First, try to find existing record by user_id, lesson_id, and activity_order
      const existingResult = await sql`
        SELECT id FROM lesson_activity_results
        WHERE user_id = ${userId} 
          AND lesson_id = ${submission.lessonId}
          AND activity_order = ${submission.activityOrder}
          AND activity_id IS NULL
        LIMIT 1
      `;
      
      if (existingResult.length > 0) {
        // Update existing record
        await sql`
          UPDATE lesson_activity_results
          SET
            activity_type = ${submission.activityType},
            score = ${activityScore},
            max_score = ${activityMaxScore},
            attempts = ${submission.attempts},
            time_spent = ${submission.timeSpent},
            completed_at = ${submission.completedAt}::timestamp,
            answers = ${JSON.stringify(submission.answers || {})}::jsonb,
            feedback = ${JSON.stringify(submission.feedback || {})}::jsonb
          WHERE id = ${existingResult[0].id}
        `;
      } else {
        // Insert new record
        await sql`
          INSERT INTO lesson_activity_results (
            user_id, lesson_id, activity_id, activity_type, activity_order, score, max_score,
            attempts, time_spent, completed_at, answers, feedback
          ) VALUES (
            ${userId}, ${submission.lessonId}, NULL, ${submission.activityType},
            ${submission.activityOrder}, ${activityScore}, ${activityMaxScore},
            ${submission.attempts}, ${submission.timeSpent}, ${submission.completedAt}::timestamp,
            ${JSON.stringify(submission.answers || {})}::jsonb, ${JSON.stringify(submission.feedback || {})}::jsonb
          )
        `;
      }
    }

    // Update user progress incrementally
    // If final activity, mark lesson as completed
    // Check if user_progress record exists
    const existingProgress = await sql`
      SELECT id FROM user_progress
      WHERE user_id = ${userId} AND lesson_id = ${submission.lessonId}
      LIMIT 1
    `;

    if (existingProgress.length > 0) {
      // Update existing progress
      await sql`
        UPDATE user_progress
        SET
          score = user_progress.score + ${activityScore}, -- Incremental: add to existing score
          completed = CASE WHEN ${isFinalActivity} THEN true ELSE user_progress.completed END,
          completed_at = CASE WHEN ${isFinalActivity} THEN ${submission.completedAt}::timestamp ELSE user_progress.completed_at END,
          attempts = ${submission.attempts}
        WHERE user_id = ${userId} AND lesson_id = ${submission.lessonId}
      `;
    } else {
      // Insert new progress record
      await sql`
        INSERT INTO user_progress (user_id, lesson_id, score, completed, completed_at, attempts)
        VALUES (${userId}, ${submission.lessonId}, ${activityScore}, ${isFinalActivity}, ${isFinalActivity ? submission.completedAt : null}, ${submission.attempts})
      `;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Lesson activity submitted successfully'
      })
    } as any;

  } catch (error) {
    console.error('Lesson activity submission error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Try to get submission data from scope if available
    let submissionData: any = 'No submission data available';
    try {
      const parsedBody = JSON.parse(event.body || '{}');
      submissionData = {
        lessonId: parsedBody.lessonId,
        activityType: parsedBody.activityType,
        activityOrder: parsedBody.activityOrder
      };
    } catch {
      // Ignore parsing errors
    }
    
    // Log detailed error for debugging
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      submission: submissionData
    });
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: errorMessage
      })
    } as any;
  }
};

export { handler };
