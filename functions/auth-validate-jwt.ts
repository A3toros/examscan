import * as jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

export interface ValidatedUser {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
  lastLogin: string | null;
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

    // Check token type
    if (decoded.type !== 'access') {
      return { isValid: false, error: 'Invalid token type' };
    }

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('NEON_DATABASE_URL not configured');
      return { isValid: false, error: 'Database configuration error' };
    }

    const sql = neon(databaseUrl);

    // Get user from database
    const userResult = await sql`
      SELECT id, email, username, first_name, last_name, role, created_at, last_login, email_verified, session_revoked_at
      FROM users
      WHERE id = ${decoded.userId} AND is_active = true
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
        role: user.role,
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
 * Extract token from Authorization header or cookies
 */
export function extractTokenFromRequest(event: any): string | null {
  // Try Authorization header first
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Fall back to cookie
  const cookies = event.headers?.cookie || event.headers?.Cookie || '';
  return extractTokenFromCookies(cookies);
}
