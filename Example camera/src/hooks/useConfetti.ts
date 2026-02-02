import { useCallback } from 'react'

export const CONFETTI_EVENT_NAME = 'confetti:fire'

export interface ConfettiColors {
  colors?: string[]
}

export const useConfetti = () => {
  const fire = useCallback((colors?: string[]) => {
    if (typeof window === 'undefined') {
      console.log('[useConfetti] Window not available')
      return
    }
    console.log('[useConfetti] Firing confetti event:', CONFETTI_EVENT_NAME, 'with colors:', colors)
    window.dispatchEvent(new CustomEvent(CONFETTI_EVENT_NAME, { detail: { colors } }))
  }, [])

  return { fire }
}

