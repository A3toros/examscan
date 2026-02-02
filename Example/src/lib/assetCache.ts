/**
 * Asset Cache Manager
 * Provides localStorage-based caching for small, frequently used assets
 * Falls back to HTTP cache for larger assets
 */

interface CachedAsset {
  data: string // Base64 encoded data
  contentType: string
  timestamp: number
  version: string // Cache version for invalidation
}

const CACHE_VERSION = '1.0.0'
const CACHE_PREFIX = 'tutorcat_asset_'
const MAX_CACHE_SIZE = 5 * 1024 * 1024 // 5MB limit for localStorage
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000 // 30 days

// Small assets that should be cached in localStorage
const CACHEABLE_ASSETS = [
  '/us-flag.png',
  '/thai-flag.png',
  '/logo.webp',
  '/mic-start.png',
  '/mic-stop.png',
  '/favicon/favicon-32x32.png',
  '/favicon/favicon-16x16.png',
]

/**
 * Get cache key for an asset
 */
function getCacheKey(url: string): string {
  return `${CACHE_PREFIX}${url.replace(/[^a-zA-Z0-9]/g, '_')}`
}

/**
 * Check if asset should be cached in localStorage
 */
function shouldCache(url: string): boolean {
  return CACHEABLE_ASSETS.some(asset => url.includes(asset))
}

/**
 * Get total cache size
 */
function getCacheSize(): number {
  let totalSize = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(CACHE_PREFIX)) {
      const value = localStorage.getItem(key)
      if (value) {
        totalSize += key.length + value.length
      }
    }
  }
  return totalSize
}

/**
 * Clean expired or old cache entries
 */
function cleanCache(): void {
  const now = Date.now()
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(CACHE_PREFIX)) {
      try {
        const cached = localStorage.getItem(key)
        if (cached) {
          const asset: CachedAsset = JSON.parse(cached)
          // Remove if expired or wrong version
          if (
            now - asset.timestamp > CACHE_EXPIRY ||
            asset.version !== CACHE_VERSION
          ) {
            keysToRemove.push(key)
          }
        }
      } catch (e) {
        // Invalid cache entry, remove it
        keysToRemove.push(key)
      }
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
}

/**
 * Make room in cache by removing oldest entries
 */
function makeCacheRoom(neededSize: number): void {
  const entries: Array<{ key: string; timestamp: number }> = []

  // Collect all cache entries with timestamps
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(CACHE_PREFIX)) {
      try {
        const cached = localStorage.getItem(key)
        if (cached) {
          const asset: CachedAsset = JSON.parse(cached)
          entries.push({ key, timestamp: asset.timestamp })
        }
      } catch (e) {
        // Invalid entry, remove it
        if (key) localStorage.removeItem(key)
      }
    }
  }

  // Sort by timestamp (oldest first)
  entries.sort((a, b) => a.timestamp - b.timestamp)

  // Remove oldest entries until we have enough space
  let freedSize = 0
  for (const entry of entries) {
    const value = localStorage.getItem(entry.key)
    if (value) {
      localStorage.removeItem(entry.key)
      freedSize += entry.key.length + value.length
      if (freedSize >= neededSize) break
    }
  }
}

/**
 * Convert blob to base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Remove data URL prefix
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Get cached asset from localStorage
 */
export function getCachedAsset(url: string): string | null {
  if (typeof window === 'undefined') return null
  if (!shouldCache(url)) return null

  try {
    const cacheKey = getCacheKey(url)
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null

    const asset: CachedAsset = JSON.parse(cached)

    // Check version and expiry
    if (asset.version !== CACHE_VERSION) {
      localStorage.removeItem(cacheKey)
      return null
    }

    const now = Date.now()
    if (now - asset.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(cacheKey)
      return null
    }

    // Return data URL
    return `data:${asset.contentType};base64,${asset.data}`
  } catch (e) {
    console.warn('Failed to get cached asset:', url, e)
    return null
  }
}

/**
 * Cache asset in localStorage
 */
export async function cacheAsset(url: string): Promise<void> {
  if (typeof window === 'undefined') return
  if (!shouldCache(url)) return

  try {
    // Check if already cached
    if (getCachedAsset(url)) return

    // Fetch asset
    const response = await fetch(url)
    if (!response.ok) {
      console.warn('Failed to fetch asset for caching:', url)
      return
    }

    const blob = await response.blob()
    const contentType = blob.type || response.headers.get('content-type') || 'image/png'
    const base64 = await blobToBase64(blob)

    // Check cache size
    const currentSize = getCacheSize()
    const entrySize = url.length + base64.length + 200 // Rough estimate
    const totalSize = currentSize + entrySize

    if (totalSize > MAX_CACHE_SIZE) {
      // Clean expired entries first
      cleanCache()
      const newSize = getCacheSize()
      if (newSize + entrySize > MAX_CACHE_SIZE) {
        // Still too large, make room
        makeCacheRoom(entrySize)
      }
    }

    // Store in cache
    const cacheKey = getCacheKey(url)
    const cachedAsset: CachedAsset = {
      data: base64,
      contentType,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    }

    localStorage.setItem(cacheKey, JSON.stringify(cachedAsset))
  } catch (e) {
    console.warn('Failed to cache asset:', url, e)
  }
}

/**
 * Preload and cache multiple assets
 */
export async function preloadAssets(urls: string[]): Promise<void> {
  const cacheableUrls = urls.filter(shouldCache)
  await Promise.all(cacheableUrls.map(url => cacheAsset(url)))
}

/**
 * Clear all cached assets
 */
export function clearAssetCache(): void {
  if (typeof window === 'undefined') return

  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  entryCount: number
  totalSize: number
  maxSize: number
  usagePercent: number
} {
  if (typeof window === 'undefined') {
    return { entryCount: 0, totalSize: 0, maxSize: MAX_CACHE_SIZE, usagePercent: 0 }
  }

  let entryCount = 0
  let totalSize = 0

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(CACHE_PREFIX)) {
      entryCount++
      const value = localStorage.getItem(key)
      if (value) {
        totalSize += key.length + value.length
      }
    }
  }

  return {
    entryCount,
    totalSize,
    maxSize: MAX_CACHE_SIZE,
    usagePercent: Math.round((totalSize / MAX_CACHE_SIZE) * 100),
  }
}

/**
 * Initialize cache cleanup on load
 */
if (typeof window !== 'undefined') {
  // Clean expired cache on load
  cleanCache()
}

