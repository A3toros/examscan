import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { getHeaders } from './utils/cors-headers.js';
import { validateJWT, extractTokenFromRequest } from './auth-validate-jwt.js';
import { sanitizeString } from './utils/sanitize.js';
import { NetlifyEvent } from './types.js';

interface RequestBody {
  currentPassword: string;
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

  try {
    // Extract and validate token
    const token = extractTokenFromRequest(event);

    if (!token) {
      return {
        statusCode: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Authentication required' })
      };
    }

    const validation = await validateJWT(token);

    if (!validation.isValid || !validation.user) {
      return {
        statusCode: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: validation.error || 'Invalid token' })
      };
    }

    const data: RequestBody = JSON.parse(event.body || '{}');
    const { currentPassword, newPassword } = data;

    // Sanitize inputs
    const sanitizedCurrentPassword = sanitizeString(currentPassword, 1000);
    const sanitizedNewPassword = sanitizeString(newPassword, 1000);

    // Validate inputs
    if (!sanitizedCurrentPassword || !sanitizedNewPassword) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Current password and new password are required' })
      };
    }

    // Validate new password length
    if (sanitizedNewPassword.length < 6) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'New password must be at least 6 characters long' })
      };
    }

    // Check if new password is different
    if (sanitizedCurrentPassword === sanitizedNewPassword) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'New password must be different from current password' })
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
    const userId = validation.user.id;

    // Get current password hash
    const userResult = await sql`
      SELECT password_hash FROM users WHERE id = ${userId}
    `;

    if (userResult.length === 0) {
      return {
        statusCode: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'User not found' })
      };
    }

    const user = userResult[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(sanitizedCurrentPassword, user.password_hash);

    if (!isValidPassword) {
      return {
        statusCode: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Current password is incorrect' })
      };
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(sanitizedNewPassword, saltRounds);

    // Update password
    await sql`
      UPDATE users
      SET password_hash = ${hashedPassword}
      WHERE id = ${userId}
    `;

    // Revoke all existing sessions (force re-login with new password)
    await sql`
      UPDATE users
      SET session_revoked_at = NOW()
      WHERE id = ${userId}
    `;

    await sql`
      DELETE FROM user_sessions
      WHERE user_id = ${userId}
    `;

    console.log(`[Password Change] Password changed successfully for user ${userId}`);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Password changed successfully. Please log in with your new password.'
      })
    };

  } catch (error) {
    console.error('auth-change-password: Error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
}
