import i18n from './i18n'

export const getAppLang = (): string => {
  // Check localStorage first
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('tutorcat-language')
    if (stored && ['en', 'th'].includes(stored)) {
      return stored
    }
  }

  // Check navigator language
  if (typeof navigator !== 'undefined') {
    const navLang = navigator.language.split('-')[0]
    if (['en', 'th'].includes(navLang)) {
      return navLang
    }
  }

  // Default to English
  return 'en'
}

export const setAppLang = (lang: 'en' | 'th'): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('tutorcat-language', lang)
  }
  i18n.changeLanguage(lang)
}

export const getAvailableLanguages = () => [
  {
    code: 'en' as const,
    name: 'English',
    flag: '/us-flag.png',
    nativeName: 'English'
  },
  {
    code: 'th' as const,
    name: 'Thai',
    flag: '/thai-flag.png',
    nativeName: 'ไทย'
  }
]

export const getCurrentLanguage = () => {
  // For SSR compatibility, check if i18n is initialized
  const currentLang = (typeof window !== 'undefined' ? i18n.language : null) || getAppLang()
  return getAvailableLanguages().find(lang => lang.code === currentLang)
}

export const isRTL = (lang: string): boolean => {
  // Add RTL language support if needed in the future
  return false
}
