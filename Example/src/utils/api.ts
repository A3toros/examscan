// Simple API utility for making authenticated requests
// This is a basic implementation - in a real app you'd use the existing useApi hook

export async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const defaultOptions: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    ...options
  };

  // In a real implementation, you'd get the auth token from cookies/context
  // For now, just make the request
  return fetch(url, defaultOptions);
}
