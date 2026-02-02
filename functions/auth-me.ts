import { getHeaders } from './utils/cors-headers.js';
import { validateJWT, extractTokenFromRequest } from './auth-validate-jwt.js';
import { NetlifyEvent } from './types.js';

export async function handler(event: NetlifyEvent) {
  // Get secure headers
  const headers = getHeaders(event, true);

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Extract token from request
    const token = extractTokenFromRequest(event);

    if (!token) {
      return {
        statusCode: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Authentication required' })
      };
    }

    // Validate JWT
    const validation = await validateJWT(token);

    if (!validation.isValid) {
      return {
        statusCode: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: validation.error || 'Invalid token' })
      };
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        user: validation.user
      })
    };

  } catch (error) {
    console.error('auth-me: Error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    };
  }
}
