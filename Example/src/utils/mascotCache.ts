/**
 * Mascot Animation Cache
 * Preloads and caches mascot animation JSON files to avoid repeated fetches
 */

interface AnimationCache {
  [key: string]: any | null; // Store animation data or null if failed
}

const animationCache: AnimationCache = {};
const loadingPromises: { [key: string]: Promise<any> | undefined } = {};

// Start preloading immediately when module loads (not in useEffect)
// This ensures animations are available as soon as possible
if (typeof window !== 'undefined') {
  // Only run in browser
  const animations = ['/mascot-thinking.json', '/mascot.json'];
  animations.forEach(url => {
    // Start loading immediately, don't await
    preloadMascotAnimation(url).catch(() => {
      // Silently handle failures
    });
  });
}

/**
 * Preload mascot animation data
 */
export async function preloadMascotAnimation(url: string): Promise<void> {
  if (animationCache[url] !== undefined) {
    // Already loaded or failed
    return;
  }

  const existingPromise = loadingPromises[url];
  if (existingPromise) {
    // Already loading, wait for it
    await existingPromise;
    return;
  }

  // Start loading
  loadingPromises[url] = fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      animationCache[url] = data;
      delete loadingPromises[url];
      return data;
    })
    .catch(error => {
      console.error(`Failed to preload mascot animation from ${url}:`, error);
      animationCache[url] = null; // Mark as failed
      delete loadingPromises[url];
      throw error;
    });

  await loadingPromises[url];
}

/**
 * Get cached mascot animation data
 */
export function getCachedMascotAnimation(url: string): any | null {
  return animationCache[url] !== undefined ? animationCache[url] : undefined;
}

/**
 * Check if animation is cached
 */
export function isMascotAnimationCached(url: string): boolean {
  return animationCache[url] !== undefined;
}

/**
 * Preload all commonly used mascot animations
 */
export async function preloadAllMascotAnimations(): Promise<void> {
  const animations = [
    '/mascot-thinking.json',
    '/mascot.json'
  ];

  // Preload all animations in parallel
  await Promise.allSettled(
    animations.map(url => preloadMascotAnimation(url).catch(() => {
      // Silently handle failures - component will handle fallback
    }))
  );
}

