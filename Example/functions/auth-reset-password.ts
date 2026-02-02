import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

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

const handler: Handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };

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
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    } as any;
  }

  try {
    // Parse request body
    let rawBody: any;
    try {
      rawBody = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
      } as any;
    }

    const email = sanitizeEmail(rawBody.email);
    const otp = sanitizeString(rawBody.otp, 10);
    const newPassword = rawBody.newPassword;

    // Validate input
    if (!email || !otp || !newPassword) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Email, OTP, and new password are required' })
      } as any;
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Invalid OTP format' })
      } as any;
    }

    if (newPassword.length < 8) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Password must be at least 8 characters long' })
      } as any;
    }

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('[AUTH] Reset password: Database not configured');
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

    // Get OTP record (must be unused and not expired)
    // Use CURRENT_TIMESTAMP to match the timezone used in auth-verify-otp
    const otpResult = await sql`
      SELECT 
        id,
        identifier,
        purpose,
        otp_hash,
        otp_salt,
        expires_at,
        used,
        attempts,
        max_attempts,
        created_at
      FROM otp_verifications
      WHERE identifier = ${email} 
        AND purpose = 'password_reset'
        AND used = FALSE
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    console.log('[AUTH] Reset password: OTP query result', {
      email,
      found: otpResult.length > 0,
      expiresAt: otpResult.length > 0 ? otpResult[0].expires_at : null,
      now: new Date().toISOString()
    });

    if (otpResult.length === 0) {
      // Check if there's an OTP that exists but is expired or used (for better error messages)
      const allOtps = await sql`
        SELECT expires_at, used, created_at
        FROM otp_verifications
        WHERE identifier = ${email} 
          AND purpose = 'password_reset'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      if (allOtps.length > 0) {
        const latestOtp = allOtps[0];
        const expiresAt = new Date(latestOtp.expires_at);
        const now = new Date();
        const isExpired = expiresAt < now;
        const isUsed = latestOtp.used;
        
        console.log('[AUTH] Reset password: Latest OTP status', {
          email,
          expiresAt: expiresAt.toISOString(),
          now: now.toISOString(),
          isExpired,
          isUsed,
          diffMinutes: (now.getTime() - expiresAt.getTime()) / (1000 * 60),
          createdAt: latestOtp.created_at
        });
        
        if (isExpired) {
          return {
            statusCode: 400,
            headers: {
              ...headers,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ success: false, error: 'Verification code has expired. Please request a new one.' })
          } as any;
        }
        
        if (isUsed) {
          return {
            statusCode: 400,
            headers: {
              ...headers,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ success: false, error: 'This verification code has already been used. Please request a new one.' })
          } as any;
        }
      }
      
      console.log('[AUTH] Reset password: No valid OTP found for email:', email);
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'No valid verification code found. Please request a new one.' })
      } as any;
    }

    const otpRecord = otpResult[0];

    // Additional safety check: verify OTP is not used (shouldn't happen due to SQL filter, but just in case)
    if (otpRecord.used) {
      console.log('[AUTH] Reset password: OTP already used for email:', email);
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'This verification code has already been used. Please request a new one.' })
      } as any;
    }

    // Check if max attempts exceeded
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.log('[AUTH] Reset password: Max attempts exceeded for email:', email);
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Maximum verification attempts exceeded. Please request a new code.' })
      } as any;
    }

    // Verify OTP
    const otpHash = crypto.createHmac('sha256', otpRecord.otp_salt).update(otp).digest('hex');
    if (otpHash !== otpRecord.otp_hash) {
      // Increment attempts
      await sql`
        UPDATE otp_verifications
        SET attempts = attempts + 1
        WHERE id = ${otpRecord.id}
      `;

      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Invalid verification code' })
      } as any;
    }

    // OTP is valid - mark as used and reset password
    await sql`BEGIN`;

    try {
      // Mark OTP as used
      await sql`
        UPDATE otp_verifications
        SET used = TRUE
        WHERE id = ${otpRecord.id}
      `;

      // Get user by email
      const userResult = await sql`
        SELECT id FROM users WHERE email = ${email}
      `;

      if (userResult.length === 0) {
        await sql`ROLLBACK`;
        return {
          statusCode: 404,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ success: false, error: 'User not found' })
        } as any;
      }

      const userId = userResult[0].id;

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await sql`
        UPDATE users
        SET password_hash = ${hashedPassword}
        WHERE id = ${userId}
      `;

      await sql`COMMIT`;

      console.log(`[AUTH] Password reset successful for user: ${email}`);

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: 'Password reset successfully'
        })
      } as any;

    } catch (dbError) {
      await sql`ROLLBACK`;
      throw dbError;
    }

  } catch (error) {
    console.error('[AUTH] Reset password error:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to reset password',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } as any;
  }
};

export { handler };

