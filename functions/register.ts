/**
 * DEPRECATED: This endpoint is deprecated in favor of OTP-based registration.
 * 
 * Registration now uses a two-step process:
 * 1. POST /api/send-otp with type: 'signup'
 * 2. POST /api/verify-otp with type: 'signup' and user details
 * 
 * This file is kept for backward compatibility but should not be used for new registrations.
 */

import { getHeaders } from './utils/cors-headers.js';
import { NetlifyEvent } from './types.js';

export async function handler(event: NetlifyEvent) {
  const headers = getHeaders(event, true);

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  return {
    statusCode: 410, // Gone - endpoint deprecated
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: false,
      error: 'This registration endpoint is deprecated. Please use the OTP-based registration flow: 1) POST /api/send-otp with type: "signup", 2) POST /api/verify-otp with type: "signup" and user details.'
    })
  };
}
