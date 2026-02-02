import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { checkFailedAttemptsRateLimit, createRateLimitResponse, recordFailedAttempt } from './rate-limit';
import { getHeaders } from './cors-headers';

// Helper to get client identifier (duplicated from rate-limit for use in logging)
function getClientIdentifier(event: any): string {
  const forwarded = event.headers?.['x-forwarded-for'] || event.headers?.['X-Forwarded-For'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return event.headers?.['x-real-ip'] || event.headers?.['X-Real-Ip'] || event.clientContext?.identity?.sourceIp || 'unknown';
}

const handler: Handler = async (event, context) => {
  // Only log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Auth-login: Function called with method:', event.httpMethod)
  }

  // Get secure headers (CORS + Security headers)
  // Allow credentials for auth endpoints, but only with specific origins
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
    console.log('Auth-login: Method not allowed:', event.httpMethod)
    return {
      statusCode: 405,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  // Check rate limit for failed attempts (10 failed attempts per 15 minutes)
  // This prevents brute force attacks while allowing unlimited successful logins
  const rateLimitResult = await checkFailedAttemptsRateLimit(event, {
    maxAttempts: 10,
    windowMs: 900000 // 15 minutes for failed attempts
  });

  if (!rateLimitResult.allowed) {
    console.log(`Auth-login: Rate limit exceeded for failed attempts from ${getClientIdentifier(event)}`);
    return {
      ...createRateLimitResponse(rateLimitResult),
      headers: {
        ...headers,
        ...createRateLimitResponse(rateLimitResult).headers
      }
    } as any;
  }

  try {
    // Parse request body
    const { username, password } = JSON.parse(event.body || '{}');

    // Support both old 'username' field and new 'loginIdentifier' field for backward compatibility
    const loginIdentifier = username;

    // Validate input
    if (!loginIdentifier || !password) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Username/email and password are required' })
      };
    }

    // Validate input length to prevent DoS attacks
    const MAX_INPUT_LENGTH = 1000; // Reasonable limit for username/email and password
    if (loginIdentifier.length > MAX_INPUT_LENGTH) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Username/email is too long' })
      };
    }
    if (password.length > MAX_INPUT_LENGTH) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Password is too long' })
      };
    }

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('[AUTH] Login failed: Database not configured');
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

    // Determine if loginIdentifier is email or username
    const isEmail = loginIdentifier.includes('@');

    // Get user from database
    let userResult;
    try {
      if (isEmail) {
        // Query by email (case sensitive)
        userResult = await sql`
          SELECT id, email, username, first_name, last_name, level, role, password_hash, eval_test_result
          FROM users
          WHERE email = ${loginIdentifier}
        `;
      } else {
        // Query by username (convert to lowercase for case-insensitive matching)
        userResult = await sql`
          SELECT id, email, username, first_name, last_name, level, role, password_hash, eval_test_result
          FROM users
          WHERE LOWER(username) = LOWER(${loginIdentifier})
        `;
      }
    } catch (dbError) {
      console.error('[AUTH] Login failed: Database query error:', dbError);
      throw new Error('Database query failed');
    }

    if (!userResult || userResult.length === 0) {
      console.log('[AUTH] Login failed: User not found:', loginIdentifier);
      // Record failed attempt (non-blocking)
      recordFailedAttempt(event, { maxAttempts: 10, windowMs: 900000 }).catch(err => {
        console.error('Failed to record failed attempt:', err);
      });
      return {
        statusCode: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Incorrect email or password' })
      };
    }

    const user = userResult[0];

    // Verify password
    let isValidPassword = false;
    try {
      isValidPassword = await bcrypt.compare(password, user.password_hash);
    } catch (bcryptError) {
      console.error('[AUTH] Login failed: Password verification error:', bcryptError);
      throw new Error('Password verification failed');
    }
    if (!isValidPassword) {
      console.log('[AUTH] Login failed: Invalid password for user:', user.id);
      // Record failed attempt (non-blocking)
      recordFailedAttempt(event, { maxAttempts: 10, windowMs: 900000 }).catch(err => {
        console.error('Failed to record failed attempt:', err);
      });
      return {
        statusCode: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Incorrect email or password' })
      };
    }

    // Generate JWT token
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
      };
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'access'
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Create session
    const sessionToken = jwt.sign(
      {
        userId: user.id,
        type: 'session'
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    const sessionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create new session
    await sql`
      INSERT INTO user_sessions (user_id, session_token, expires_at)
      VALUES (${user.id}, ${sessionToken}, ${sessionExpires.toISOString()})
    `;

    // Revoke old sessions in background (non-blocking)
    // Keep only 3 most recent sessions per user (including the one we just created)
    // This runs asynchronously and won't block the login response
    sql`
      WITH ranked_sessions AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY created_at DESC
          ) as session_rank
        FROM user_sessions
        WHERE user_id = ${user.id} AND expires_at >= NOW()
      )
      DELETE FROM user_sessions
      WHERE id IN (
        SELECT id FROM ranked_sessions WHERE session_rank > 3
      )
      RETURNING id
    `.then((result) => {
      const deletedCount = result?.length || 0;
      if (deletedCount > 0) {
        console.log(`[Cleanup] Deleted ${deletedCount} excess session(s) for user ${user.id}`);
      }
    }).catch((error) => {
      // Log error but don't fail login
      console.error('[Cleanup] Session revocation error:', error);
    });

    // Update last login
    await sql`
      UPDATE users
      SET last_login = NOW()
      WHERE id = ${user.id}
    `;

    // Set HTTP-only cookies
    const isProduction = process.env.NODE_ENV === 'production';
    const isLocalhost = !isProduction && (!process.env.COOKIE_DOMAIN || process.env.COOKIE_DOMAIN === 'localhost');
    const cookieDomain = process.env.COOKIE_DOMAIN;
    
    // For localhost: Use SameSite=Lax (works without HTTPS)
    // For production: Use SameSite=Strict with Secure
    // Note: SameSite=None requires Secure, which requires HTTPS (not available on localhost)
    const cookieOptions = [
      `HttpOnly`,
      isProduction ? `Secure` : null, // Only Secure in production (requires HTTPS)
      `SameSite=${isLocalhost ? 'Lax' : (isProduction ? 'Strict' : 'Lax')}`, // Lax works for localhost
      `Path=/`,
      // Don't set Domain for localhost - causes cookie issues
      (cookieDomain && !isLocalhost) ? `Domain=${cookieDomain}` : null
    ].filter(Boolean).join('; ');

    // For admin users, generate admin token and set as cookie
    let adminToken = null;
    let adminCookie = '';
    if (user.role === 'admin') {
      adminToken = jwt.sign(
        {
          email: user.email,
          role: 'admin',
          type: 'admin'
        },
        jwtSecret,
        { expiresIn: '8h' }
      );
      // Set admin token as HTTP-only cookie
      adminCookie = `admin_token=${adminToken}; ${cookieOptions}; Max-Age=28800`; // 8 hours
    }

    const setCookieHeaders = [
      `access_token=${token}; ${cookieOptions}; Max-Age=86400`, // 24 hours
      `session_token=${sessionToken}; ${cookieOptions}; Max-Age=604800`, // 7 days
      adminCookie
    ].filter(Boolean);

    // Netlify Functions supports multiValueHeaders for multiple Set-Cookie headers
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
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          level: user.level,
          role: user.role,
          evalTestResult: user.eval_test_result
        },
        token: token,
        sessionToken: sessionToken
        // Admin token is now in cookie, not in response body
      })
    } as any;

  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: false, error: 'Login failed. Please try again.' })
    };
  }
};

export { handler };
