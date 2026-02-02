/**
 * Client Identification Utility
 * 
 * Extracts client IP address from request headers
 * for rate limiting and security purposes
 */

/**
 * Get client identifier (IP address) from request
 * @param event - Netlify function event
 * @returns IP address string or null
 */
export function getClientIdentifier(event: any): string | null {
  // Try x-forwarded-for header (most common in proxies)
  const forwarded = event.headers?.['x-forwarded-for'] || 
                    event.headers?.['X-Forwarded-For'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return String(forwarded).split(',')[0].trim();
  }

  // Try x-real-ip header
  const realIp = event.headers?.['x-real-ip'] || 
                 event.headers?.['X-Real-Ip'];
  if (realIp) {
    return String(realIp);
  }

  // Try Cloudflare connecting IP
  const cfConnectingIp = event.headers?.['cf-connecting-ip'] || 
                         event.headers?.['CF-Connecting-Ip'];
  if (cfConnectingIp) {
    return String(cfConnectingIp);
  }

  // Fallback to Netlify context
  if (event.clientContext?.identity?.sourceIp) {
    return event.clientContext.identity.sourceIp;
  }

  return null;
}
