/**
 * Activity Preloader
 * Preloads assets and component code for the next activity in the background
 */

interface ActivityAssets {
  images?: string[]
  audio?: string[]
  json?: string[]
}

/**
 * Get assets needed for a specific activity type
 */
export function getActivityAssets(activityType: string, activityData: any): ActivityAssets {
  const assets: ActivityAssets = {
    images: [],
    audio: [],
    json: []
  }

  switch (activityType) {
    case 'warm_up_speaking':
    case 'speaking_with_feedback':
    case 'speaking_practice':
      // Preload mascot animations for speaking activities
      assets.json?.push('/mascot-thinking.json', '/mascot.json')
      break

    case 'vocabulary_matching_drag':
    case 'vocab_match_drag':
      // Vocabulary matching might have images
      if (activityData?.exercises?.matching) {
        // Extract any image URLs from matching exercises
        // This is a placeholder - adjust based on actual data structure
      }
      break

    case 'vocabulary_fill_blanks':
    case 'vocab_fill_dropdown':
      // Fill blanks activities typically don't need special assets
      break

    case 'grammar_drag_sentence':
    case 'grammar_sentences':
      // Grammar activities typically don't need special assets
      break

    case 'speaking_improvement':
    case 'language_improvement_reading':
      // Preload mascot animations
      assets.json?.push('/mascot-thinking.json', '/mascot.json')
      break
  }

  return assets
}

/**
 * Preload assets using link rel="preload"
 */
export function preloadAssets(assets: ActivityAssets): void {
  if (typeof document === 'undefined') return

  // Remove existing preload links to avoid duplicates
  const existingLinks = document.querySelectorAll('link[rel="preload"][data-activity-preload]')
  existingLinks.forEach(link => link.remove())

  // Preload images
  assets.images?.forEach(url => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = url
    link.setAttribute('data-activity-preload', 'true')
    document.head.appendChild(link)
  })

  // Preload audio
  assets.audio?.forEach(url => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'audio'
    link.href = url
    link.setAttribute('data-activity-preload', 'true')
    document.head.appendChild(link)
  })

  // Preload JSON (for animations, etc.)
  assets.json?.forEach(url => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'fetch'
    link.href = url
    link.crossOrigin = 'anonymous'
    link.setAttribute('data-activity-preload', 'true')
    document.head.appendChild(link)
  })
}

/**
 * Prefetch component code using Next.js router
 * Note: Activity components are already imported, but we can prefetch related routes
 */
export function prefetchActivityComponent(activityType: string, router: any): void {
  if (!router || typeof router.prefetch !== 'function') return

  try {
    // Prefetch dashboard route as users often navigate there after lessons
    const dashboardPrefetch = router.prefetch('/dashboard')
    if (dashboardPrefetch && typeof dashboardPrefetch.catch === 'function') {
      dashboardPrefetch.catch((err: any) => {
        // Silently fail - prefetch is optional
      })
    }

    // Prefetch evaluation route if it exists (for related features)
    const evaluationPrefetch = router.prefetch('/evaluation')
    if (evaluationPrefetch && typeof evaluationPrefetch.catch === 'function') {
      evaluationPrefetch.catch((err: any) => {
        // Silently fail - prefetch is optional
      })
    }
  } catch (error) {
    // Silently fail - prefetch is optional
  }
}

/**
 * Preload next activity when current activity starts
 */
export function preloadNextActivity(
  currentActivityType: string,
  nextActivityType: string | null,
  nextActivityData: any,
  router: any
): void {
  if (!nextActivityType) return

  console.log(`Preloading next activity: ${nextActivityType}`)

  // Get assets for next activity
  const assets = getActivityAssets(nextActivityType, nextActivityData)

  // Preload assets
  preloadAssets(assets)

  // Prefetch component code
  prefetchActivityComponent(nextActivityType, router)
}

