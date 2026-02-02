'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Lottie from 'lottie-react'
import { getCachedMascotAnimation, preloadMascotAnimation, isMascotAnimationCached } from '@/utils/mascotCache'
// Note: mascot-thinking.json will be loaded dynamically and cached

interface MascotThinkingProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  emotion?: 'happy' | 'excited' | 'thinking' | 'celebrating'
  speechText?: string
  className?: string
  animate?: boolean
  alwaysShowSpeech?: boolean // If true, speech bubble is always visible (not just on click)
}

const MascotThinking: React.FC<MascotThinkingProps> = ({
  size = 'md',
  emotion = 'happy',
  speechText,
  className = '',
  animate = true,
  alwaysShowSpeech = false,
}) => {
  const sizeClasses = {
    sm: 'w-16 h-16 md:w-32 md:h-32',
    md: 'w-96 h-96 md:w-80 md:h-80', // 2x bigger on mobile (384px on mobile, 320px on desktop)
    lg: 'w-56 h-56 md:w-96 md:h-96',
    xl: 'w-64 h-64 md:w-[28rem] md:h-[28rem]',
  }

  const animationUrl = '/mascot-thinking.json'
  
  // Check cache synchronously during initialization
  const initialCachedData = getCachedMascotAnimation(animationUrl)
  const hasCachedData = initialCachedData !== undefined && initialCachedData !== null

  const [mounted, setMounted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(hasCachedData)
  const [animationData, setAnimationData] = useState(hasCachedData ? initialCachedData : null)
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

  // Load Lottie animation data (from cache or fetch) - only if not already loaded
  useEffect(() => {
    // If already loaded from cache during initialization, skip
    if (isLoaded && animationData) {
      return
    }

    let isMounted = true

    const loadAnimation = async () => {
      try {
        // Check cache again (might have been loaded by preloader since component mount)
        let data = getCachedMascotAnimation(animationUrl)
        
        if (data === undefined) {
          // Not in cache yet - try to load (will be cached automatically)
          try {
            await preloadMascotAnimation(animationUrl)
            data = getCachedMascotAnimation(animationUrl)
          } catch (error) {
            console.error('Failed to preload mascot-thinking animation:', error)
          }
        }

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
          console.error('Failed to load mascot-thinking animation:', error)
          setIsLoaded(true) // Still set loaded to avoid infinite loading
        }
      }
    }

    loadAnimation()

    return () => {
      isMounted = false
    }
  }, []) // Empty deps - only run once on mount

  return (
    <motion.div
      {...({ className: `relative flex flex-col items-center ${className}` } as any)}
      onClick={handleOutsideClick}
    >
      {/* Speech Bubble - positioned above the mascot */}
      {(showBubble || alwaysShowSpeech) && speechText && (
        <motion.div
          {...({ className: "speech-bubble -mb-1 md:mb-0 z-10 bg-white px-3 py-2 md:px-4 md:py-3 rounded-lg shadow-lg border border-gray-200 max-w-48 min-h-14 flex items-center justify-center" } as any)}
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-xs md:text-sm font-medium text-neutral-800 text-center leading-tight">
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
            {console.log('MascotThinking: Rendering Lottie with data')}
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
            {console.log('MascotThinking: Showing loading state, isLoaded:', isLoaded, 'animationData:', !!animationData)}
            <div className="w-full h-full bg-gray-200 animate-pulse rounded-full flex items-center justify-center">
              <span className="text-xs text-gray-500">Loading...</span>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

export default MascotThinking

