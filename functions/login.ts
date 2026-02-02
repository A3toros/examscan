import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { checkFailedAttemptsRateLimit, createRateLimitResponse, recordFailedAttempt } from './utils/rate-limit.js';
import { getHeaders } from './utils/cors-headers.js';
import { getClientIdentifier } from './utils/clientId.js';
import { NetlifyEvent } from './types.js';

interface LoginData {
  username: string;
  password: string;
}

export async function handler(event: NetlifyEvent) {
  // Get secure headers (CORS + Security headers)
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

  // Check rate limit for failed attempts (10 failed attempts per 15 minutes)
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
    const data: LoginData = JSON.parse(event.body || '{}');
    const { username, password } = data;

    // Support both 'username' field and 'loginIdentifier' field
    const loginIdentifier = username;

    // Validate input
    if (!loginIdentifier || !password) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Username/email and password are required' })
      };
    }

    // Validate input length to prevent DoS attacks
    const MAX_INPUT_LENGTH = 1000;
    if (loginIdentifier.length > MAX_INPUT_LENGTH) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Username/email is too long' })
      };
    }
    if (password.length > MAX_INPUT_LENGTH) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Password is too long' })
      };
    }

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('[AUTH] Login failed: Database not configured');
      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Database configuration error' })
      };
    }

    const sql = neon(databaseUrl);

    // Determine if loginIdentifier is email or username
    const isEmail = loginIdentifier.includes('@');

    // Get user from database
    let userResult;
    try {
      if (isEmail) {
        userResult = await sql`
          SELECT id, email, username, first_name, last_name, role, password_hash
          FROM users
          WHERE email = ${loginIdentifier} AND is_active = true
        `;
      } else {
        userResult = await sql`
          SELECT id, email, username, first_name, last_name, role, password_hash
          FROM users
          WHERE LOWER(username) = LOWER(${loginIdentifier}) AND is_active = true
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
        headers: { ...headers, 'Content-Type': 'application/json' },
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
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Incorrect email or password' })
      };
    }

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'JWT configuration error' })
      };
    }

    // Access Token (24 hours)
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

    // Session Token (7 days)
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

    // Cleanup old sessions in background (keep only 3 most recent)
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
    
    const cookieOptions = [
      `HttpOnly`,
      isProduction ? `Secure` : '',
      `SameSite=${isLocalhost ? 'Lax' : (isProduction ? 'Strict' : 'Lax')}`,
      `Path=/`,
      (cookieDomain && !isLocalhost) ? `Domain=${cookieDomain}` : ''
    ].filter(Boolean).join('; ');

    // For admin users, generate admin token
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
          role: user.role
        },
        token: token,
        sessionToken: sessionToken
      })
    } as any;

  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Login failed. Please try again.' })
    };
  }
}
