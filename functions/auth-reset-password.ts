import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { getHeaders } from './utils/cors-headers.js';
import { checkFailedAttemptsRateLimit, createRateLimitResponse, recordFailedAttempt } from './utils/rate-limit.js';
import { sanitizeEmail, sanitizeString } from './utils/sanitize.js';
import { verifyOTP } from './utils/otp.js';
import { NetlifyEvent } from './types.js';

interface RequestBody {
  email: string;
  code: string;
  newPassword: string;
}

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

  // Check rate limit
  const rateLimitResult = await checkFailedAttemptsRateLimit(event, {
    maxAttempts: 10,
    windowMs: 900000 // 15 minutes
  });

  if (!rateLimitResult.allowed) {
    return {
      ...createRateLimitResponse(rateLimitResult),
      headers: {
        ...headers,
        ...createRateLimitResponse(rateLimitResult).headers
      }
    } as any;
  }

  try {
    const data: RequestBody = JSON.parse(event.body || '{}');
    const { email, code, newPassword } = data;

    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedCode = sanitizeString(code, 10);
    const sanitizedPassword = sanitizeString(newPassword, 1000);

    // Validate inputs
    if (!sanitizedEmail || !sanitizedCode || !sanitizedPassword) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Email, code, and new password are required' })
      };
    }

    // Validate OTP format
    if (sanitizedCode.length !== 6 || !/^\d{6}$/.test(sanitizedCode)) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid OTP format' })
      };
    }

    // Validate password length
    if (sanitizedPassword.length < 6) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Password must be at least 6 characters long' })
      };
    }

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Database configuration error' })
      };
    }

    const sql = neon(databaseUrl);

    // Find the OTP for password reset
    const otpResult = await sql`
      SELECT id, otp_hash, otp_salt, expires_at, attempts, max_attempts, used
      FROM otp_verifications
      WHERE identifier = ${sanitizedEmail} 
        AND purpose = 'password_reset' 
        AND used = FALSE 
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (otpResult.length === 0) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'OTP not found or expired. Please request a new verification code.' })
      };
    }

    const otpRecord = otpResult[0];

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Too many failed attempts. Please request a new verification code.' })
      };
    }

    // Increment attempts
    await sql`
      UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ${otpRecord.id}
    `;

    // Verify OTP
    const isValid = verifyOTP(sanitizedCode, otpRecord.otp_hash, otpRecord.otp_salt);

    if (!isValid) {
      recordFailedAttempt(event, { maxAttempts: 10, windowMs: 900000 }).catch(err => {
        console.error('Failed to record failed attempt:', err);
      });
      const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: `Invalid OTP. ${remainingAttempts} attempts remaining.` })
      };
    }

    // Check if user exists
    const userResult = await sql`
      SELECT id FROM users WHERE email = ${sanitizedEmail}
    `;

    if (userResult.length === 0) {
      return {
        statusCode: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'User not found' })
      };
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(sanitizedPassword, saltRounds);

    // Update password
    await sql`
      UPDATE users
      SET password_hash = ${hashedPassword}
      WHERE email = ${sanitizedEmail}
    `;

    // Mark OTP as used
    await sql`
      UPDATE otp_verifications
      SET used = TRUE, used_at = CURRENT_TIMESTAMP
      WHERE id = ${otpRecord.id}
    `;

    // Revoke all existing sessions (force re-login)
    await sql`
      UPDATE users
      SET session_revoked_at = NOW()
      WHERE email = ${sanitizedEmail}
    `;

    await sql`
      DELETE FROM user_sessions
      WHERE user_id = (SELECT id FROM users WHERE email = ${sanitizedEmail})
    `;

    console.log(`[Password Reset] Password reset successful for ${sanitizedEmail}`);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Password reset successfully. Please log in with your new password.'
      })
    };

  } catch (error) {
    console.error('auth-reset-password: Error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
}
