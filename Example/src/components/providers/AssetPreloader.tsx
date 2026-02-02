'use client'

import { useEffect } from 'react'
import { preloadAssets } from '@/lib/assetCache'
import { preloadAllMascotAnimations } from '@/utils/mascotCache'

/**
 * Component to preload critical assets on app initialization
 */
export function AssetPreloader() {
  useEffect(() => {
    // Preload mascot animations FIRST (highest priority - used everywhere)
    // Start immediately without await to begin loading ASAP
    // This needs to happen immediately to avoid loading states
    const preloadPromise = preloadAllMascotAnimations().catch((error) => {
      console.warn('Failed to preload mascot animations:', error)
    })
    
    // Don't await - let it load in background while other assets load

    // Preload critical assets that are used frequently
    const criticalAssets = [
      '/us-flag.png',
      '/thai-flag.png',
      '/logo.webp',
      '/mic-start.png',
      '/mic-stop.png',
      '/favicon/favicon-32x32.png',
    ]

    // Preload in background (non-blocking)
    preloadAssets(criticalAssets).catch((error) => {
      console.warn('Failed to preload some assets:', error)
    })
  }, [])

  return null
}

