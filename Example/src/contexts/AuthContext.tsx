'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check authentication status via API
      const { apiClient } = await import('@/lib/api');
      const response = await apiClient.getCurrentUser();

      if (response.success && response.data?.user) {
        setUser(response.data.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    // This method is not used in our current implementation
    // Login is handled by the LoginModal component
    console.warn('AuthContext.login() is not implemented. Use LoginModal instead.');
  };

  const logout = async () => {
    try {
      const { apiClient } = await import('@/lib/api');
      const response = await apiClient.logout();
      console.log('Logout API response:', response);
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with logout even if API fails
    }

    // Clear local state
    setUser(null);
    setIsAuthenticated(false);

    // Admin tokens are in HTTP cookies, cleared by logout API endpoint

    // Clear auth-related localStorage items, but preserve cookie consent
    // Cookie consent is for essential cookies only and doesn't need to be cleared on logout
    const cookieConsentData = localStorage.getItem('cookie_consent_data')
    
    // Clear all localStorage
    localStorage.clear()
    
    // Restore cookie consent if it existed (essential cookies don't require re-consent)
    if (cookieConsentData) {
      localStorage.setItem('cookie_consent_data', cookieConsentData)
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshAuth: checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
