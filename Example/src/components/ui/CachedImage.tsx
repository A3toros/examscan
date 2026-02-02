'use client'

import React, { useState, useEffect, ImgHTMLAttributes } from 'react'
import { getCachedAsset, cacheAsset } from '@/lib/assetCache'

interface CachedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string
  fallback?: string
}

/**
 * Image component with localStorage caching support
 * Automatically uses cached version if available, otherwise fetches and caches
 */
export const CachedImage: React.FC<CachedImageProps> = ({
  src,
  fallback,
  alt,
  className,
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string>(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadImage = async () => {
      try {
        setIsLoading(true)
        setHasError(false)

        // Try to get from cache first
        const cached = getCachedAsset(src)
        if (cached) {
          if (isMounted) {
            setImageSrc(cached)
            setIsLoading(false)
          }
          // Prefetch and update cache in background
          cacheAsset(src).catch(() => {})
          return
        }

        // Not in cache, use original src
        // Cache it in background
        cacheAsset(src).catch(() => {})

        if (isMounted) {
          setImageSrc(src)
          setIsLoading(false)
        }
      } catch (error) {
        console.warn('Failed to load cached image:', error)
        if (isMounted) {
          setImageSrc(fallback || src)
          setIsLoading(false)
          setHasError(true)
        }
      }
    }

    loadImage()

    return () => {
      isMounted = false
    }
  }, [src, fallback])

  if (hasError && fallback) {
    return (
      <img
        src={fallback}
        alt={alt}
        className={className}
        {...props}
      />
    )
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      style={{
        opacity: isLoading ? 0 : 1,
        transition: 'opacity 0.2s',
        ...props.style,
      }}
      {...props}
    />
  )
}

export default CachedImage

