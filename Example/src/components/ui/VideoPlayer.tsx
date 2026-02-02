'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchAndCacheVideo } from '@/lib/videoCache'
import { getCloudinaryThumbnailUrl, generateVideoThumbnail } from '@/lib/videoThumbnail'

interface VideoPlayerProps {
  src: string
  className?: string
  style?: React.CSSProperties
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  controls?: boolean
  playsInline?: boolean
  poster?: string
  onLoadStart?: () => void
  onLoadedData?: () => void
  onError?: (error: Error) => void
  onVideoRef?: (video: HTMLVideoElement | null) => void
}

export default function VideoPlayer({
  src,
  className = '',
  style,
  autoPlay = false,
  loop = false,
  muted = true,
  controls = true,
  playsInline = true,
  poster,
  onLoadStart,
  onLoadedData,
  onError,
  onVideoRef,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const thumbnailAttemptedRef = useRef(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isCached, setIsCached] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(poster || null)

  useEffect(() => {
    let isMounted = true
    let objectUrl: string | null = null

    const loadVideo = async () => {
      try {
        setIsLoading(true)
        setError(null)
        onLoadStart?.()

        // Fetch and cache video
        const blob = await fetchAndCacheVideo(src)
        
        if (!isMounted) return

        // Create object URL from blob
        objectUrl = URL.createObjectURL(blob)
        setVideoUrl(objectUrl)
        setIsLoading(false)
        onLoadedData?.()
      } catch (err) {
        if (!isMounted) return
        
        const error = err instanceof Error ? err : new Error('Failed to load video')
        setError(error)
        setIsLoading(false)
        onError?.(error)
      }
    }

    loadVideo()

    return () => {
      isMounted = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [src, onLoadStart, onLoadedData, onError])

  // Check if video is cached
  useEffect(() => {
    const checkCache = async () => {
      try {
        const { getCachedVideo } = await import('@/lib/videoCache')
        const cached = await getCachedVideo(src)
        setIsCached(!!cached)
      } catch {
        setIsCached(false)
      }
    }
    checkCache()
  }, [src])

  // Generate thumbnail from middle of video if not provided
  useEffect(() => {
    // Reset attempt flag when src changes
    thumbnailAttemptedRef.current = false
    
    if (poster) {
      setThumbnailUrl(poster)
      return
    }

    let isMounted = true

    // Try Cloudinary thumbnail first (faster)
    const cloudinaryThumb = getCloudinaryThumbnailUrl(src, 50)
    if (cloudinaryThumb) {
      // Test if the thumbnail URL works
      const img = new Image()
      let imgLoaded = false
      
      img.onload = () => {
        imgLoaded = true
        if (isMounted) {
          setThumbnailUrl(cloudinaryThumb)
        }
      }
      img.onerror = () => {
        // Cloudinary thumbnail failed, try client-side generation only once
        if (!thumbnailAttemptedRef.current && isMounted && !imgLoaded) {
          thumbnailAttemptedRef.current = true
          generateThumbnailFromVideo()
        }
      }
      img.src = cloudinaryThumb
      return
    }

    // Fallback to client-side generation (only once)
    if (!thumbnailAttemptedRef.current) {
      thumbnailAttemptedRef.current = true
      generateThumbnailFromVideo()
    }

    async function generateThumbnailFromVideo() {
      if (!isMounted || thumbnailAttemptedRef.current === false) return
      
      try {
        // Wait for video to be loaded first
        const { fetchAndCacheVideo } = await import('@/lib/videoCache')
        const blob = await fetchAndCacheVideo(src)
        
        if (!isMounted) return

        // Generate thumbnail from the blob
        const thumb = await generateVideoThumbnail(blob, 50)
        if (thumb && isMounted) {
          setThumbnailUrl(thumb)
        }
      } catch (e) {
        // Silently fail - don't log repeatedly
        // Leave thumbnailUrl as null if generation fails
      }
    }

    return () => {
      isMounted = false
    }
  }, [src, poster])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 rounded-lg ${className}`}>
        <div className="text-center p-8">
          <p className="text-red-600 mb-2">Failed to load video</p>
          <p className="text-sm text-neutral-600">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 rounded-lg z-10">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-neutral-600">
              {isCached ? 'Loading from cache...' : 'Loading video...'}
            </p>
          </div>
        </div>
      )}
      
      {videoUrl && (
        <video
          ref={(el) => {
            videoRef.current = el
            onVideoRef?.(el)
          }}
          src={videoUrl}
          className="w-full h-full object-contain"
          style={{ background: 'transparent', ...style }}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          controls={controls}
          playsInline={playsInline}
          poster={thumbnailUrl || undefined}
          preload="metadata"
        />
      )}
    </div>
  )
}
