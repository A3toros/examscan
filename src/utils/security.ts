/**
 * Security utilities for input sanitization and abuse protection
 */

import React from 'react';
import { SECURITY_CONFIG, isSuspiciousUserAgent, isSuspiciousEmailDomain } from './securityConfig';

// Enhanced XSS protection patterns
const XSS_PATTERNS = [
  // Script tags and JavaScript protocols
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
  /data:application\/x-javascript/gi,

  // Event handlers
  /\bon\w+\s*=\s*["'][^"']*["']/gi,
  /\bon\w+\s*=\s*[^>\s]*/gi,

  // HTML injection
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
  /<input\b[^<]*(?:(?!<\/input>)<[^<]*)*<\/input>/gi,
  /<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi,
  /<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi,
  /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
  /<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi,

  // CSS injection
  /expression\s*\(/gi,
  /vbscript\s*:/gi,
  /javascript\s*:/gi,
  /behavior\s*:/gi,
  /moz-binding\s*:/gi,

  // Base64 encoded scripts
  /data:text\/html;base64,[a-zA-Z0-9+/=]+/gi,
  /data:text\/javascript;base64,[a-zA-Z0-9+/=]+/gi,

  // Unicode bypass attempts
  /&#x?[0-9a-f]+;/gi,
  /\\u[0-9a-f]{4}/gi,

  // Template injection
  /\$\{[^}]+\}/g,
  /\{\{[^}]+\}\}/g,
];

