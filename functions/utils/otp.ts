/**
 * OTP Generation and Verification Utilities
 * 
 * Provides secure OTP generation and hashing using HMAC-SHA256
 */

import crypto from 'crypto';

export interface OTPResult {
  code: string;
  hash: string;
  salt: string;
}

/**
 * Generate 6-digit OTP
 * @returns 6-digit numeric string (100000-999999)
 */
export function generateOTP(): string {
  // Cryptographically secure 6-digit code
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash OTP with salt using HMAC-SHA256
 * @param otp - OTP code to hash
 * @param salt - Salt for hashing
 * @returns Hexadecimal hash string
 */
export function hashOTP(otp: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(otp).digest('hex');
}

/**
 * Generate OTP with hash and salt
 * @returns Object with plaintext code, hash, and salt
 */
export function generateOTPWithHash(): OTPResult {
  const code = generateOTP();
  const salt = crypto.randomBytes(16).toString('hex'); // 32 hex chars = 16 bytes
  const hash = hashOTP(code, salt);
  
  return { code, hash, salt };
}

/**
 * Verify OTP
 * @param providedCode - OTP code provided by user
 * @param storedHash - Stored hash from database
 * @param storedSalt - Stored salt from database
 * @returns true if OTP is valid
 */
export function verifyOTP(
  providedCode: string, 
  storedHash: string, 
  storedSalt: string
): boolean {
  const providedHash = hashOTP(providedCode, storedSalt);
  return providedHash === storedHash;
}
