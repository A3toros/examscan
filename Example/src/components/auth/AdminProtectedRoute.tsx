'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'

interface AdminProtectedRouteProps {
  children: React.ReactNode
}

/**
 * AdminProtectedRoute: Protects admin routes by checking authentication
 * - Allows access if user role is 'admin' OR admin tokens exist
 * - Shows loading state while checking
 * - Only redirects if user is confirmed NOT admin
 */
const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Set a timeout to prevent infinite loading (e.g., if admin token expired)
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.warn('AdminProtectedRoute: Timeout waiting for admin auth, redirecting...')
        setIsLoading(false)
        setIsAuthenticated(false)
        window.location.href = '/'
      }
    }, 5000) // 5 second timeout

    const checkAdminAuth = async () => {
      // Wait for auth context to finish loading
      if (authLoading) {
        setIsLoading(true)
        return
      }

      // Check 1: User role from auth context (most reliable)
      if (user?.role === 'admin') {
        // User is admin - admin token is in HTTP cookie (set by backend)
        // Cookies are sent automatically with API requests, no need to check localStorage
        // But verify admin token is still valid by making a test API call
        try {
          const { adminApiRequest } = await import('@/utils/adminApi')
          // Make a lightweight test call to verify admin token is valid
          const testResponse = await Promise.race([
            adminApiRequest('/.netlify/functions/admin-get-stats?period=week', { method: 'GET' }),
            new Promise<Response>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 3000)
            )
          ])
          
          if (testResponse.status === 401) {
            // Admin token expired - will be handled by adminApiRequest redirect
            clearTimeout(timeoutId)
            return
          }
          
          // Admin token is valid
          clearTimeout(timeoutId)
          setIsAuthenticated(true)
          setIsLoading(false)
          return
        } catch (error) {
          // API call failed (401 or timeout) - admin token likely expired
          // adminApiRequest will handle redirect, but clear timeout and exit
          clearTimeout(timeoutId)
          console.warn('AdminProtectedRoute: Admin token verification failed', error)
          return
        }
      }

      // Check 3: Fetch user from API if not in context
      if (!user) {
        try {
          const response = await apiClient.getCurrentUser()
          if (response.success && response.data?.user) {
            const currentUser = response.data.user
            if (currentUser.role === 'admin') {
              // Admin user but no token - this shouldn't happen, but allow access
              console.warn('AdminProtectedRoute: Admin user from API but no token in localStorage')
              setIsAuthenticated(true)
              setIsLoading(false)
              return
            }
          }
        } catch (error) {
          console.error('AdminProtectedRoute: Failed to check user', error)
          // If API call fails, don't keep loading forever
          clearTimeout(timeoutId)
          setIsLoading(false)
          setIsAuthenticated(false)
          // Redirect after a short delay to allow any pending redirects to complete
          setTimeout(() => {
            if (window.location.pathname.startsWith('/admin')) {
              window.location.href = '/'
            }
          }, 100)
          return
        }
      }

      // Check 4: User is loaded and confirmed NOT admin
      if (user && user.role && user.role !== 'admin') {
        // User is confirmed not admin - redirect to home
        clearTimeout(timeoutId)
        setIsAuthenticated(false)
        setIsLoading(false)
        window.location.href = '/'
        return
      }

      // Check 5: If we've been loading for too long (e.g., admin token expired), redirect
      // This prevents infinite loading state
      if (!user && !authLoading) {
        // No user and auth finished loading - likely not authenticated
        clearTimeout(timeoutId)
        setIsAuthenticated(false)
        setIsLoading(false)
        setTimeout(() => {
          if (window.location.pathname.startsWith('/admin')) {
            window.location.href = '/'
          }
        }, 100)
        return
      }

      // Still loading or waiting for user data
      setIsLoading(true)
    }

    checkAdminAuth()
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [user, authLoading])

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Verifying admin access...</p>
        </div>
      </div>
    )
  }

  // Not authenticated - return null (will redirect via useEffect)
  if (!isAuthenticated) {
    return null
  }

  // Authenticated - render children
  return <>{children}</>
}

export default AdminProtectedRoute

