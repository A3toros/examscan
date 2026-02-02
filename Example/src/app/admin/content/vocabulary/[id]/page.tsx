'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import AdminProtectedRoute from '@/components/auth/AdminProtectedRoute'

// Dynamically import components that use contexts to avoid SSR issues
const VocabularyEditorContent = dynamic(() => import('./VocabularyEditorContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Loading vocabulary editor...</p>
      </div>
    </div>
  )
})

export default function VocabularyEditorPage() {
  return (
    <AdminProtectedRoute>
      <VocabularyEditorContent />
    </AdminProtectedRoute>
  )
}
