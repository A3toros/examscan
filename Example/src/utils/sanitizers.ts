// Input Sanitization Utilities for TutorCat
// Based on the example's comprehensive sanitization approach

// Basic HTML escaping to prevent XSS when rendering user-provided strings
export function escapeHtml(value: string): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

// Strip HTML tags (defense-in-depth before escaping)
export function stripHtml(value: string): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/<[^>]*>/g, '');
}

// Normalize and sanitize arbitrary text with optional allowlist enforcement
export function sanitizeText(value: string, maxLength: number = 256, options: { allowRegex?: RegExp } = {}): string {
  if (value === null || value === undefined) return '';
  const { allowRegex } = options;
  let cleaned = String(value)
    .normalize('NFKC') // canonicalize to reduce homoglyph tricks
    .replace(CONTROL_CHARS, '');

  // Collapse excessive whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Optional allowlist per-character filter (e.g., names/locations)
  if (allowRegex instanceof RegExp) {
    const tester = new RegExp(allowRegex.source, allowRegex.flags.replace('g', ''));
    cleaned = Array.from(cleaned)
      .filter((ch: string) => tester.test(ch))
      .join('');
  }

  return cleaned.slice(0, maxLength);
}

// Convenience: sanitize then HTML-escape for safe rendering
export function sanitizeForDisplay(value: string, maxLength: number = 256, options: { allowRegex?: RegExp } = {}): string {
  return escapeHtml(sanitizeText(value, maxLength, options));
}

// Sanitize email addresses
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return sanitizeText(email.toLowerCase().trim(), 254, {
    allowRegex: /^[a-zA-Z0-9@._-]+$/
  });
}

// Sanitize names (allow letters, spaces, hyphens, apostrophes)
export function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return sanitizeText(name, 100, {
    allowRegex: /^[a-zA-Z\s\-']+$/
  });
}


// Sanitize URLs (basic URL validation)
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  // Only allow http/https URLs
  const sanitized = sanitizeText(url, 2000);
  if (!/^https?:\/\//i.test(sanitized)) {
    return '';
  }
  return sanitized;
}

// Sanitize general text input (for forms, comments, etc.)
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return '';
  return sanitizeText(input, maxLength);
}

// Sanitize JSON input (for API payloads)
export function sanitizeJsonInput(input: any): any {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    return sanitizeInput(input, 10000);
  }
  if (typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      // Sanitize keys (alphanumeric, underscore, dash only)
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
      sanitized[sanitizedKey] = sanitizeJsonInput(value);
    }
    return sanitized;
  }
  return input;
}

// Deep sanitize object for database insertion
export function sanitizeForDatabase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return sanitizeInput(obj, 10000);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForDatabase(item));
  }
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
      sanitized[sanitizedKey] = sanitizeForDatabase(value);
    }
    return sanitized;
  }
  return obj;
}
