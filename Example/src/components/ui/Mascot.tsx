'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Lottie from 'lottie-react'
import { getCachedMascotAnimation, preloadMascotAnimation, isMascotAnimationCached } from '@/utils/mascotCache'
// Note: mascot.json will be loaded dynamically and cached

interface MascotProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  emotion?: 'happy' | 'excited' | 'thinking' | 'celebrating'
  speechText?: string
  className?: string
  animate?: boolean
  alwaysShowSpeech?: boolean // If true, speech bubble is always visible (not just on click)
}

const Mascot: React.FC<MascotProps> = ({
  size = 'md',
  emotion = 'happy',
  speechText,
  className = '',
  animate = true,
  alwaysShowSpeech = false,
}) => {
  const sizeClasses = {
    sm: 'w-16 h-16 md:w-16 md:h-16',
    md: 'w-48 h-48 md:w-24 md:h-24', // Larger on mobile for better visibility
    lg: 'w-56 h-56 md:w-32 md:h-32',
    xl: 'w-64 h-64 md:w-48 md:h-48',
  }

  const [mounted, setMounted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [animationData, setAnimationData] = useState(null)
  const [showBubble, setShowBubble] = useState(alwaysShowSpeech) // Initialize based on alwaysShowSpeech

  useEffect(() => {
    setMounted(true)
  }, [])

  // Update showBubble when alwaysShowSpeech changes
  useEffect(() => {
    if (alwaysShowSpeech) {
      setShowBubble(true)
    }
  }, [alwaysShowSpeech])

  const handleMascotClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowBubble(!showBubble)
  }

  const handleOutsideClick = (e: React.MouseEvent) => {
    // Close bubble if clicking outside the mascot area
    if (e.target === e.currentTarget) {
      setShowBubble(false)
    }
  }

  // Load Lottie animation data (from cache or fetch)
  useEffect(() => {
    let isMounted = true
    const animationUrl = '/mascot.json'

    const loadAnimation = async () => {
      try {
        // Check cache first
        const cachedData = getCachedMascotAnimation(animationUrl)
        if (cachedData !== undefined) {
          if (cachedData !== null && isMounted) {
            // Cache hit - use cached data
            setAnimationData(cachedData)
            setIsLoaded(true)
            return
          } else {
            // Cache indicates failure
            setIsLoaded(true)
            return
          }
        }

        // Not in cache - try to load (will be cached automatically)
        if (!isMascotAnimationCached(animationUrl)) {
          await preloadMascotAnimation(animationUrl)
        }

        // Get from cache after preload
        const data = getCachedMascotAnimation(animationUrl)
        if (isMounted) {
          if (data !== null && data !== undefined) {
            setAnimationData(data)
            setIsLoaded(true)
          } else {
            setIsLoaded(true) // Mark as loaded even if failed
          }
        }
      } catch (error: any) {
        if (isMounted) {
          console.error('Failed to load mascot animation:', error)
          setIsLoaded(true) // Still set loaded to avoid infinite loading
        }
      }
    }

    loadAnimation()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <motion.div
      {...({ className: `relative flex flex-col items-center ${className}` } as any)}
      onClick={handleOutsideClick}
    >
      {/* Speech Bubble - positioned above the mascot */}
      {(showBubble || alwaysShowSpeech) && speechText && (
        <motion.div
          {...({ className: "speech-bubble mb-2 z-10 bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200 max-w-48 min-h-14 flex items-center justify-center" } as any)}
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-sm font-medium text-neutral-800 text-center leading-tight">
            {mounted ? (
              speechText.split('\n').map((line, index) => (
                <div key={index}>{line}</div>
              ))
            ) : (
              <>
                <div>Meow!</div>
                <div>Welcome to TutorCat!</div>
              </>
            )}
          </div>
        </motion.div>
      )}
      
      {/* Mascot Lottie Animation */}
      <motion.div
        {...({ className: `${sizeClasses[size]} relative cursor-pointer` } as any)}
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.2 }}
        onClick={handleMascotClick}
      >
        {isLoaded && animationData ? (
          <>
            {console.log('Mascot: Rendering Lottie with data')}
            <Lottie
              animationData={animationData}
              loop={animate}
              autoplay={animate}
              className="w-full h-full"
              style={{ imageRendering: 'auto' }}
            />
          </>
        ) : (
          <>
            {console.log('Mascot: Showing loading state, isLoaded:', isLoaded, 'animationData:', !!animationData)}
            <div className="w-full h-full bg-gray-200 animate-pulse rounded-full flex items-center justify-center">
              <span className="text-xs text-gray-500">Loading...</span>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

export default Mascot
