import { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import { validateJWT } from './auth-validate-jwt.js'

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed' }) } as any
  }

  try {
    // Auth
    const cookies = event.headers?.cookie || ''
    const token = cookies.split(';').find(c => c.trim().startsWith('access_token='))?.split('=')[1]
    if (!token) return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Authentication required' }) } as any

    const auth = await validateJWT(token)
    if (!auth.isValid || !auth.user) {
      return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Invalid authentication' }) } as any
    }
    const userId = auth.user.id

    const dbUrl = process.env.NEON_DATABASE_URL
    if (!dbUrl) {
      return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Database not configured' }) } as any
    }
    const sql = neon(dbUrl)

    // Current user level
    const userInfo = await sql`SELECT level FROM users WHERE id = ${userId}`
    const userLevel = userInfo[0]?.level || null
    if (!userLevel) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'User has no level set' }) } as any
    }

    const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    const idx = levelOrder.indexOf(userLevel)
    if (idx === -1) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Unknown level' }) } as any
    }

    // Total lessons in this level
    const totalLessonsResult = await sql`
      SELECT COUNT(*) as total
      FROM lessons
      WHERE level = ${userLevel}
    `
    const totalLessons = Number(totalLessonsResult[0]?.total || 0)
    if (totalLessons === 0) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'No lessons for this level' }) } as any
    }

    // Completed lessons in this level
    const completedLessonsResult = await sql`
      SELECT COUNT(DISTINCT up.lesson_id) as completed
      FROM user_progress up
      INNER JOIN lessons l ON l.id = up.lesson_id
      WHERE up.user_id = ${userId}
        AND l.level = ${userLevel}
        AND up.completed = true
    `
    const completedLessons = Number(completedLessonsResult[0]?.completed || 0)

    const canAdvance = completedLessons >= totalLessons
    let newLevel: string | null = null

    if (canAdvance && idx < levelOrder.length - 1) {
      newLevel = levelOrder[idx + 1]
      await sql`
        UPDATE users
        SET level = ${newLevel}
        WHERE id = ${userId}
      `
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        canAdvance,
        fromLevel: userLevel,
        toLevel: newLevel,
        completedLessons,
        totalLessons
      })
    } as any
  } catch (error: any) {
    console.error('advance-level error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error?.message || 'Failed to advance level'
      })
    } as any
  }
}

export { handler }

