/**
 * Admin Authentication Utility
 * 
 * Provides functions to verify admin authentication
 */

import * as jwt from 'jsonwebtoken';

/**
 * Extract admin token from request
 */
export function extractAdminToken(event: any): string | null {
  // Try Authorization header first
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Verify it's an admin token
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) return null;
      const decoded = jwt.verify(token, jwtSecret) as any;
      if (decoded.type === 'admin' && decoded.role === 'admin') {
        return token;
      }
    } catch {
      return null;
    }
  }

  // Fall back to cookie
  const cookies = event.headers?.cookie || event.headers?.Cookie || '';
  const cookieArray = cookies.split(';');
  const tokenCookie = cookieArray.find((c: string) => 
    c.trim().startsWith('admin_token=')
  );
  
  if (tokenCookie) {
    const token = tokenCookie.split('=')[1];
    // Verify it's an admin token
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) return null;
      const decoded = jwt.verify(token, jwtSecret) as any;
      if (decoded.type === 'admin' && decoded.role === 'admin') {
        return token;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Verify admin authentication
 */
export async function verifyAdmin(event: any): Promise<boolean> {
  const token = extractAdminToken(event);
  if (!token) return false;

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return false;

    const decoded = jwt.verify(token, jwtSecret) as any;
    return decoded.role === 'admin' && decoded.type === 'admin';
  } catch {
    return false;
  }
}
