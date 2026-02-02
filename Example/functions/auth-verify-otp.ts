import { Handler } from '@netlify/functions';
import * as jwt from 'jsonwebtoken'
import { neon } from '@neondatabase/serverless'
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { checkFailedAttemptsRateLimit, createRateLimitResponse, recordFailedAttempt } from './rate-limit';
import { getHeaders } from './cors-headers';

interface Env {
  NEON_DATABASE_URL: string
  RESEND_API_KEY: string
  JWT_SECRET: string
  JWT_REFRESH_SECRET: string
  COOKIE_DOMAIN: string
}

// Input sanitization utilities
function sanitizeString(value: string, maxLength: number = 1000): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFKC')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return sanitizeString(email.toLowerCase().trim(), 254);
}

function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return sanitizeString(name, 100);
}

function sanitizeUsername(username: string): string {
  if (!username || typeof username !== 'string') return '';
  return sanitizeString(username.toLowerCase().trim(), 32);
}

// Mock databases (replace with real Neon integration)
const mockUsers = new Map<string, any>()
const mockOTPs = new Map<string, any>()
const mockSessions = new Map<string, any>()

interface RequestBody {
  email: string
  code: string
  type: 'login' | 'signup' | 'password_reset'
  firstName?: string
  lastName?: string
  username?: string
  otp?: string // For password_reset, can use 'otp' instead of 'code'
}

const handler: Handler = async (event, context) => {
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
    } as any;
  }

  // Check rate limit for failed attempts (10 failed attempts per 15 minutes)
  // This prevents brute force attacks on OTP codes
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
      } as any;
    }

    // Sanitize input data
    const email = sanitizeEmail(rawBody.email);
    const code = sanitizeString(rawBody.code || rawBody.otp, 10); // Support both 'code' and 'otp' field names
    const type = sanitizeString(rawBody.type, 20); // Increased from 10 to accommodate 'password_reset' (14 chars)
    const username = rawBody.username ? sanitizeUsername(rawBody.username) : undefined;
    const firstName = rawBody.firstName ? sanitizeName(rawBody.firstName) : undefined;
    const lastName = rawBody.lastName ? sanitizeName(rawBody.lastName) : undefined;
    const password = rawBody.password;

    // Validate input
    if (!email || !code || !type) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required fields' })
      } as any;
    }

    // Validate type
    if (!['login', 'signup', 'password_reset'].includes(type)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid type. Must be "login", "signup", or "password_reset"' })
      } as any;
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid OTP format' })
      } as any;
    }

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('verify-otp: NEON_DATABASE_URL not configured');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Database configuration error' })
      } as any;
    }

    const sql = neon(databaseUrl);

    console.log('verify-otp: Checking OTP in database...');

    // Determine purpose based on type
    const purpose = type === 'signup' ? 'email_verification' : (type === 'password_reset' ? 'password_reset' : 'login');

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'OTP not found or expired. Please request a new verification code.' })
      } as any;
    }

    const otpRecord = otpResult[0];
    console.log('verify-otp: OTP record found');

    // Check if max attempts exceeded
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.log('verify-otp: Max attempts exceeded');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Too many failed attempts. Please request a new verification code.' })
      } as any;
    }

    // Increment attempts
    await sql`
      UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ${otpRecord.id}
    `;

    // Hash the provided OTP with the stored salt
    const providedOtpHash = crypto.createHmac('sha256', otpRecord.otp_salt).update(code).digest('hex');

    // Check if OTP matches
    if (providedOtpHash !== otpRecord.otp_hash) {
      console.log('verify-otp: OTP hash mismatch');
      // Record failed attempt (non-blocking)
      recordFailedAttempt(event, { maxAttempts: 10, windowMs: 900000 }).catch(err => {
        console.error('Failed to record failed OTP attempt:', err);
      });
      const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: `Invalid OTP. ${remainingAttempts} attempts remaining.` })
      } as any;
    }

    console.log('verify-otp: OTP is valid');

    // For password_reset, just verify OTP and return success (don't mark as used yet - that happens in auth-reset-password)
    if (type === 'password_reset') {
      // Don't mark as used - auth-reset-password will do that after password is changed
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'OTP verified successfully. You can now reset your password.'
        })
      } as any;
    }

    // For login and signup, mark OTP as used
    await sql`
      UPDATE otp_verifications
      SET used = TRUE, used_at = CURRENT_TIMESTAMP
      WHERE id = ${otpRecord.id}
    `;

    console.log('verify-otp: OTP marked as used');

    let user;

    if (type === 'login') {
      // For login, find existing user
      console.log('verify-otp: Processing login...');
      const userResult = await sql`
        SELECT id, email, username, first_name, last_name, level, role, current_lesson, total_stars, created_at, last_login, email_verified, eval_test_result
        FROM users
        WHERE email = ${email}
      `;

      if (!userResult || userResult.length === 0) {
        console.log('verify-otp: User not found for login');
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Account not found' })
        } as any;
      }

      user = userResult[0];

      // Update last login
      await sql`
        UPDATE users
        SET last_login = NOW()
        WHERE id = ${user.id}
      `;

    } else if (type === 'signup') {
      // For signup, create new user
      console.log('verify-otp: Processing signup...');

      // Validate signup fields
      if (!firstName || !lastName || !username || !password) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'First name, last name, username, and password are required for signup' })
        } as any;
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Determine role (admin if username is 'admin')
      const userRole = username === 'admin' ? 'admin' : 'user';

      // Create user (level is NULL until evaluation test is completed)
      const newUserResult = await sql`
        INSERT INTO users (
          email,
          username,
          first_name,
          last_name,
          password_hash,
          level,
          role,
          email_verified
        ) VALUES (
          ${email},
          ${username},
          ${firstName},
          ${lastName},
          ${hashedPassword},
          NULL,
          ${userRole},
          true
        )
        RETURNING id, email, username, first_name, last_name, level, role, current_lesson, total_stars, created_at, last_login, email_verified, eval_test_result
      `;

      user = newUserResult[0];
      console.log('verify-otp: New user created:', user.id);
    } else {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid verification type' })
      } as any;
    }

    // Check if user is admin (from database role field)
    const isAdmin = user.role === 'admin';

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('verify-otp: JWT_SECRET not configured');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'JWT configuration error' })
      } as any;
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

    console.log('verify-otp: JWT token generated for user:', user.id, 'role:', isAdmin ? 'admin' : 'user');

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

    console.log('verify-otp: Session created');

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
    
    console.log('Auth-verify-otp: Cookie options:', cookieOptions);
    console.log('Auth-verify-otp: Is localhost?', isLocalhost, 'Is production?', isProduction);

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
    
    console.log('Auth-verify-otp: Setting', setCookieHeaders.length, 'cookies');
    console.log('Auth-verify-otp: Cookie strings:', setCookieHeaders.map(c => c.substring(0, 50) + '...'));

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
        message: type === 'login' ? 'Login successful' : 'Account created successfully',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          level: user.level,
          currentLesson: user.current_lesson,
          totalStars: user.total_stars,
          createdAt: user.created_at,
          lastLogin: user.last_login,
          emailVerified: user.email_verified,
          role: user.role,
          evalTestResult: user.eval_test_result
        },
        token: token,
        sessionToken: sessionToken
        // Admin token is now in cookie, not in response body
      })
    } as any;

  } catch (error) {
    console.error('verify-otp: General error occurred:', error);
    console.error('verify-otp: Error details:', error instanceof Error ? error.message : String(error));
    console.error('verify-otp: Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    } as any;
  }
};

export { handler };
