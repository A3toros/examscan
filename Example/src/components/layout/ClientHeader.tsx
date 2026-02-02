'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useModal } from '@/contexts/ModalContext'
import { useAuth } from '@/contexts/AuthContext'
import Header from './Header'
import LoginModal from '@/components/auth/LoginModal'

export default function ClientHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { showModal } = useModal()
  const { user, isAuthenticated, logout } = useAuth()

  const isLandingPage = pathname === '/'
  const isAdminRoute = pathname.startsWith('/admin')

  // Don't render header for admin routes
  if (isAdminRoute) {
    return null
  }

  const handleLogin = () => {
    if (isLandingPage) {
      // On landing page, show login modal
      showModal({
        component: LoginModal,
        props: {
          onSuccess: () => {
            // Login modal will handle routing based on user role
          }
        }
      })
    } else {
      // On other pages, navigate to landing page for login
      router.push('/')
    }
  }

  const handleSignup = () => {
    router.push('/auth/signup')
  }

  const handleLogout = async () => {
    try {
      await logout();
      // Force redirect to landing page
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even if logout fails
      window.location.href = '/';
    }
  }

  // If user is authenticated, show user header with greeting and logout
  if (isAuthenticated && user) {
    return (
      <Header
        showAuth={false}
        isLoggedIn={true}
        userName={user.username || user.firstName || user.email}
        onLogout={handleLogout}
      />
    )
  }

  // Otherwise show landing page header with login/signup
  return (
    <Header
      showAuth={true}
      onLogin={handleLogin}
      onSignup={handleSignup}
    />
  )
}
