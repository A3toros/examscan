import { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'

// Admin authentication middleware
async function authenticateAdmin(event: any): Promise<boolean> {
  try {
    let token = null

    // Try Authorization header first
    const authHeader = event.headers?.authorization || event.headers?.Authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      // Fall back to cookie
      const cookies = event.headers?.cookie || event.headers?.Cookie || ''
      const cookieArray = cookies.split(';')
      const tokenCookie = cookieArray.find((c: string) => c.trim().startsWith('admin_token='))

      if (tokenCookie) {
        token = tokenCookie.split('=')[1]
      }
    }

    if (!token) {
      return false
    }

    const jwt = await import('jsonwebtoken')
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) return false

    const decoded = jwt.verify(token, jwtSecret) as any
    const isAdmin = decoded.role === 'admin'
    return isAdmin
  } catch (error) {
    console.error('Admin authentication error:', error)
    return false
  }
}

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    }
  }

  try {
    // Authenticate admin
    const isAdmin = await authenticateAdmin(event)
    if (!isAdmin) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Unauthorized - Admin access required' }),
      }
    }

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL
    if (!databaseUrl) {
      console.error('NEON_DATABASE_URL not configured')
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Database configuration error' }),
      }
    }

    const sql = neon(databaseUrl)

    // Get user ID from query params
    let userId: string | null = null
    
    // Try multiple ways to get the userId
    if (event.queryStringParameters?.userId) {
      userId = event.queryStringParameters.userId
    } else if (event.rawUrl) {
      try {
        const { searchParams } = new URL(event.rawUrl)
        userId = searchParams.get('userId')
      } catch (urlError) {
        console.error('Error parsing URL:', urlError)
      }
    }

    console.log('Admin get user lessons - userId:', userId)
    console.log('Admin get user lessons - queryStringParameters:', event.queryStringParameters)

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'User ID is required' }),
      }
    }

    // Get user's completed lessons with scores
    console.log('Fetching completed lessons for user:', userId)
    const userLessons = await sql`
      SELECT 
        l.id,
        l.level,
        l.topic,
        l.lesson_number,
        up.completed,
        up.score,
        up.completed_at,
        up.attempts
      FROM lessons l
      INNER JOIN user_progress up ON l.id = up.lesson_id
      WHERE up.user_id = ${userId} AND up.completed = true
      ORDER BY l.level, l.lesson_number
    `
    console.log('Found completed lessons:', userLessons.length)

    // Get activity results for each lesson
    const lessonsWithDetails = await Promise.all(
      userLessons.map(async (lesson: any) => {
        try {
          const activityResults = await sql`
            SELECT 
              lar.activity_type,
              lar.activity_order,
              lar.score,
              lar.max_score,
              lar.attempts,
              lar.time_spent,
              lar.completed_at,
              lar.feedback,
              lar.answers
            FROM lesson_activity_results lar
            WHERE lar.user_id = ${userId} AND lar.lesson_id = ${lesson.id}
            ORDER BY lar.activity_order ASC
          `

          // Calculate total time spent from activity results
          const totalTimeSpent = activityResults.reduce((sum: number, activity: any) => {
            return sum + (activity.time_spent || 0)
          }, 0)

          // Calculate actual percentage score from activity results
          // user_progress.score is cumulative (sum of all activity scores), not percentage
          const totalScore = activityResults.reduce((sum: number, activity: any) => {
            return sum + (activity.score || 0)
          }, 0)
          const totalMaxScore = activityResults.reduce((sum: number, activity: any) => {
            return sum + (activity.max_score || 0)
          }, 0)
          const calculatedPercentage = totalMaxScore > 0 
            ? Math.round((totalScore / totalMaxScore) * 100) 
            : (lesson.score || 0) // Fallback to stored score if no activity results

          return {
            ...lesson,
            score: calculatedPercentage, // Replace cumulative score with actual percentage
            activityResults: activityResults || [],
            time_spent: totalTimeSpent, // Add calculated time_spent
          }
        } catch (error) {
          console.error(`Error fetching activity results for lesson ${lesson.id}:`, error)
          return {
            ...lesson,
            activityResults: [],
            time_spent: 0,
          }
        }
      })
    )

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        lessons: lessonsWithDetails,
        totalCompleted: lessonsWithDetails.length,
      }),
    }
  } catch (error) {
    console.error('Admin get user lessons error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}

export { handler }

