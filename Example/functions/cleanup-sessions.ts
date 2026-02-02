import { Handler, schedule } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

/**
 * Cleanup function to remove expired sessions and old OTP verifications
 * Can be called manually (with admin auth) or scheduled via Netlify scheduled functions
 * 
 * Scheduled to run daily at 3 AM UTC automatically (0 3 * * *)
 * 
 * Best Practices:
 * - Idempotent: Safe to run multiple times (deleting already-deleted sessions is harmless)
 * - Fast: Completes in <10 seconds to avoid timeout
 * - Chunked: Processes in batches if needed (currently not needed for session cleanup)
 * - Logged: All operations are logged for debugging
 */
async function cleanupHandler(event: any, context: any) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Allow both GET (for manual calls) and scheduled events
  // Scheduled events typically have specific headers or come from Netlify's scheduler
  const isScheduled = event.headers?.['x-netlify-scheduled'] === 'true' || 
                     event.headers?.['x-netlify-event'] === 'schedule' ||
                     (context?.awsRequestId && context.awsRequestId.includes('scheduled'));

  // For manual calls, require admin authentication
  if (!isScheduled) {
    // Check admin authentication
    let token = null;
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const cookies = event.headers?.cookie || event.headers?.Cookie || '';
      const cookieArray = cookies.split(';');
      const tokenCookie = cookieArray.find((c: string) => c.trim().startsWith('admin_token='));
      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
      }
    }

    if (!token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Unauthorized - Admin access required for manual cleanup' 
        }),
      };
    }

    // Verify admin token
    try {
      const jwt = await import('jsonwebtoken');
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: 'JWT configuration error' }),
        };
      }

      const decoded = jwt.verify(token, jwtSecret) as any;
      if (decoded.role !== 'admin') {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ success: false, error: 'Forbidden - Admin access required' }),
        };
      }
    } catch (error) {
      console.error('Admin authentication error:', error);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid admin token' }),
      };
    }
  }

  const startTime = Date.now();
  console.log('[Cleanup] Starting session cleanup at', new Date().toISOString());

  try {
    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('[Cleanup] NEON_DATABASE_URL not configured');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Database configuration error' }),
      };
    }

    const sql = neon(databaseUrl);

    // Clean up expired sessions (expires_at < NOW())
    // Idempotent: Safe to run multiple times
    console.log('[Cleanup] Step 1: Cleaning up expired user sessions...');
    const expiredSessionsResult = await sql`
      DELETE FROM user_sessions
      WHERE expires_at < NOW()
      RETURNING id, user_id, expires_at
    `;
    const expiredSessionsCount = expiredSessionsResult.length || 0;
    console.log(`[Cleanup] Deleted ${expiredSessionsCount} expired sessions`);

    // Clean up old sessions (older than 7 days, even if not expired)
    // Idempotent: Safe to run multiple times
    console.log('[Cleanup] Step 2: Cleaning up old sessions (older than 7 days)...');
    const oldSessionsResult = await sql`
      DELETE FROM user_sessions
      WHERE created_at < NOW() - INTERVAL '7 days'
      RETURNING id, user_id, created_at
    `;
    const oldSessionsCount = oldSessionsResult.length || 0;
    console.log(`[Cleanup] Deleted ${oldSessionsCount} old sessions (older than 7 days)`);

    // Clean up excess active sessions - keep only the 3 most recent active sessions per user
    // This prevents session buildup when users log in multiple times
    // Idempotent: Safe to run multiple times (will only delete if >3 exist)
    console.log('[Cleanup] Step 3: Cleaning up excess active sessions (keeping max 3 per user)...');
    const excessSessionsResult = await sql`
      WITH ranked_sessions AS (
        SELECT 
          id,
          user_id,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY user_id 
            ORDER BY created_at DESC
          ) as session_rank
        FROM user_sessions
        WHERE expires_at >= NOW()
      )
      DELETE FROM user_sessions
      WHERE id IN (
        SELECT id FROM ranked_sessions WHERE session_rank > 3
      )
      RETURNING id, user_id, created_at
    `;
    const excessSessionsCount = excessSessionsResult.length || 0;
    console.log(`[Cleanup] Deleted ${excessSessionsCount} excess active sessions (kept 3 most recent per user)`);

    // Clean up old OTP verifications (expired and used)
    // Keep OTPs for 24 hours after expiration for audit purposes, then delete
    // Idempotent: Safe to run multiple times
    console.log('[Cleanup] Step 4: Cleaning up old OTP verifications...');
    const oldOtpsResult = await sql`
      DELETE FROM otp_verifications
      WHERE (expires_at < NOW() - INTERVAL '24 hours' AND used = TRUE)
         OR (expires_at < NOW() - INTERVAL '7 days' AND used = FALSE)
      RETURNING id, identifier, purpose, expires_at, used
    `;
    const oldOtpsCount = oldOtpsResult.length || 0;
    console.log(`[Cleanup] Deleted ${oldOtpsCount} old OTP verifications`);

    // Get current session count for reporting
    const activeSessionsResult = await sql`
      SELECT COUNT(*) as count
      FROM user_sessions
      WHERE expires_at >= NOW()
    `;
    const activeSessionsCount = activeSessionsResult[0]?.count || 0;

    const executionTime = Date.now() - startTime;
    console.log(`[Cleanup] Cleanup completed in ${executionTime}ms. Active sessions remaining: ${activeSessionsCount}`);

    // Return results (important for logging in Netlify dashboard)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Cleanup completed successfully',
        results: {
          expiredSessionsDeleted: expiredSessionsCount,
          oldSessionsDeleted: oldSessionsCount,
          excessSessionsDeleted: excessSessionsCount,
          oldOtpsDeleted: oldOtpsCount,
          activeSessionsRemaining: activeSessionsCount,
          executionTimeMs: executionTime,
          cleanupTime: new Date().toISOString(),
        },
      }),
    };
  } catch (error) {
    const executionTime = Date.now() - (startTime || Date.now());
    console.error('[Cleanup] Error during cleanup:', error);
    console.error('[Cleanup] Execution time before error:', executionTime, 'ms');
    
    // Return error response (important for Netlify logs)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: executionTime,
        cleanupTime: new Date().toISOString(),
      }),
    };
  }
}

// Export handler with schedule - works for both manual calls and scheduled execution
// Cron: 0 3 * * * = Daily at 3 AM UTC
// Netlify's static analyzer detects schedule() when called directly in export
// Manual calls via /.netlify/functions/cleanup-sessions still work because schedule() returns a handler
// 
// Note: Scheduled functions may have ±1-5 minute drift (this is normal for Netlify)
// Function is idempotent, so safe to run multiple times
export const handler = schedule('0 3 * * *', cleanupHandler);

