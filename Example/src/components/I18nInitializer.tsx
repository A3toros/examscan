'use client'

import { useEffect } from 'react'
import i18n from '../lib/i18n'

export default function I18nInitializer() {
  useEffect(() => {
    // Initialize i18n on client side only
    if (typeof window !== 'undefined' && !i18n.isInitialized) {
      i18n.init()
    }
  }, [])

  return null
}
