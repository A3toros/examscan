/**
 * Security configuration for ExamScan
 */

export const SECURITY_CONFIG = {
  // Rate limiting
  RATE_LIMITS: {
    LOGIN: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
    REGISTRATION: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
    NEWSLETTER: { maxAttempts: 2, windowMs: 24 * 60 * 60 * 1000 }, // 2 attempts per day
    GENERAL: { maxAttempts: 10, windowMs: 60 * 1000 }, // 10 attempts per minute
  },

  // Input validation
  INPUT_VALIDATION: {
    EMAIL_MAX_LENGTH: 254,
    TEXT_MAX_LENGTH: 1000,
    NAME_MAX_LENGTH: 100,
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MAX_LENGTH: 128,
  },

  // Enhanced Content Security Policy (strict XSS protection)
  CSP: {
    'default-src': "'self'",
    'script-src': "'self'",
    'style-src': "'self' 'unsafe-inline'", // Required for Tailwind
    'img-src': "'self' data: https:",
    'font-src': "'self' data:",
    'connect-src': "'self'",
    'media-src': "'self'",
    'object-src': "'none'",
    'frame-src': "'none'",
    'frame-ancestors': "'none'",
    'base-uri': "'self'",
    'form-action': "'self'",
    'upgrade-insecure-requests': '',
    'block-all-mixed-content': '',
  },

  // Security headers
  HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Allow camera access for this app (needed for answer sheet scanning)
    // Keep microphone and geolocation disabled by default
    'Permissions-Policy': 'camera=*, microphone=(), geolocation=()',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  },

  // Suspicious patterns
  SUSPICIOUS_PATTERNS: {
    USER_AGENTS: [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /headless/i,
      /selenium/i,
      /phantom/i,
      /puppeteer/i,
      /chrome-lighthouse/i,
    ],
    DOMAINS: [
      '10minutemail.com',
      'guerrillamail.com',
      'mailinator.com',
      'temp-mail.org',
      'throwaway.email',
    ],
  },

  // Honeypot field name (for bot detection)
  HONEYPOT_FIELD: 'website_url',

  // Session configuration
  SESSION: {
    MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    SECURE: true,
    HTTP_ONLY: true,
    SAME_SITE: 'strict' as const,
  },
};

/**
 * Generate CSP header string
 */
export const generateCSPHeader = (): string => {
  return Object.entries(SECURITY_CONFIG.CSP)
    .map(([directive, value]) => `${directive} ${value}`)
    .join('; ');
};

/**
 * Check if user agent is suspicious
 */
export const isSuspiciousUserAgent = (userAgent: string): boolean => {
  return SECURITY_CONFIG.SUSPICIOUS_PATTERNS.USER_AGENTS.some(pattern =>
    pattern.test(userAgent)
  );
};

/**
 * Check if email domain is suspicious
 */
export const isSuspiciousEmailDomain = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? SECURITY_CONFIG.SUSPICIOUS_PATTERNS.DOMAINS.includes(domain) : false;
};

/**
 * Generate secure random string
 */
export const generateSecureId = (length: number = 32): string => {
  // Use crypto API in the browser (CSPRNG)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
};

/**
 * Validate request origin
 */
export const isValidOrigin = (origin: string, allowedOrigins: string[]): boolean => {
  try {
    const originUrl = new URL(origin);
    return allowedOrigins.some(allowed => {
      const allowedUrl = new URL(allowed);
      return originUrl.hostname === allowedUrl.hostname &&
             originUrl.protocol === allowedUrl.protocol;
    });
  } catch {
    return false;
  }
};
