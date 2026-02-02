import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

// Admin authentication middleware
async function authenticateAdmin(event: any): Promise<boolean> {
  try {
    let token = null;

    // Try Authorization header first
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('Admin-get-stats auth: Token from Authorization header');
    } else {
      // Fall back to cookie (check both lowercase and uppercase)
      const cookies = event.headers?.cookie || event.headers?.Cookie || '';
      console.log('Admin-get-stats auth: Cookies received:', cookies ? 'yes' : 'no', cookies.substring(0, 100));
      const cookieArray = cookies.split(';');
      const tokenCookie = cookieArray.find((c: string) => c.trim().startsWith('admin_token='));

      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
        console.log('Admin-get-stats auth: Token found in cookie, length:', token?.length);
      } else {
        console.log('Admin-get-stats auth: No admin_token cookie found. Available cookies:', cookieArray.map((c: string) => c.trim().split('=')[0]));
      }
    }

    if (!token) {
      console.log('Admin-get-stats auth: No token found');
      return false;
    }

    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET;
    console.log('Admin-get-stats auth: JWT secret configured:', !!jwtSecret);
    if (!jwtSecret) return false;

    const decoded = jwt.verify(token, jwtSecret) as any;
    const isAdmin = decoded.role === 'admin';
    return isAdmin;
  } catch (error) {
    console.error('Admin authentication error:', error);
    return false;
  }
}

