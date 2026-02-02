'use client'

import { useEffect } from 'react'
import { preloadAssets } from '@/lib/assetCache'

/**
 * Hook to preload and cache assets on component mount
 */
export function usePreloadAssets(urls: string[]) {
  useEffect(() => {
    preloadAssets(urls)
  }, [urls.join(',')]) // Re-run if URLs change
}

export default usePreloadAssets