const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|delete|update|drop|create|alter|exec|execute)\b)/gi,
  /('|(\\x27)|(\\x2D\\x2D)|(\-\-)|(\\x23)|(\#)|(\%27)|(\%22)|(\%3B)|(\;))/gi,
  /(\b(or|and)\b\s+\d+\s*=\s*\d+)/gi,
  /(\b(or|and)\b\s+['"`]\s*\d+\s*=\s*\d+\s*['"`])/gi,
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//g,
  /\.\\/g,
  /%2e%2e%2f/g,
  /%2e%2e\\/g,
  /\.\.%2f/g,
  /\.\.%5c/g,
];

const SHELL_INJECTION_PATTERNS = [
  /(\||&|;|\$\(|\`)/g,
  /rm\s+/gi,
  /del\s+/gi,
  /format\s+/gi,
  /shutdown\s+/gi,
];

const SPAM_PATTERNS = [
  /\b(?:viagra|casino|lottery|winner|prize)\b/gi,
  /\b(?:buy|cheap|discount|free|guarantee)\b/gi,
  /\b(?:http|https|www\.)\S+/gi, // Basic URL detection
  /\b\d{10,}\b/g, // Long numbers (potentially phone numbers)
];

const PROFANITY_PATTERNS = [
  /\b(?:fuck|shit|cunt|asshole|bastard|bitch|damn|hell)\b/gi,
  /\b(?:nigger|chink|spic|wetback|raghead|heeb)\b/gi,
];

/**
 * Comprehensive XSS sanitization with multiple layers of protection
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';

  let sanitized = input;

  // Layer 1: Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  // Layer 2: Remove dangerous XSS patterns
  XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Layer 3: Encode dangerous HTML entities
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#x60;');

  // Layer 4: Remove excessive whitespace and normalize
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Layer 5: Length limits to prevent DoS
  if (sanitized.length > SECURITY_CONFIG.INPUT_VALIDATION.TEXT_MAX_LENGTH) {
    sanitized = sanitized.substring(0, SECURITY_CONFIG.INPUT_VALIDATION.TEXT_MAX_LENGTH);
  }

  return sanitized;
};

/**
 * Sanitize HTML content for safe rendering (allows limited safe tags)
 */
export const sanitizeHtml = (html: string): string => {
  if (typeof html !== 'string') return '';

  let sanitized = html;

  // First apply general input sanitization
  sanitized = sanitizeInput(sanitized);

  // Allow only safe inline elements (no scripts, no external resources)
  const ALLOWED_TAGS = ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'span'];
  const ALLOWED_ATTRS = ['style', 'class'];

  // Remove all tags except allowed ones
  sanitized = sanitized.replace(/<([^>]+)>/g, (match, tagContent) => {
    const tagMatch = tagContent.match(/^\/?([a-zA-Z]+)(?:\s|$)/);
    if (!tagMatch) return '';

    const tagName = tagMatch[1].toLowerCase();
    if (ALLOWED_TAGS.includes(tagName)) {
      // Clean attributes
      let cleanTag = `<${tagContent.startsWith('/') ? '/' : ''}${tagName}`;

      // Remove dangerous attributes
      const attrRegex = /(\w+)\s*=\s*["']([^"']*)["']/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(tagContent)) !== null) {
        const [, attrName, attrValue] = attrMatch;
        if (ALLOWED_ATTRS.includes(attrName.toLowerCase())) {
          // Sanitize attribute values
          const safeValue = attrValue.replace(/[<>"'&]/g, '');
          cleanTag += ` ${attrName}="${safeValue}"`;
        }
      }

      cleanTag += tagContent.includes('/') || tagContent.startsWith('/') ? ' /' : '';
      cleanTag += '>';
      return cleanTag;
    }
    return '';
  });

  return sanitized;
};

/**
 * Safe URL validation and sanitization
 */
export const sanitizeUrl = (url: string): string | null => {
  if (typeof url !== 'string') return null;

  try {
    const parsedUrl = new URL(url);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return null;
    }

    // Prevent localhost and private IP access
    const hostname = parsedUrl.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
};

/**
 * Validate and sanitize JSON input
 */
export const sanitizeJsonInput = (input: any): any => {
  if (typeof input === 'string') {
    return sanitizeInput(input);
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeJsonInput(item));
  }

  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      // Sanitize keys and values
      const safeKey = sanitizeInput(key);
      const safeValue = sanitizeJsonInput(value);
      if (safeKey) {
        sanitized[safeKey] = safeValue;
      }
    }
    return sanitized;
  }

  return input;
};

/**
 * React hook for secure input handling with XSS protection
 */
export const useSecureInput = () => {
  const [inputValue, setInputValue] = React.useState('');
  const [isValid, setIsValid] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState('');

  const handleInputChange = React.useCallback((value: string) => {
    const sanitized = sanitizeInput(value);

    // Check for suspicious patterns
    const hasXSSPatterns = XSS_PATTERNS.some(pattern => pattern.test(value));
    const hasSQLInjection = SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
    const hasPathTraversal = PATH_TRAVERSAL_PATTERNS.some(pattern => pattern.test(value));

    if (hasXSSPatterns) {
      setIsValid(false);
      setErrorMessage('Input contains potentially dangerous content');
    } else if (hasSQLInjection) {
      setIsValid(false);
      setErrorMessage('Input contains invalid characters');
    } else if (hasPathTraversal) {
      setIsValid(false);
      setErrorMessage('Input contains invalid characters');
    } else {
      setIsValid(true);
      setErrorMessage('');
    }

    setInputValue(sanitized);
  }, []);

  const reset = React.useCallback(() => {
    setInputValue('');
    setIsValid(true);
    setErrorMessage('');
  }, []);

  return {
    value: inputValue,
    isValid,
    errorMessage,
    onChange: handleInputChange,
    setValue: setInputValue,
    reset
  };
};

/**
 * Hook for secure form validation
 */
export const useSecureForm = () => {
  const [formData, setFormData] = React.useState<Record<string, any>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const updateField = React.useCallback((field: string, value: any) => {
    const sanitizedValue = sanitizeJsonInput(value);

    setFormData(prev => ({
      ...prev,
      [field]: sanitizedValue
    }));

    // Clear error for this field
    setErrors(prev => ({
      ...prev,
      [field]: ''
    }));
  }, []);

  const validateForm = React.useCallback((validationRules: Record<string, (value: any) => string | null>) => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    for (const [field, validator] of Object.entries(validationRules)) {
      const error = validator(formData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [formData]);

  const resetForm = React.useCallback(() => {
    setFormData({});
    setErrors({});
  }, []);

  return {
    formData,
    errors,
    updateField,
    validateForm,
    resetForm,
    setErrors
  };
};

/**
 * Create a secure HTML element from sanitized content
 */
export const createSecureHtml = (html: string): { __html: string } => {
  return { __html: sanitizeHtml(html) };
};

/**
 * Validate file upload for XSS and security
 */
export const validateFileUpload = (file: File): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain'
  ];

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push('File size too large (max 10MB)');
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    errors.push('File type not allowed');
  }

  // Check filename for XSS
  const safeName = sanitizeInput(file.name);
  if (safeName !== file.name) {
    errors.push('Filename contains invalid characters');
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * Validate email format and check for abuse patterns
 */
export const validateEmail = (email: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
    return { isValid: false, errors };
  }

  // Basic email format validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }

  // Length checks
  if (email.length > SECURITY_CONFIG.INPUT_VALIDATION.EMAIL_MAX_LENGTH) {
    errors.push(`Email must be no more than ${SECURITY_CONFIG.INPUT_VALIDATION.EMAIL_MAX_LENGTH} characters`);
  }

  // Domain checks
  const domain = email.split('@')[1];
  if (domain) {
    if (domain.length > 253) {
      errors.push('Email domain is too long');
    }

    // Check for suspicious domains
    if (isSuspiciousEmailDomain(email)) {
      errors.push('Email domain not allowed');
    }
  }

  // Check for spam patterns
  SPAM_PATTERNS.forEach(pattern => {
    if (pattern.test(email)) {
      errors.push('Email contains suspicious content');
    }
  });

  return { isValid: errors.length === 0, errors };
};

/**
 * Validate text input for length and content
 */
export const validateTextInput = (
  input: string,
  options: {
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
    checkProfanity?: boolean;
    checkSpam?: boolean;
  } = {}
): { isValid: boolean; errors: string[]; sanitized: string } => {
  const {
    minLength = 1,
    maxLength = 1000,
    allowEmpty = false,
    checkProfanity = true,
    checkSpam = true
  } = options;

  const errors: string[] = [];
  let sanitized = sanitizeInput(input);

  // Length validation
  if (!allowEmpty && (!sanitized || sanitized.length < minLength)) {
    errors.push(`Input must be at least ${minLength} characters`);
  }

  if (sanitized.length > maxLength) {
    errors.push(`Input must be no more than ${maxLength} characters`);
    sanitized = sanitized.substring(0, maxLength);
  }

  // Content validation
  if (checkProfanity) {
    PROFANITY_PATTERNS.forEach(pattern => {
      if (pattern.test(sanitized)) {
        errors.push('Input contains inappropriate content');
      }
    });
  }

  if (checkSpam) {
    SPAM_PATTERNS.forEach(pattern => {
      if (pattern.test(sanitized)) {
        errors.push('Input contains suspicious content');
      }
    });
  }

  // Check for SQL injection patterns
  SQL_INJECTION_PATTERNS.forEach(pattern => {
    if (pattern.test(sanitized)) {
      errors.push('Input contains invalid characters');
    }
  });

  // Check for path traversal
  PATH_TRAVERSAL_PATTERNS.forEach(pattern => {
    if (pattern.test(sanitized)) {
      errors.push('Input contains invalid path characters');
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
};

/**
 * Generate CSRF token
 */
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Validate CSRF token
 */
export const validateCSRFToken = (token: string, storedToken: string): boolean => {
  if (!token || !storedToken) return false;
  return token === storedToken;
};

/**
 * Rate limiting utilities
 */
class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record || now > record.resetTime) {
      // Reset or new record
      this.attempts.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxAttempts) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemainingTime(key: string): number {
    const record = this.attempts.get(key);
    if (!record) return 0;

    const now = Date.now();
    return Math.max(0, record.resetTime - now);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Export rate limiter instances for different actions
export const loginRateLimiter = new RateLimiter(
  SECURITY_CONFIG.RATE_LIMITS.LOGIN.maxAttempts,
  SECURITY_CONFIG.RATE_LIMITS.LOGIN.windowMs
);
export const registrationRateLimiter = new RateLimiter(
  SECURITY_CONFIG.RATE_LIMITS.REGISTRATION.maxAttempts,
  SECURITY_CONFIG.RATE_LIMITS.REGISTRATION.windowMs
);
export const newsletterRateLimiter = new RateLimiter(
  SECURITY_CONFIG.RATE_LIMITS.NEWSLETTER.maxAttempts,
  SECURITY_CONFIG.RATE_LIMITS.NEWSLETTER.windowMs
);
export const generalRateLimiter = new RateLimiter(
  SECURITY_CONFIG.RATE_LIMITS.GENERAL.maxAttempts,
  SECURITY_CONFIG.RATE_LIMITS.GENERAL.windowMs
);

/**
 * Security headers utilities
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'",
};

/**
 * Input validation hook for React components
 */
export const useInputValidation = (initialValue: string = '') => {
  const [value, setValue] = React.useState(initialValue);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [isValid, setIsValid] = React.useState(true);

  const validate = React.useCallback((inputValue: string, validationOptions?: any) => {
    const result = validateTextInput(inputValue, validationOptions);
    setErrors(result.errors);
    setIsValid(result.isValid);
    setValue(result.sanitized);
    return result;
  }, []);

  const setValueAndValidate = React.useCallback((inputValue: string, validationOptions?: any) => {
    const result = validateTextInput(inputValue, validationOptions);
    setErrors(result.errors);
    setIsValid(result.isValid);
    setValue(result.sanitized);
  }, []);

  return {
    value,
    setValue,
    errors,
    isValid,
    validate,
    setValueAndValidate,
    clearErrors: () => setErrors([])
  };
};

/**
 * Generate secure random string
 */
export const generateSecureToken = (length: number = 32): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Check if request is from a suspicious source
 */
export const isSuspiciousRequest = (userAgent: string, ip: string): boolean => {
  // Check for suspicious user agent patterns
  if (isSuspiciousUserAgent(userAgent)) {
    return true;
  }

  // Could add IP reputation checks here
  // For now, just return false
  return false;
};

/**
 * Log security events
 */
export const logSecurityEvent = (event: string, details: any) => {
  console.warn(`[SECURITY] ${event}:`, {
    timestamp: new Date().toISOString(),
    ...details
  });

  // In production, this would send to a logging service
  // logToService('security', event, details);
};
