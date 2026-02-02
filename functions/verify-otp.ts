import * as jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { checkFailedAttemptsRateLimit, createRateLimitResponse, recordFailedAttempt } from './utils/rate-limit.js';
import { getHeaders } from './utils/cors-headers.js';
import { sanitizeEmail, sanitizeString, sanitizeName, sanitizeUsername } from './utils/sanitize.js';
import { NetlifyEvent } from './types.js';

interface RequestBody {
  email: string;
  code: string;
  type: 'signup' | 'password_reset';
  firstName?: string;
  lastName?: string;
  username?: string;
  password?: string;
  otp?: string; // For password_reset, can use 'otp' instead of 'code'
}

export async function handler(event: NetlifyEvent) {
  // Get secure headers (CORS + Security headers)
  const headers = getHeaders(event, true); // Allow credentials for auth endpoints

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
    console.log(`Auth-verify-otp: Rate limit exceeded for failed attempts`);
    return {
      ...createRateLimitResponse(rateLimitResult),
      headers: {
        ...headers,
        ...createRateLimitResponse(rateLimitResult).headers
      }
    } as any;
  }

  try {
    let rawBody: any;
    try {
      rawBody = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
      };
    }

    // Sanitize input data
    const email = sanitizeEmail(rawBody.email);
    const code = sanitizeString(rawBody.code || rawBody.otp, 10);
    const type = sanitizeString(rawBody.type, 20);
    const username = rawBody.username ? sanitizeUsername(rawBody.username) : undefined;
    const firstName = rawBody.firstName ? sanitizeName(rawBody.firstName) : undefined;
    const lastName = rawBody.lastName ? sanitizeName(rawBody.lastName) : undefined;
    const password = rawBody.password;

    // Validate input
    if (!email || !code || !type) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      };
    }

    // Validate type (OTP only for signup and password_reset, not login)
    if (!['signup', 'password_reset'].includes(type)) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid type. Must be "signup" or "password_reset"' })
      };
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid OTP format' })
      };
    }

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('verify-otp: NEON_DATABASE_URL not configured');
      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Database configuration error' })
      };
    }

    const sql = neon(databaseUrl);

    // Determine purpose based on type
    const purpose = type === 'signup' ? 'email_verification' : 'password_reset';

    // Find the most recent unused OTP for this email and purpose
    const otpResult = await sql`
      SELECT id, otp_hash, otp_salt, expires_at, attempts, max_attempts, used
      FROM otp_verifications
      WHERE identifier = ${email} AND purpose = ${purpose} AND used = FALSE AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (otpResult.length === 0) {
      console.log('verify-otp: OTP not found or expired');
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'OTP not found or expired. Please request a new verification code.' })
      };
    }

    const otpRecord = otpResult[0];

    // Check if max attempts exceeded
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.log('verify-otp: Max attempts exceeded');
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Too many failed attempts. Please request a new verification code.' })
      };
    }

    // Hash the provided OTP with the stored salt (matching Example project exactly)
    const providedOtpHash = crypto.createHmac('sha256', otpRecord.otp_salt).update(code).digest('hex');

    // Check if OTP matches
    if (providedOtpHash !== otpRecord.otp_hash) {
      console.log('verify-otp: OTP hash mismatch');
      // Increment attempts on failure
      await sql`
        UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ${otpRecord.id}
      `;
      // Record failed attempt (non-blocking)
      recordFailedAttempt(event, { maxAttempts: 10, windowMs: 900000 }).catch(err => {
        console.error('Failed to record failed OTP attempt:', err);
      });
      const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: `Invalid OTP. ${remainingAttempts} attempts remaining.` })
      };
    }

    console.log('verify-otp: OTP is valid');

    // For password_reset, just verify OTP and return success
    if (type === 'password_reset') {
      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'OTP verified successfully. You can now reset your password.'
        })
      };
    }

    // For signup, check if userData is provided
    if (type === 'signup') {
      // If userData is not provided, just verify OTP and return success (don't mark as used yet)
      if (!firstName || !lastName || !username || !password) {
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            message: 'OTP verified successfully. Please complete your registration.'
          })
        };
      }

      // UserData is provided, so mark OTP as used and create account
      await sql`
        UPDATE otp_verifications
        SET used = TRUE, used_at = CURRENT_TIMESTAMP
        WHERE id = ${otpRecord.id}
      `;
    }

    let user;

    if (type === 'signup') {
      // For signup, create new user
      // Validate signup fields (already checked above, but double-check)
      if (!firstName || !lastName || !username || !password) {
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'First name, last name, username, and password are required for signup' })
        };
      }

      // Check if username already exists
      const existingUsername = await sql`
        SELECT id FROM users WHERE username = ${username}
      `;
      if (existingUsername.length > 0) {
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Username already taken' })
        };
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Determine role (admin if username is 'admin')
      const userRole = username === 'admin' ? 'admin' : 'user';

      // Create user
      const newUserResult = await sql`
        INSERT INTO users (
          email,
          username,
          first_name,
          last_name,
          password_hash,
          role,
          email_verified
        ) VALUES (
          ${email},
          ${username},
          ${firstName},
          ${lastName},
          ${hashedPassword},
          ${userRole},
          true
        )
        RETURNING id, email, username, first_name, last_name, role, created_at, last_login, email_verified
      `;

      user = newUserResult[0];
      console.log('verify-otp: New user created:', user.id);
    }

    // Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('verify-otp: JWT_SECRET not configured');
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

    // Set HTTP-only cookies
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
        message: 'Account created successfully',
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
    };

  } catch (error) {
    console.error('verify-otp: General error occurred:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
}
