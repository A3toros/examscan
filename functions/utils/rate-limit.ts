/**
 * Rate Limiting Utility for Netlify Functions using Upstash Redis
 * 
 * Implements rate limiting using Upstash Redis (serverless Redis)
 * Limits: 10 attempts per 15 minutes per IP address for failed attempts
 * 
 * Setup:
 * 1. Create an Upstash Redis database at https://upstash.com
 * 2. Get your REST API URL and token
 * 3. Set environment variables:
 *    - UPSTASH_REDIS_REST_URL
 *    - UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';
import { getClientIdentifier } from './clientId.js';
import crypto from 'crypto';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // Unix timestamp when limit resets
  retryAfter?: number; // Seconds until retry is allowed
}

export interface RateLimitOptions {
  maxAttempts?: number; // Default: 10
  windowMs?: number; // Default: 900000 (15 minutes)
  identifier?: string; // IP address or user identifier
}

// Initialize Redis client (lazy initialization)
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('Rate limit: Upstash Redis not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
    return null;
  }

  try {
    redisClient = new Redis({
      url,
      token,
    });
    return redisClient;
  } catch (error) {
    console.error('Rate limit: Failed to initialize Redis client:', error);
    return null;
  }
}

/**
 * Check rate limit for failed login attempts
 * This should be checked BEFORE processing login to prevent brute force
 */
export async function checkFailedAttemptsRateLimit(
  event: any,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const {
    maxAttempts = 10,
    windowMs = 900000, // 15 minutes for failed attempts
    identifier
  } = options;

  const clientId = identifier || getClientIdentifier(event);
  
  if (!clientId) {
    // If we can't identify the client, allow the request but log it
    return {
      allowed: true,
      remaining: maxAttempts,
      resetTime: Date.now() + windowMs
    };
  }

  const redis = getRedisClient();
  
  if (!redis) {
    // If Redis is not configured, allow the request but log it
    return {
      allowed: true,
      remaining: maxAttempts,
      resetTime: Date.now() + windowMs
    };
  }

  try {
    // Use a separate key for failed attempts
    const key = `rate_limit:failed:${clientId}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove old entries (outside the window)
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current failed attempts in the window
    const currentCount = await redis.zcard(key) || 0;
    
    // Check if we should allow this request
    const allowed = currentCount < maxAttempts;
    
    // Calculate remaining
    const remaining = Math.max(0, maxAttempts - currentCount);

    // Calculate reset time
    let resetTime = now + windowMs;
    if (!allowed && currentCount > 0) {
      // Get the oldest entry in the window to calculate when it expires
      const oldest = await redis.zrange(key, 0, 0, { withScores: true });
      if (oldest && Array.isArray(oldest) && oldest.length > 0) {
        const firstEntry = oldest[0];
        if (firstEntry && typeof firstEntry === 'object' && 'score' in firstEntry) {
          const oldestScore = firstEntry.score as number;
          if (oldestScore) {
            resetTime = oldestScore + windowMs;
          }
        }
      }
    }

    const retryAfter = allowed ? undefined : Math.ceil((resetTime - now) / 1000);

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter
    };

  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request but log it
    return {
      allowed: true,
      remaining: maxAttempts,
      resetTime: Date.now() + windowMs
    };
  }
}

/**
 * Record a failed login attempt (for rate limiting failed attempts only)
 * This should be called when a login attempt fails
 */
export async function recordFailedAttempt(
  event: any,
  options: RateLimitOptions = {}
): Promise<void> {
  const {
    windowMs = 900000, // 15 minutes for failed attempts (more restrictive)
    identifier
  } = options;

  const clientId = identifier || getClientIdentifier(event);
  
  if (!clientId) {
    return; // Can't track without identifier
  }

  const redis = getRedisClient();
  if (!redis) {
    return; // Can't track without Redis
  }

  try {
    // Use a separate key for failed attempts
    const key = `rate_limit:failed:${clientId}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove old entries (outside the window)
    await redis.zremrangebyscore(key, 0, windowStart);

    // Add current failed attempt
    await redis.zadd(key, { score: now, member: `${now}-${crypto.randomUUID()}` });
    
    // Set expiration on the key
    await redis.expire(key, Math.ceil((windowMs * 2) / 1000));
  } catch (error) {
    console.error('Failed to record failed attempt:', error);
    // Don't throw - this is non-critical
  }
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(result: RateLimitResult): any {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
  };

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  // Calculate minutes until retry
  const minutesUntilRetry = result.retryAfter ? Math.ceil(result.retryAfter / 60) : 15;
  
  // Create a simple, user-friendly error message
  let errorMessage;
  if (minutesUntilRetry > 1) {
    errorMessage = `Too many attempts. Please try again in ${minutesUntilRetry} minutes.`;
  } else if (result.retryAfter && result.retryAfter < 60) {
    errorMessage = `Too many attempts. Please try again in ${result.retryAfter} seconds.`;
  } else {
    errorMessage = `Too many attempts. Please try again in ${minutesUntilRetry} minute.`;
  }
  
  return {
    statusCode: 429,
    headers,
    body: JSON.stringify({
      success: false,
      error: errorMessage,
      retryAfter: result.retryAfter,
      resetTime: new Date(result.resetTime).toISOString(),
      rateLimited: true,
      maxAttempts: 10,
      windowMinutes: 15,
      remainingAttempts: result.remaining,
      retryAfterSeconds: result.retryAfter
    })
  };
}
