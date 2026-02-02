/**
 * Video Cache Manager
 * Provides IndexedDB-based caching for video files
 * Falls back to HTTP cache for uncached videos
 */

interface CachedVideo {
  url: string
  blob: Blob
  timestamp: number
  version: string
}

const CACHE_VERSION = '1.0.0'
const DB_NAME = 'tutorcat_video_cache'
const DB_VERSION = 1
const STORE_NAME = 'videos'
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000 // 30 days

let db: IDBDatabase | null = null

/**
 * Initialize IndexedDB
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }

    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'))
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'url' })
        objectStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

/**
 * Get cached video from IndexedDB
 */
export async function getCachedVideo(url: string): Promise<Blob | null> {
  if (typeof window === 'undefined') return null

  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(url)

      request.onsuccess = () => {
        const cached: CachedVideo | undefined = request.result
        if (!cached) {
          resolve(null)
          return
        }

        // Check version and expiry
        const now = Date.now()
        if (
          cached.version !== CACHE_VERSION ||
          now - cached.timestamp > CACHE_EXPIRY
        ) {
          // Remove expired entry
          deleteCachedVideo(url)
          resolve(null)
          return
        }

        resolve(cached.blob)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  } catch (e) {
    console.warn('Failed to get cached video:', url, e)
    return null
  }
}

/**
 * Cache video in IndexedDB
 */
export async function cacheVideo(url: string, blob: Blob): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      const cachedVideo: CachedVideo = {
        url,
        blob,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      }

      const request = store.put(cachedVideo)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  } catch (e) {
    console.warn('Failed to cache video:', url, e)
  }
}

/**
 * Delete cached video
 */
export async function deleteCachedVideo(url: string): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(url)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  } catch (e) {
    console.warn('Failed to delete cached video:', url, e)
  }
}

/**
 * Fetch and cache video
 */
export async function fetchAndCacheVideo(url: string): Promise<Blob> {
  // Check cache first
  const cached = await getCachedVideo(url)
  if (cached) {
    return cached
  }

  // Fetch video
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.statusText}`)
  }

  const blob = await response.blob()

  // Cache it (don't wait for caching to complete)
  cacheVideo(url, blob).catch((e) => {
    console.warn('Failed to cache video in background:', e)
  })

  return blob
}

/**
 * Preload video (fetch and cache)
 */
export async function preloadVideo(url: string): Promise<void> {
  try {
    await fetchAndCacheVideo(url)
  } catch (e) {
    console.warn('Failed to preload video:', url, e)
  }
}

/**
 * Clear all cached videos
 */
export async function clearVideoCache(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  } catch (e) {
    console.warn('Failed to clear video cache:', e)
  }
}

/**
 * Get cache statistics
 */
export async function getVideoCacheStats(): Promise<{
  entryCount: number
  totalSize: number
}> {
  if (typeof window === 'undefined') {
    return { entryCount: 0, totalSize: 0 }
  }

  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const entries: CachedVideo[] = request.result
        let totalSize = 0

        entries.forEach((entry) => {
          totalSize += entry.blob.size
        })

        resolve({
          entryCount: entries.length,
          totalSize,
        })
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  } catch (e) {
    console.warn('Failed to get video cache stats:', e)
    return { entryCount: 0, totalSize: 0 }
  }
}

/**
 * Clean expired cache entries
 */
export async function cleanVideoCache(): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')
      const now = Date.now()
      const range = IDBKeyRange.upperBound(now - CACHE_EXPIRY)
      const request = index.openCursor(range)

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          const cached: CachedVideo = cursor.value
          if (cached.version !== CACHE_VERSION) {
            cursor.delete()
          }
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  } catch (e) {
    console.warn('Failed to clean video cache:', e)
  }
}

/**
 * Initialize cache cleanup on load
 */
if (typeof window !== 'undefined') {
  // Clean expired cache on load
  cleanVideoCache().catch(() => {
    // Silently fail if IndexedDB is not available
  })
}
