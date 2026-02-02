import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

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
    // Get refresh token from cookie
    const cookies = event.headers?.cookie || '';
    const refreshToken = getCookieValue(cookies, 'refresh_token');

    if (refreshToken) {
      // Get database connection
      const databaseUrl = process.env.NEON_DATABASE_URL;
      if (databaseUrl) {
        try {
          const sql = neon(databaseUrl);

          // Find and invalidate the session in database
          await sql`
            UPDATE user_sessions
            SET expires_at = NOW()
            WHERE session_token = ${refreshToken}
              AND expires_at > NOW()
          `;
        } catch (dbError) {
          console.error('Database error during logout:', dbError);
          // Continue with cookie clearing even if database update fails
        }
      }
    }

    // Clear cookies by setting them to expire immediately
    // Use same cookie options as login to ensure they match
    const isProduction = process.env.NODE_ENV === 'production';
    const isLocalhost = !isProduction && (!process.env.COOKIE_DOMAIN || process.env.COOKIE_DOMAIN === 'localhost');
    const cookieDomain = process.env.COOKIE_DOMAIN;
    
    // Match the same cookie options as login
    const cookieOptions = [
      `HttpOnly`,
      isProduction ? `Secure` : null, // Only Secure in production
      `SameSite=${isLocalhost ? 'Lax' : (isProduction ? 'Strict' : 'Lax')}`, // Lax for localhost
      `Path=/`,
      `Max-Age=0`, // Expire immediately
      // Don't set Domain for localhost - causes cookie issues
      (cookieDomain && !isLocalhost) ? `Domain=${cookieDomain}` : null
    ].filter(Boolean).join('; ');
    
    console.log('Auth-logout: Clearing cookies with options:', cookieOptions);

    const clearCookieHeaders = [
      `access_token=; ${cookieOptions}`,
      `session_token=; ${cookieOptions}`,
      `admin_token=; ${cookieOptions}` // Clear admin token cookie too
    ];

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json'
      },
      multiValueHeaders: {
        'Set-Cookie': clearCookieHeaders
      },
      body: JSON.stringify({
        success: true,
        message: 'Logged out successfully'
      })
    } as any;

  } catch (error) {
    console.error('Logout error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Logout failed' })
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
