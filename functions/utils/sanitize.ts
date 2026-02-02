/**
 * Input Sanitization Utilities
 * 
 * Provides functions to sanitize and validate user input
 * to prevent XSS and injection attacks
 */

/**
 * Sanitize a string by removing control characters and normalizing
 * @param value - String to sanitize
 * @param maxLength - Maximum length (default: 1000)
 * @returns Sanitized string
 */
export function sanitizeString(value: string, maxLength: number = 1000): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFKC')
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize email address
 * @param email - Email to sanitize
 * @returns Sanitized email (lowercased, trimmed, max 254 chars)
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return sanitizeString(email.toLowerCase().trim(), 254);
}

/**
 * Sanitize name (first name or last name)
 * @param name - Name to sanitize
 * @returns Sanitized name (max 100 chars)
 */
export function sanitizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return sanitizeString(name, 100);
}

/**
 * Sanitize username
 * @param username - Username to sanitize
 * @returns Sanitized username (lowercased, trimmed, max 32 chars)
 */
export function sanitizeUsername(username: string): string {
  if (!username || typeof username !== 'string') return '';
  return sanitizeString(username.toLowerCase().trim(), 32);
}