const handler: Handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    } as any;
  }

  // Check admin authentication
  console.log('Admin-get-stats: Checking admin authentication...');
  const isAdmin = await authenticateAdmin(event);
  console.log('Admin-get-stats: Is admin?', isAdmin);
  if (!isAdmin) {
    console.log('Admin-get-stats: Admin authentication failed');
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Admin authentication required' })
    } as any;
  }
  console.log('Admin-get-stats: Admin authentication passed');

  try {
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
    console.log('Admin-get-stats: Database URL configured:', !!databaseUrl);

    // Get period parameter for charts
    const url = new URL(event.rawUrl || `http://localhost${event.path}`);
    const period = url.searchParams.get('period') || 'month'; // 'week', 'month', 'year'

    let days;
    let groupBy;
    switch (period) {
      case 'week':
        days = 7;
        groupBy = 'DATE';
        break;
      case 'month':
        days = 30;
        groupBy = 'DATE';
        break;
      case 'year':
        days = 365;
        groupBy = "DATE_TRUNC('month', created_at)";
        break;
      default:
        days = 30;
        groupBy = 'DATE';
    }

    // Get user statistics
    const userStatsResult = await sql`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN last_login >= NOW() - INTERVAL '1 day' THEN 1 END) as active_today,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week,
        ROUND(AVG(CASE
          WHEN level = 'A1' THEN 1
          WHEN level = 'A2' THEN 2
          WHEN level = 'B1' THEN 3
          WHEN level = 'B2' THEN 4
          WHEN level = 'C1' THEN 5
          WHEN level = 'C2' THEN 6
          ELSE 1
        END), 1) as avg_level_numeric
      FROM users
    `;
    const userStats = userStatsResult[0];

    console.log('User stats from database:', userStats);
    console.log('Total users count:', userStats.total_users);
    console.log('Raw userStatsResult:', userStatsResult);

    // Convert numeric level back to letter
    const levelMap = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' };
    const averageLevel = levelMap[userStats.avg_level_numeric as keyof typeof levelMap] || 'A1';

    // Get lesson completion statistics
    const lessonStatsResult = await sql`
      SELECT
        COUNT(*) as total_completions,
        COUNT(DISTINCT lesson_id) as unique_lessons_completed,
        ROUND(AVG(score), 1) as avg_score,
        SUM(score) as total_stars_earned
      FROM user_progress
      WHERE completed = true
    `;
    const lessonStats = lessonStatsResult[0];

    // Get evaluation statistics
    const evalStatsResult = await sql`
      SELECT
        COUNT(*) as total_evaluations,
        ROUND(AVG(overall_percentage), 1) as avg_evaluation_score,
        COUNT(CASE WHEN passed = true THEN 1 END) as passed_count,
        COUNT(CASE WHEN passed = false THEN 1 END) as failed_count,
        ROUND(AVG(time_spent), 0) as avg_time_spent
      FROM evaluation_results
    `;
    const evalStats = evalStatsResult[0];

    // Get activity completion statistics
    const activityStatsResult = await sql`
      SELECT
        COUNT(*) as total_activities,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(CASE WHEN activity_type = 'vocabulary_matching' THEN 1 END) as vocab_matching_count,
        COUNT(CASE WHEN activity_type = 'vocabulary_fill_blanks' THEN 1 END) as vocab_fill_count,
        COUNT(CASE WHEN activity_type = 'grammar_drag_sentence' THEN 1 END) as grammar_count,
        COUNT(CASE WHEN activity_type = 'speaking_with_feedback' THEN 1 END) as speaking_count,
        COUNT(CASE WHEN activity_type = 'language_improvement_reading' THEN 1 END) as reading_count
      FROM lesson_activity_results
    `;
    const activityStats = activityStatsResult[0];

    // Get time-series data for charts
    const userGrowthData = await sql.unsafe(`
      SELECT
        ${groupBy === "DATE_TRUNC('month', created_at)" ?
          "DATE_TRUNC('month', created_at) as period" :
          "DATE(created_at) as period"
        },
        COUNT(*) as new_users,
        SUM(COUNT(*)) OVER (ORDER BY ${groupBy === "DATE_TRUNC('month', created_at)" ?
          "DATE_TRUNC('month', created_at)" :
          "DATE(created_at)"
        }) as cumulative_users
      FROM users
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY ${groupBy === "DATE_TRUNC('month', created_at)" ?
        "DATE_TRUNC('month', created_at)" :
        "DATE(created_at)"
      }
      ORDER BY period
    `);

    const activityData = await sql.unsafe(`
      SELECT
        ${groupBy === "DATE_TRUNC('month', last_login)" ?
          "DATE_TRUNC('month', last_login) as period" :
          "DATE(last_login) as period"
        },
        COUNT(*) as active_users
      FROM users
      WHERE last_login >= NOW() - INTERVAL '${days} days'
      GROUP BY ${groupBy === "DATE_TRUNC('month', last_login)" ?
        "DATE_TRUNC('month', last_login)" :
        "DATE(last_login)"
      }
      ORDER BY period
    `);

    // Debug log the raw data
    console.log('Admin-get-stats: Raw userGrowthData:', userGrowthData);
    console.log('Admin-get-stats: userGrowthData type:', typeof userGrowthData);
    console.log('Admin-get-stats: userGrowthData length:', Array.isArray(userGrowthData) ? userGrowthData.length : 'not array');

    // Format chart data - ensure it's an array
    const userGrowthDataArray = Array.isArray(userGrowthData) ? userGrowthData : [];
    const userGrowth = userGrowthDataArray.map(row => ({
      date: period === 'year' ?
        row.period.toISOString().substring(0, 7) : // YYYY-MM format
        row.period.toISOString().split('T')[0],     // YYYY-MM-DD format
      newUsers: parseInt(row.new_users || '0'),
      totalUsers: parseInt(row.cumulative_users || '0')
    }));

    // Debug log the activity data
    console.log('Admin-get-stats: Raw activityData:', activityData);
    console.log('Admin-get-stats: activityData type:', typeof activityData);
    console.log('Admin-get-stats: activityData length:', Array.isArray(activityData) ? activityData.length : 'not array');

    // Format activity data - ensure it's an array
    const activityDataArray = Array.isArray(activityData) ? activityData : [];
    const activity = activityDataArray.map(row => ({
      date: period === 'year' ?
        row.period.toISOString().substring(0, 7) :
        row.period.toISOString().split('T')[0],
      activeUsers: parseInt(row.active_users || '0')
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        stats: {
          users: {
            total: parseInt(userStats.total_users),
            activeToday: parseInt(userStats.active_today),
            newThisWeek: parseInt(userStats.new_this_week),
            averageLevel: averageLevel
          },
          lessons: {
            totalCompletions: parseInt(lessonStats.total_completions),
            uniqueLessons: parseInt(lessonStats.unique_lessons_completed),
            averageScore: parseFloat(lessonStats.avg_score) || 0,
            totalStarsEarned: parseInt(lessonStats.total_stars_earned) || 0
          },
          evaluations: {
            total: parseInt(evalStats.total_evaluations),
            averageScore: parseFloat(evalStats.avg_evaluation_score) || 0,
            levelDistribution: {
              A1: parseInt(evalStats.a1_count),
              A2: parseInt(evalStats.a2_count),
              B1: parseInt(evalStats.b1_count),
              B2: parseInt(evalStats.b2_count),
              C1: parseInt(evalStats.c1_count),
              C2: parseInt(evalStats.c2_count)
            }
          },
          activities: {
            total: parseInt(activityStats.total_activities),
            activeUsers: parseInt(activityStats.active_users),
            byType: {
              vocabularyMatching: parseInt(activityStats.vocab_matching_count),
              vocabularyFillBlanks: parseInt(activityStats.vocab_fill_count),
              grammar: parseInt(activityStats.grammar_count),
              speaking: parseInt(activityStats.speaking_count),
              reading: parseInt(activityStats.reading_count)
            }
          }
        },
        charts: {
          userGrowth,
          activity,
          period
        }
      })
    } as any;

  } catch (error) {
    console.error('Get stats error:', error);
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
