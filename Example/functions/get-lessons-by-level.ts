import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { validateJWT } from './auth-validate-jwt.js';

const handler: Handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
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

    const url = new URL(event.rawUrl || `http://localhost${event.path}`);
    const level = url.searchParams.get('level');

    if (!level) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Level is required' })
      } as any;
    }

    // OPTIMIZED: Single query with JOINs instead of 4 separate queries
    // This reduces database round trips from 4 to 1, significantly improving performance
    const lessonsWithProgress = userId 
      ? await sql`
        WITH lesson_activity_counts AS (
          SELECT 
            la.lesson_id,
            COUNT(DISTINCT la.id) FILTER (WHERE la.active = TRUE) as total
          FROM lesson_activities la
          WHERE la.active = TRUE
          GROUP BY la.lesson_id
        ),
        user_completed_counts AS (
          SELECT 
            lar.lesson_id,
            COUNT(DISTINCT lar.activity_order) as completed
          FROM lesson_activity_results lar
          WHERE lar.user_id = ${userId}
          GROUP BY lar.lesson_id
        ),
        user_progress_data AS (
          SELECT 
            up.*
          FROM user_progress up
          WHERE up.user_id = ${userId}
        )
        SELECT 
          l.*,
          COALESCE(lac.total, 0)::INTEGER as total_activities,
          COALESCE(ucc.completed, 0)::INTEGER as completed_activities,
          CASE 
            WHEN COALESCE(lac.total, 0) > 0 THEN
              LEAST(100, ROUND((COALESCE(ucc.completed, 0)::NUMERIC / lac.total::NUMERIC) * 100))
            WHEN up.completed = TRUE THEN 100
            ELSE 0
          END::INTEGER as progress_percentage,
          CASE 
            WHEN up.id IS NOT NULL THEN
              jsonb_build_object(
                'id', up.id,
                'user_id', up.user_id,
                'lesson_id', up.lesson_id,
                'score', LEAST(100, ROUND((COALESCE(ucc.completed, 0)::NUMERIC / NULLIF(lac.total, 0)::NUMERIC) * 100)),
                'completed', up.completed,
                'completed_at', up.completed_at,
                'attempts', up.attempts
              )
            ELSE NULL
          END as user_progress
        FROM lessons l
        LEFT JOIN lesson_activity_counts lac ON l.id = lac.lesson_id
        LEFT JOIN user_completed_counts ucc ON l.id = ucc.lesson_id
        LEFT JOIN user_progress_data up ON l.id = up.lesson_id
        WHERE l.level = ${level}
        ORDER BY l.lesson_number
      `
      : await sql`
        WITH lesson_activity_counts AS (
          SELECT 
            la.lesson_id,
            COUNT(DISTINCT la.id) FILTER (WHERE la.active = TRUE) as total
          FROM lesson_activities la
          WHERE la.active = TRUE
          GROUP BY la.lesson_id
        )
        SELECT 
          l.*,
          COALESCE(lac.total, 0)::INTEGER as total_activities,
          0::INTEGER as completed_activities,
          0::INTEGER as progress_percentage,
          NULL::jsonb as user_progress
        FROM lessons l
        LEFT JOIN lesson_activity_counts lac ON l.id = lac.lesson_id
        WHERE l.level = ${level}
        ORDER BY l.lesson_number
      `;

    // Transform the result to match expected format
    const formattedLessons = lessonsWithProgress.map((row: any) => {
      const { total_activities, completed_activities, progress_percentage, user_progress, ...lesson } = row;
      return {
        ...lesson,
        userProgress: user_progress || null
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        level,
        lessons: formattedLessons,
        totalLessons: formattedLessons.length
      })
    } as any;

  } catch (error) {
    console.error('Get lessons by level error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } as any;
  }
};

export { handler };
