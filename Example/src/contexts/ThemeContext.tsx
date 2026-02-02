'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Theme } from '@/types'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  isLight: boolean
  isCyberpunk: boolean
  isKpop: boolean
  themeClasses: string
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('light')

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('tutorcat-theme') as Theme
    if (savedTheme && ['light', 'cyberpunk', 'kpop'].includes(savedTheme)) {
      setThemeState(savedTheme)
    }
  }, [])

  // Save theme to localStorage when changed
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('tutorcat-theme', newTheme)
  }

  const isLight = theme === 'light'
  const isCyberpunk = theme === 'cyberpunk'
  const isKpop = theme === 'kpop'

  const themeClasses = isCyberpunk
    ? 'bg-black text-cyan-400'
    : isKpop
    ? 'bg-black text-pink-400'
    : 'bg-white text-gray-900'

  const value: ThemeContextType = {
    theme,
    setTheme,
    isLight,
    isCyberpunk,
    isKpop,
    themeClasses,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
