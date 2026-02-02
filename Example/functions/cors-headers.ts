/**
 * CORS and Security Headers Utility
 * 
 * Provides secure CORS configuration and security headers for Netlify Functions
 */

/**
 * Get allowed origin based on request
 * In production, should be the actual domain
 * For development, allow localhost
 */
function getAllowedOrigin(origin: string | undefined): string {
  // In production, use specific allowed origins
  const allowedOrigins = [
    'https://tutorcat.online',
    'https://www.tutorcat.online',
    // Add other production domains here
  ];

  // For development, allow localhost
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3002', 'http://localhost:8888');
  }

  // If origin is in allowed list, return it
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  // Default: return the first allowed origin (or '*' if no origin provided and in dev)
  if (process.env.NODE_ENV !== 'production' && !origin) {
    return '*'; // Allow all in dev when no origin header
  }

  // In production, return the primary domain if origin doesn't match
  return allowedOrigins[0] || 'https://tutorcat.online';
}

/**
 * Get CORS headers
 * @param event - Netlify function event
 * @param allowCredentials - Whether to allow credentials (default: false for security)
 */
export function getCorsHeaders(event: any, allowCredentials: boolean = false): Record<string, string> {
  const origin = event.headers?.origin || event.headers?.Origin;
  const allowedOrigin = getAllowedOrigin(origin);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  // Only allow credentials if origin is specific (not wildcard)
  if (allowCredentials && allowedOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Get security headers
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    // Content-Security-Policy - more permissive for API endpoints
    // API endpoints don't need strict CSP as they return JSON, not HTML
    // The main app's CSP in netlify.toml handles HTML responses
    'Content-Security-Policy': "default-src 'self'",
  };
}

/**
 * Get combined CORS and security headers
 */
export function getHeaders(event: any, allowCredentials: boolean = false): Record<string, string> {
  return {
    ...getCorsHeaders(event, allowCredentials),
    ...getSecurityHeaders(),
  };
}
