import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { sendRegistrationConfirmation, sendLoginVerification, sendPasswordResetVerification } from './email-service';
import { checkFailedAttemptsRateLimit, createRateLimitResponse, recordFailedAttempt } from './rate-limit';
import { getHeaders } from './cors-headers';

// Environment variables interface
interface Env {
  NEON_DATABASE_URL: string
  RESEND_API_KEY: string
  JWT_SECRET: string
}

interface RequestBody {
  email: string
  type: 'login' | 'signup' | 'password_reset'
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

/**
 * Send OTP for email verification or login
 * @param {string} email - User's email address
 * @param {string} type - 'login' or 'signup'
 * @returns {Promise<Object>} - Result of OTP sending
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
    const purpose = type === 'signup' ? 'email_verification' : (type === 'password_reset' ? 'password_reset' : 'login');

    // For login and password_reset, check if user exists
    if (type === 'login' || type === 'password_reset') {
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

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Generate salt and hash the OTP
    const salt = crypto.randomBytes(16).toString('hex');
    const otpHash = crypto.createHmac('sha256', salt).update(otp).digest('hex');

    // Set expiration (5 minutes for verification, 10 minutes for login and password reset)
    const expiresAt = new Date(Date.now() + (type === 'signup' ? 5 : 10) * 60 * 1000);

    // Store OTP in database
    await sql`
      INSERT INTO otp_verifications (identifier, purpose, otp_hash, otp_salt, expires_at, max_attempts)
      VALUES (${email}, ${purpose}, ${otpHash}, ${salt}, ${expiresAt.toISOString()}, 5)
    `;

    console.log(`send-otp: OTP generated and stored for ${email}, purpose: ${purpose}`);

    // Send email based on type
    if (type === 'signup') {
      await sendRegistrationConfirmation(email, otp);
    } else if (type === 'password_reset') {
      await sendPasswordResetVerification(email, otp);
    } else {
      await sendLoginVerification(email, otp);
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
    };
  }

  // Check rate limit for OTP sending (10 attempts per 15 minutes)
  // This prevents OTP spam and abuse
  // Note: We use checkFailedAttemptsRateLimit but treat all OTP send requests as "attempts"
  // This is more restrictive than login (which only limits failed attempts)
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
      console.log('send-otp: Received request body:', {
        hasEmail: !!rawBody.email,
        hasType: !!rawBody.type,
        typeValue: rawBody.type,
        rawBodyKeys: Object.keys(rawBody)
      });
    } catch (error) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
      };
    }

    const email = sanitizeEmail(rawBody.email);
    const type = sanitizeString(rawBody.type, 20); // Increased from 10 to accommodate 'password_reset' (14 chars)
    
    console.log('send-otp: After sanitization:', {
      email: email ? `${email.substring(0, 3)}...` : 'empty',
      type: type || 'empty',
      typeLength: type ? type.length : 0
    });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Email is required' })
      };
    }

    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid email format' })
      };
    }

    // Validate type
    const validTypes = ['login', 'signup', 'password_reset'];
    if (!type || !validTypes.includes(type)) {
      console.error('send-otp: Invalid type received', {
        receivedType: rawBody.type,
        sanitizedType: type,
        validTypes
      });
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: `Invalid or missing type. Received: "${rawBody.type || 'undefined'}", Sanitized: "${type || 'empty'}", Must be one of: ${validTypes.join(', ')}` 
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      };
    } catch (otpError: any) {
      console.error('send-otp: Error in sendOTP function:', otpError);
      console.error('send-otp: Error details:', {
        message: otpError.message,
        stack: otpError.stack,
        type: otpError.constructor.name
      });
      
      // Record failed attempt
      recordFailedAttempt(event, { maxAttempts: 10, windowMs: 900000 }).catch(err => {
        console.error('Failed to record failed OTP send attempt:', err);
      });
      
      const errorMessage = otpError.message || 'Failed to send verification code';
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: errorMessage })
      };
    }

  } catch (error: any) {
    console.error('send-otp: Handler error:', error);
    console.error('send-otp: Error stack:', error.stack);

    // Return appropriate error message
    const errorMessage = error.message || 'Internal server error';
    return {
      statusCode: 500, // Use 500 for unexpected server errors
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: errorMessage })
    };
  }
}

export { handler }
