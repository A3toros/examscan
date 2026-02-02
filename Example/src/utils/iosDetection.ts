/**
 * iOS detection utilities for handling platform-specific MediaRecorder behavior
 */

/**
 * Detects if the current device is iOS (iPhone, iPad, iPod)
 * Includes detection for iPad on iOS 13+ which reports as MacIntel
 */
export const isIOS = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/**
 * Detects if the current browser is Safari
 */
export const isSafari = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium');
};

/**
 * Detects if running on iOS Safari specifically
 */
export const isIOSSafari = (): boolean => {
  return isIOS() && isSafari();
};

/**
 * Get MIME types prioritized for the current platform
 * iOS: MP4 formats only (iOS-compatible)
 * Others: WebM/Opus first (better quality), then MP4 fallback
 */
export const getPlatformMimeTypes = (): string[] => {
  if (isIOS()) {
    // iOS Safari only supports MP4 formats
    return [
      'audio/mp4',                    // Most reliable on iOS
      'audio/mp4;codecs=mp4a.40.2'    // AAC codec (iOS preferred)
    ];
  }
  
  // Android/Desktop: Prioritize WebM/Opus (better quality, smaller files)
  return [
    'audio/webm;codecs=opus',         // Best quality for speech
    'audio/webm',                     // WebM fallback
    'audio/mp4;codecs=mp4a.40.2',    // MP4 AAC fallback
    'audio/mp4'                       // Generic MP4 last resort
  ];
};

/**
 * Get supported MIME type for MediaRecorder with platform-specific priority
 */
export const getSupportedMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser. Please use a modern browser.');
  }

  const mimeTypes = getPlatformMimeTypes();
  
  for (const type of mimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`✅ ${isIOS() ? 'iOS' : 'Non-iOS'}: Using audio format: ${type}`);
      return type;
    }
  }
  
  // If no specific type is supported, try default (may fail on iOS)
  if (isIOS()) {
    throw new Error('MediaRecorder is not fully supported on this iOS version. Please update iOS or use a different browser.');
  }
  
  throw new Error('No supported audio format found. Please update your browser.');
};

/**
 * Get MediaRecorder options optimized for the current platform
 * iOS: Minimal options (no audioBitsPerSecond)
 * Others: Full options for better quality
 */
export const getMediaRecorderOptions = (mimeType: string): MediaRecorderOptions => {
  if (isIOS()) {
    // iOS Safari doesn't support audioBitsPerSecond
    return { mimeType };
  }
  
  // Android/Desktop: Use optimal bitrate for speech
  return {
    mimeType,
    audioBitsPerSecond: 64000 // 64kbps - optimal for speech
  };
};

/**
 * Get getUserMedia audio constraints optimized for the current platform
 * iOS: Minimal constraints (may not support all options)
 * Others: Full constraints for better audio quality
 */
export const getAudioConstraints = (): MediaTrackConstraints => {
  if (isIOS()) {
    // iOS Safari may not support all audio constraints
    return {
      echoCancellation: true
    };
  }
  
  // Android/Desktop: Full audio processing
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  };
};
