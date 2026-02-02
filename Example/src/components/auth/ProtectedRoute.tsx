'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinnerModal } from '@/components/ui'
import { apiClient } from '@/lib/api'
import { User } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectTo = '/'
}) => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await apiClient.getCurrentUser()

      if (response.success && response.data?.user) {
        setIsAuthenticated(true)
        setUser(response.data.user)
      } else {
        setIsAuthenticated(false)
        setUser(null)
        router.push(redirectTo)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setIsAuthenticated(false)
      setUser(null)
      router.push(redirectTo)
    } finally {
      setIsLoading(false)
    }
  }, [router, redirectTo])

  useEffect(() => {
    setIsHydrated(true)
    checkAuthStatus()
  }, [checkAuthStatus])

  // During SSR, don't render anything to avoid hydration mismatch
  if (!isHydrated) {
    return null
  }

  // Show loading after hydration while checking authentication
  if (isLoading) {
    return <LoadingSpinnerModal isOpen={true} message="Checking authentication..." />
  }

  if (!isAuthenticated) {
    return null // Will redirect
  }

  // Provide user context to children
  return (
    <UserContext.Provider value={{ user, checkAuthStatus }}>
      {children}
    </UserContext.Provider>
  )
}

// User context for authenticated pages
interface UserContextType {
  user: User | null
  checkAuthStatus: () => Promise<void>
}

export const UserContext = React.createContext<UserContextType | null>(null)

export const useUser = (): UserContextType => {
  const context = React.useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a ProtectedRoute')
  }
  return context
}
