import { Handler } from '@netlify/functions';
import * as jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

export interface ValidatedUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  level: string;
  currentLesson: number;
  totalStars: number;
  createdAt: string;
  lastLogin: string;
  emailVerified: boolean;
}

export interface JWTValidationResult {
  isValid: boolean;
  user?: ValidatedUser;
  error?: string;
}

/**
 * Validate JWT token and return user information
 */
export async function validateJWT(token: string): Promise<JWTValidationResult> {
  try {
    // Get JWT secret
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      return { isValid: false, error: 'JWT configuration error' };
    }

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret) as any;

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('NEON_DATABASE_URL not configured');
      return { isValid: false, error: 'Database configuration error' };
    }

    const sql = neon(databaseUrl);

    // Get user from database
    const userResult = await sql`
      SELECT id, email, username, first_name, last_name, level, current_lesson, total_stars, created_at, last_login, email_verified, session_revoked_at
      FROM users
      WHERE id = ${decoded.userId}
    `;

    if (!userResult || userResult.length === 0) {
      return { isValid: false, error: 'User not found' };
    }

    const user = userResult[0];

    // Check if user's sessions have been revoked
    if (user.session_revoked_at) {
      const tokenIssuedAt = new Date(decoded.iat * 1000); // Convert JWT iat to Date
      const sessionRevokedAt = new Date(user.session_revoked_at);

      if (tokenIssuedAt < sessionRevokedAt) {
        console.log('Token issued before session revocation, invalidating');
        return { isValid: false, error: 'Session has been revoked' };
      }
    }

    return {
      isValid: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        level: user.level,
        currentLesson: user.current_lesson || 1,
        totalStars: user.total_stars || 0,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        emailVerified: user.email_verified
      }
    };

  } catch (error) {
    console.error('JWT validation error:', error);
    return { isValid: false, error: 'Invalid or expired token' };
  }
}

/**
 * Extract token from cookies
 */
export function extractTokenFromCookies(cookies: string): string | null {
  const cookieArray = cookies.split(';');
  for (const cookie of cookieArray) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === 'access_token') {
      return cookieValue;
    }
  }
  return null;
}

/**
 * Netlify function handler for JWT validation
 */
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
    // Get token from cookie or body
    let token: string | null = null;

    // Try cookie first
    const cookies = event.headers?.cookie || '';
    token = extractTokenFromCookies(cookies);

    // If no cookie token, try body
    if (!token) {
      try {
        const body = JSON.parse(event.body || '{}');
        token = body.token;
      } catch (error) {
        // Ignore parse errors
      }
    }

    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'No token provided' })
      } as any;
    }

    const validation = await validateJWT(token);

    if (!validation.isValid) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: validation.error })
      } as any;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        user: validation.user
      })
    } as any;

  } catch (error) {
    console.error('JWT validation handler error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    } as any;
  }
};

export { handler };
