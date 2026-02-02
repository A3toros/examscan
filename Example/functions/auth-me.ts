import { Handler } from '@netlify/functions';
import * as jwt from 'jsonwebtoken'
import { neon } from '@neondatabase/serverless'
import { getHeaders } from './cors-headers';

const handler: Handler = async (event, context) => {
  // Get security headers (no credentials needed for GET endpoint)
  const headers = getHeaders(event, false);

  // Only allow GET and OPTIONS requests
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'OPTIONS') {
    return {
      statusCode: 405,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    } as any;
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    } as any;
  }

  try {
    // Get access token from cookie
    const cookies = event.headers?.cookie || '';
    const accessToken = getCookieValue(cookies, 'access_token');

    if (!accessToken) {
      return {
        statusCode: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'No access token provided' })
      } as any;
    }

    // Get JWT secret
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      return {
        statusCode: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'JWT configuration error' })
      } as any;
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(accessToken, jwtSecret) as any;

      // Get database connection
      const databaseUrl = process.env.NEON_DATABASE_URL;
      if (!databaseUrl) {
        console.error('NEON_DATABASE_URL not configured');
        return {
          statusCode: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ success: false, error: 'Database configuration error' })
        } as any;
      }

      const sql = neon(databaseUrl);

      // Get user from database
      const userResult = await sql`
        SELECT id, email, username, first_name, last_name, level, role, current_lesson, total_stars, created_at, last_login, email_verified, eval_test_result
        FROM users
        WHERE id = ${decoded.userId}
      `;

      if (!userResult || userResult.length === 0) {
      return {
        statusCode: 404,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'User not found' })
      } as any;
      }

      const user = userResult[0];

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
            level: user.level,
            role: user.role,
            currentLesson: user.current_lesson || 1,
            totalStars: user.total_stars || 0,
            createdAt: user.created_at,
            lastLogin: user.last_login,
            emailVerified: user.email_verified,
            evalTestResult: user.eval_test_result
          }
        })
      } as any;

    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      return {
        statusCode: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Invalid or expired token' })
      } as any;
    }

  } catch (error) {
    console.error('Auth check error:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    } as any;
  }
};

export { handler };

function getCookieValue(cookies: string, name: string): string | null {
  const cookieArray = cookies.split(';')
  for (const cookie of cookieArray) {
    const [cookieName, cookieValue] = cookie.trim().split('=')
    if (cookieName === name) {
      return cookieValue
    }
  }
  return null
}
