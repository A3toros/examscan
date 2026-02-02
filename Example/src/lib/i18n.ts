import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import language files
import en from '../locales/en/UILanguage.json'
import th from '../locales/th/UILanguage.json'
import enAdmin from '../locales/en/AdminUILanguage.json'
import thAdmin from '../locales/th/AdminUILanguage.json'

const resources = {
  en: {
    translation: en,
    admin: enAdmin,
  },
  th: {
    translation: th,
    admin: thAdmin,
  },
}

// Base configuration
const baseConfig = {
  resources,
  lng: 'en', // default language
  fallbackLng: 'en',

  interpolation: {
    escapeValue: false, // React already does escaping
  },

  react: {
    useSuspense: false,
  },
}

// Server-side configuration (minimal)
if (typeof window === 'undefined') {
  i18n.init(baseConfig)
} else {
  // Client-side configuration (with language detection)
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      ...baseConfig,
      // Language detection options
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        lookupLocalStorage: 'tutorcat-language',
        caches: ['localStorage'],
      },
    })
}

export default i18n
