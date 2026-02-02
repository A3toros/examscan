import { useCallback } from 'react';

export const useApi = () => {
  const makeAuthenticatedRequest = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const defaultOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      ...options
    };

    // Add auth headers if needed
    // In a real app, you'd get the token from context/cookies

    return fetch(url, defaultOptions);
  }, []);

  return {
    makeAuthenticatedRequest
  };
};
