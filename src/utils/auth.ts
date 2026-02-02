/**
 * Authentication utilities for HTTP-only cookie-based authentication
 * 
 * Since cookies are HTTP-only, we can't access them directly from JavaScript.
 * We use the /api/auth-me endpoint to get the current user.
 */

// Always use relative paths in development to avoid CORS issues
// In production builds, can use absolute URL if needed
const getApiBaseUrl = () => {
  const isDev = import.meta.env.DEV;
  
  // In development, always use relative path (works with Netlify Dev)
  if (isDev) {
    return '/.netlify/functions';
  }
  
  // In production, check if VITE_API_URL is set
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
    return envUrl.replace(/\/$/, ''); // Remove trailing slash
  }
  
  // Default to relative path (works for both dev and production when deployed)
  return '/.netlify/functions';
};

const API_BASE_URL = getApiBaseUrl();

export interface User {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
  lastLogin: string | null;
  emailVerified: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Get current user from server (cookies are HTTP-only, so we fetch from API)
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/auth-me`, {
      method: 'GET',
      credentials: 'include', // Important: sends cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: AuthResponse = await response.json();
    return data.user || null;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin' || false;
}

/**
 * Login with password
 */
export async function loginWithPassword(
  username: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      credentials: 'include', // Important: receives cookies
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

/**
 * Send OTP for signup/password reset (OTP not used for login - use password login instead)
 */
export async function sendOTP(
  email: string,
  type: 'signup' | 'password_reset'
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Ensure no double slashes in URL
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const url = `${baseUrl}/send-otp`;
    
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, type }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to send OTP';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      return { success: false, error: errorMessage };
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Send OTP error:', error);
    // Handle network errors (server not running, CORS, etc.)
    if (error instanceof TypeError) {
      const isDev = import.meta.env.DEV;
      const errorMsg = isDev 
        ? 'Cannot connect to server. Make sure Netlify Dev is running (run: netlify dev)'
        : 'Network error. Please check your connection.';
      return { success: false, error: errorMsg };
    }
    return { success: false, error: error.message || 'Failed to send OTP' };
  }
}

/**
 * Verify OTP and complete authentication (for signup/password reset only)
 */
export async function verifyOTP(
  email: string,
  code: string,
  type: 'signup' | 'password_reset',
  userData?: {
    firstName?: string;
    lastName?: string;
    username?: string;
    password?: string;
  }
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const body: any = { email, code, type };
    if (userData) {
      Object.assign(body, userData);
    }

    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/verify-otp`, {
      method: 'POST',
      credentials: 'include', // Important: receives cookies
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Verify OTP error:', error);
    return { success: false, error: 'Failed to verify OTP' };
  }
}

/**
 * Logout
 */
export async function logout(): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      credentials: 'include', // Important: sends cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: 'Logout failed' };
  }
}

/**
 * Reset password with OTP
 */
export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/auth-reset-password`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, code, newPassword }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, error: 'Failed to reset password' };
  }
}

/**
 * Change password (authenticated user)
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/auth-change-password`, {
      method: 'POST',
      credentials: 'include', // Important: sends cookies
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, error: 'Failed to change password' };
  }
}

/**
 * Make authenticated API request
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include', // Important: sends cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}
