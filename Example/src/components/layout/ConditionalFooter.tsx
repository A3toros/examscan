'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './'

export default function ConditionalFooter() {
  const pathname = usePathname()
  const isAdminRoute = pathname.startsWith('/admin')
  const isLessonRoute = pathname.startsWith('/lessons')
  const isDashboardRoute = pathname.startsWith('/dashboard')

  // Don't render footer for admin routes, lesson routes, or dashboard route
  if (isAdminRoute || isLessonRoute || isDashboardRoute) {
    return null
  }

  return <Footer />
}
