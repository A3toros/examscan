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
    } else {
      // Fall back to cookie
      const cookies = event.headers?.cookie || '';
      const cookieArray = cookies.split(';');
      const tokenCookie = cookieArray.find((c: string) => c.trim().startsWith('admin_token='));

      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
      }
    }

    if (!token) {
      return false;
    }

    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET;
    console.log('Admin auth: JWT secret configured:', !!jwtSecret);
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
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    } as any;
  }

  // Check admin authentication
  const isAdmin = await authenticateAdmin(event);
  if (!isAdmin) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Admin authentication required' })
    } as any;
  }

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

    // Get user ID from request body
    const body = JSON.parse(event.body || '{}');
    const { userId } = body;

    if (!userId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'User ID is required' })
      } as any;
    }

    // Check if user exists
    const userCheck = await sql`
      SELECT id, email, username FROM users WHERE id = ${userId}
    `;

    if (userCheck.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'User not found' })
      } as any;
    }

    const user = userCheck[0];

    // Delete all sessions for this user from the database
    const deletedSessions = await sql`
      DELETE FROM user_sessions
      WHERE user_id = ${userId}
      RETURNING id
    `;
    const deletedCount = deletedSessions.length || 0;

    // Also update user's session_revoked_at timestamp as a safety measure
    // This invalidates any tokens that might be validated before the next request
    await sql`
      UPDATE users
      SET session_revoked_at = NOW(), updated_at = NOW()
      WHERE id = ${userId}
    `;

    console.log(`[AUTH] Admin revoked all sessions for user: ${user.email} (${user.username}) - ${deletedCount} session(s) deleted`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `All sessions for user ${user.email} have been revoked`,
        deletedSessions: deletedCount,
        affectedUser: {
          id: user.id,
          email: user.email,
          username: user.username
        }
      })
    } as any;

  } catch (error) {
    console.error('Revoke session error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Failed to revoke user sessions' })
    } as any;
  }
};

export { handler };
