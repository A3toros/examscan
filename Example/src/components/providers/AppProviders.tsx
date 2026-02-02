'use client'

import React from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { NotificationProvider, NotificationContainer } from '@/contexts/NotificationContext'
import { ModalProvider, ModalRenderer } from '@/contexts/ModalContext'
import { AssetPreloader } from './AssetPreloader'

interface AppProvidersProps {
  children: React.ReactNode
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <ModalProvider>
            <AssetPreloader />
            {children}
            <NotificationContainer />
            <ModalRenderer />
          </ModalProvider>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
