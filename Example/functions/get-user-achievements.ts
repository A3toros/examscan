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

    // Get all achievements with user's progress using the database function
    const achievements = await sql`
      SELECT * FROM get_user_achievements_with_progress(${userId})
      ORDER BY 
        CASE WHEN earned_at IS NOT NULL THEN 0 ELSE 1 END,
        category,
        points DESC
    `;

    // Get last earned achievement
    const lastEarned = achievements.find((a: any) => a.earned_at !== null);
    const lastEarnedAchievement = lastEarned ? {
      code: lastEarned.code,
      name: lastEarned.name,
      icon: lastEarned.icon,
      earnedAt: lastEarned.earned_at
    } : null;

    // Group by category
    const achievementsByCategory = achievements.reduce((acc: any, achievement: any) => {
      const category = achievement.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(achievement);
      return acc;
    }, {});

    // Calculate stats
    const totalAchievements = achievements.length;
    const earnedCount = achievements.filter((a: any) => a.earned_at !== null).length;
    const earnedPercentage = totalAchievements > 0 ? Math.round((earnedCount / totalAchievements) * 100) : 0;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        data: {
          achievements,
          achievementsByCategory,
          lastEarned: lastEarnedAchievement,
          stats: {
            total: totalAchievements,
            earned: earnedCount,
            percentage: earnedPercentage
          }
        }
      })
    } as any;

  } catch (error) {
    console.error('Get achievements error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Failed to load achievements' })
    } as any;
  }
};

export { handler };

