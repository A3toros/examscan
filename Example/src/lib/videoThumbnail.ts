/**
 * Generate thumbnail from video at a specific time (middle by default)
 */

/**
 * Generate a thumbnail from a video blob or URL
 * @param videoSource - Blob URL or video URL
 * @param timePercent - Time position as percentage (0-100), default 50 (middle)
 * @returns Data URL of the thumbnail image
 */
export async function generateVideoThumbnail(
  videoSource: string | Blob,
  timePercent: number = 50
): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    
    let objectUrl: string | null = null
    let resolved = false
    
    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
        objectUrl = null
      }
      video.src = ''
      video.load()
      // Remove all event listeners to prevent further callbacks
      video.onloadedmetadata = null
      video.onseeked = null
      video.onerror = null
    }
    
    const resolveOnce = (value: string | null) => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve(value)
      }
    }
    
    video.onloadedmetadata = () => {
      if (resolved) return
      
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        // Seek to the middle (or specified percentage) of the video
        const targetTime = Math.max(0, Math.min(video.duration * (timePercent / 100), video.duration - 0.1))
        video.currentTime = targetTime
      } else {
        // If duration is not available, try to seek to a reasonable time
        video.currentTime = 1
      }
    }

    video.onseeked = () => {
      if (resolved) return
      
      try {
        // Wait a bit to ensure frame is rendered
        setTimeout(() => {
          if (resolved) return
          
          try {
            const canvas = document.createElement('canvas')
            canvas.width = video.videoWidth || 1920
            canvas.height = video.videoHeight || 1080
            
            const ctx = canvas.getContext('2d')
            if (!ctx || video.videoWidth === 0 || video.videoHeight === 0) {
              resolveOnce(null)
              return
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            // Limit thumbnail size to prevent large payloads (max 1920x1080)
            const maxWidth = 1920
            const maxHeight = 1080
            let finalWidth = canvas.width
            let finalHeight = canvas.height
            
            if (finalWidth > maxWidth || finalHeight > maxHeight) {
              const ratio = Math.min(maxWidth / finalWidth, maxHeight / finalHeight)
              finalWidth = Math.floor(finalWidth * ratio)
              finalHeight = Math.floor(finalHeight * ratio)
              
              const resizedCanvas = document.createElement('canvas')
              resizedCanvas.width = finalWidth
              resizedCanvas.height = finalHeight
              const resizedCtx = resizedCanvas.getContext('2d')
              if (resizedCtx) {
                resizedCtx.drawImage(canvas, 0, 0, finalWidth, finalHeight)
                const dataUrl = resizedCanvas.toDataURL('image/jpeg', 0.8)
                resolveOnce(dataUrl)
                return
              }
            }
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
            resolveOnce(dataUrl)
          } catch (e) {
            // Silently fail
            resolveOnce(null)
          }
        }, 100)
      } catch (e) {
        // Silently fail
        resolveOnce(null)
      }
    }

    video.onerror = () => {
      // Silently handle errors - don't log to prevent console spam
      resolveOnce(null)
    }

    // Set video source
    if (videoSource instanceof Blob) {
      objectUrl = URL.createObjectURL(videoSource)
      video.src = objectUrl
    } else {
      video.src = videoSource
    }
    
    // Timeout after 10 seconds to prevent hanging
    setTimeout(() => {
      if (!resolved) {
        resolveOnce(null)
      }
    }, 10000)
  })
}

/**
 * Generate thumbnail using Cloudinary's thumbnail generation (if available)
 * Falls back to client-side generation
 */
export function getCloudinaryThumbnailUrl(videoUrl: string, timePercent: number = 50): string | null {
  try {
    // Check if it's a Cloudinary URL
    if (!videoUrl.includes('res.cloudinary.com')) {
      return null
    }

    // Extract the path from the Cloudinary URL
    // Format: https://res.cloudinary.com/{cloud_name}/video/upload/{transformations}/{public_id}.{format}
    const urlParts = videoUrl.split('/video/upload/')
    if (urlParts.length !== 2) {
      return null
    }

    const [baseUrl, rest] = urlParts
    
    // Extract version and public_id
    // Format: v{version}/{public_id}.{format} or just {public_id}.{format}
    const pathMatch = rest.match(/^(v\d+\/)?(.+)$/)
    if (!pathMatch) {
      return null
    }
    
    const version = pathMatch[1] || ''
    const publicIdWithExt = pathMatch[2]
    const publicId = publicIdWithExt.replace(/\.[^.]+$/, '')
    
    // Generate thumbnail URL using Cloudinary's image transformation from video
    // so_50 means seek offset 50% (middle of video)
    // Using image/upload with video source to extract a frame
    const thumbnailUrl = `${baseUrl}/image/upload/so_${timePercent},w_1080,h_1920,c_fill,q_auto,f_jpg/${version}${publicId}`
    
    return thumbnailUrl
  } catch (e) {
    console.warn('Failed to generate Cloudinary thumbnail URL:', e)
    return null
  }
}
