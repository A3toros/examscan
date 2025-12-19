/**
 * Authentication utilities for secure token management with cookies
 */

interface AuthTokens {
  token: string;
  user: any;
}

/**
 * Set authentication tokens in secure cookies
 */
export const setAuthCookies = (tokens: AuthTokens): void => {
  const expires = new Date();
  expires.setTime(expires.getTime() + (24 * 60 * 60 * 1000)); // 24 hours

  // Set secure, httpOnly-like cookies (since we can't set httpOnly from client-side,
  // we use secure cookies with SameSite protection)
  document.cookie = `examscan_token=${tokens.token}; expires=${expires.toUTCString()}; path=/; Secure; SameSite=Strict`;
  document.cookie = `examscan_user=${encodeURIComponent(JSON.stringify(tokens.user))}; expires=${expires.toUTCString()}; path=/; Secure; SameSite=Strict`;
};

/**
 * Get authentication tokens from cookies
 */
export const getAuthCookies = (): AuthTokens | null => {
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const token = cookies.examscan_token;
  const userJson = cookies.examscan_user;

  if (!token || !userJson) {
    return null;
  }

  try {
    const user = JSON.parse(decodeURIComponent(userJson));
    return { token, user };
  } catch {
    return null;
  }
};

/**
 * Clear authentication cookies
 */
export const clearAuthCookies = (): void => {
  document.cookie = 'examscan_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; Secure; SameSite=Strict';
  document.cookie = 'examscan_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; Secure; SameSite=Strict';
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return getAuthCookies() !== null;
};

/**
 * Get current user from cookies
 */
export const getCurrentUser = (): any => {
  const auth = getAuthCookies();
  return auth?.user || null;
};

/**
 * Get current token from cookies
 */
export const getCurrentToken = (): string | null => {
  const auth = getAuthCookies();
  return auth?.token || null;
};
