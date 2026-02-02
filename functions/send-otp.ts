import { neon } from '@neondatabase/serverless';
import { sendRegistrationConfirmation, sendPasswordResetVerification } from './utils/email-service.js';
import { checkFailedAttemptsRateLimit, createRateLimitResponse, recordFailedAttempt } from './utils/rate-limit.js';
import { getHeaders } from './utils/cors-headers.js';
import { sanitizeEmail, sanitizeString } from './utils/sanitize.js';
import { generateOTPWithHash } from './utils/otp.js';
import { NetlifyEvent } from './types.js';

interface RequestBody {
  email: string;
  type: 'signup' | 'password_reset';
}

/**
 * Send OTP for email verification or login
 */
async function sendOTP(email: string, type: string): Promise<{ success: boolean; message: string }> {
  try {
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('send-otp: NEON_DATABASE_URL not configured');
      throw new Error('Database configuration error');
    }

    const sql = neon(databaseUrl);

    // Determine purpose based on type
    const purpose = type === 'signup' ? 'email_verification' : 'password_reset';

    // For password_reset, check if user exists
    if (type === 'password_reset') {
      const userResult = await sql`
        SELECT id FROM users WHERE email = ${email}
      `;
      if (userResult.length === 0) {
        throw new Error('No account found with this email');
      }
    } else if (type === 'signup') {
      // For signup, check if user already exists
      const userResult = await sql`
        SELECT id FROM users WHERE email = ${email}
      `;
      if (userResult.length > 0) {
        throw new Error('Account already exists with this email');
      }
    }

    // Delete any existing unused OTPs for this email and purpose
    await sql`
      DELETE FROM otp_verifications
      WHERE identifier = ${email} AND purpose = ${purpose} AND used = FALSE
    `;

    // Generate OTP with hash
    const { code, hash, salt } = generateOTPWithHash();

    // Set expiration (5 minutes for signup, 10 minutes for password reset)
    const expiresAt = new Date(Date.now() + (type === 'signup' ? 5 : 10) * 60 * 1000);

    // Store OTP in database
    await sql`
      INSERT INTO otp_verifications (identifier, purpose, otp_hash, otp_salt, expires_at, max_attempts)
      VALUES (${email}, ${purpose}, ${hash}, ${salt}, ${expiresAt.toISOString()}, 5)
    `;

    console.log(`send-otp: OTP generated and stored for ${email}, purpose: ${purpose}`);

    // Send email based on type
    if (type === 'signup') {
      await sendRegistrationConfirmation(email, code);
    } else {
      await sendPasswordResetVerification(email, code);
    }

    return {
      success: true,
      message: 'OTP sent successfully'
    };

  } catch (error) {
    console.error('send-otp: Error sending OTP:', error);
    throw error;
  }
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

  // Check rate limit for OTP sending (10 attempts per 15 minutes)
  const rateLimitResult = await checkFailedAttemptsRateLimit(event, {
    maxAttempts: 10,
    windowMs: 900000 // 15 minutes
  });

  if (!rateLimitResult.allowed) {
    console.log(`Auth-send-otp: Rate limit exceeded`);
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

    const email = sanitizeEmail(rawBody.email);
    const type = sanitizeString(rawBody.type, 20);
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Email is required' })
      };
    }

    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid email format' })
      };
    }

    // Validate type (OTP only for signup and password_reset, not login)
    const validTypes = ['signup', 'password_reset'];
    if (!type || !validTypes.includes(type)) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: `Invalid or missing type. Must be one of: ${validTypes.join(', ')}` 
        })
      };
    }

    // Send OTP
    try {
      const result = await sendOTP(email, type);

      // Record attempt (all OTP sends count against rate limit to prevent spam)
      recordFailedAttempt(event, { maxAttempts: 10, windowMs: 900000 }).catch(err => {
        console.error('Failed to record OTP send attempt:', err);
      });

      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      };
    } catch (otpError: any) {
      console.error('send-otp: Error in sendOTP function:', otpError);
      
      // Record failed attempt
      recordFailedAttempt(event, { maxAttempts: 10, windowMs: 900000 }).catch(err => {
        console.error('Failed to record failed OTP send attempt:', err);
      });
      
      const errorMessage = otpError.message || 'Failed to send verification code';
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: errorMessage })
      };
    }

  } catch (error: any) {
    console.error('send-otp: Handler error:', error);

    const errorMessage = error.message || 'Internal server error';
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: errorMessage })
    };
  }
}
