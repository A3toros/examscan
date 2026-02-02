import { neon } from '@neondatabase/serverless';
import { getHeaders } from './utils/cors-headers.js';
import { validateJWT, extractTokenFromRequest } from './auth-validate-jwt.js';
import { NetlifyEvent } from './types.js';

export async function handler(event: NetlifyEvent) {
  // Get secure headers
  const headers = getHeaders(event, true);

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Extract token from request
    const token = extractTokenFromRequest(event);

    if (!token) {
      // Even without token, clear cookies
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Set-Cookie': [
            'access_token=; HttpOnly; Path=/; Max-Age=0',
            'session_token=; HttpOnly; Path=/; Max-Age=0',
            'admin_token=; HttpOnly; Path=/; Max-Age=0'
          ].join(', ')
        },
        body: JSON.stringify({
          success: true,
          message: 'Logged out successfully'
        })
      };
    }

    // Validate JWT to get user ID
    const validation = await validateJWT(token);
    
    if (validation.isValid && validation.user) {
      const databaseUrl = process.env.NEON_DATABASE_URL;
      if (databaseUrl) {
        const sql = neon(databaseUrl);
        const userId = validation.user.id;

        // Revoke all sessions for this user
        await sql`
          UPDATE users
          SET session_revoked_at = NOW()
          WHERE id = ${userId}
        `;

        // Delete all sessions for this user
        await sql`
          DELETE FROM user_sessions
          WHERE user_id = ${userId}
        `;

        console.log(`[Logout] Revoked all sessions for user ${userId}`);
      }
    }

    // Clear cookies
    const isProduction = process.env.NODE_ENV === 'production';
    const isLocalhost = !isProduction && (!process.env.COOKIE_DOMAIN || process.env.COOKIE_DOMAIN === 'localhost');
    const cookieDomain = process.env.COOKIE_DOMAIN;
    
    const cookieOptions = [
      `HttpOnly`,
      isProduction ? `Secure` : null,
      `SameSite=${isLocalhost ? 'Lax' : (isProduction ? 'Strict' : 'Lax')}`,
      `Path=/`,
      (cookieDomain && !isLocalhost) ? `Domain=${cookieDomain}` : null
    ].filter(Boolean).join('; ');

    const setCookieHeaders = [
      `access_token=; ${cookieOptions}; Max-Age=0`,
      `session_token=; ${cookieOptions}; Max-Age=0`,
      `admin_token=; ${cookieOptions}; Max-Age=0`
    ];

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      multiValueHeaders: {
        'Set-Cookie': setCookieHeaders
      },
      body: JSON.stringify({
        success: true,
        message: 'Logged out successfully'
      })
    } as any;

  } catch (error) {
    console.error('Logout error:', error);

    // Still clear cookies even on error
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Set-Cookie': [
          'access_token=; HttpOnly; Path=/; Max-Age=0',
          'session_token=; HttpOnly; Path=/; Max-Age=0',
          'admin_token=; HttpOnly; Path=/; Max-Age=0'
        ].join(', ')
      },
      body: JSON.stringify({
        success: true,
        message: 'Logged out successfully'
      })
    };
  }
}
