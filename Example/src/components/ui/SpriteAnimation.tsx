'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SpriteAnimationProps {
  className?: string;
  onAnimationComplete?: () => void;
  autoPlay?: boolean;
  loop?: boolean;
  animationType?: 'once' | 'loop' | 'pingpong';
  frameWidth?: number; // Override default frame width
  frameHeight?: number; // Override default frame height
}

interface AnimationConfig {
  frames: number[];
  frameDuration: number;
  loop: boolean;
}

// Function to extract frames from sprite sheet (like CharacterSprite example)
const loadSpriteSheet = async (
  spritePath: string,
  frameWidth: number,
  frameHeight: number,
  framesPerRow: number,
  frameIndices: number[]
): Promise<HTMLImageElement[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const extractedFrames: HTMLImageElement[] = [];

      frameIndices.forEach(frameIndex => {
        const row = Math.floor(frameIndex / framesPerRow);
        const col = frameIndex % framesPerRow;

        // Set canvas size to frame dimensions
        canvas.width = frameWidth;
        canvas.height = frameHeight;

        // Clear canvas
        ctx.clearRect(0, 0, frameWidth, frameHeight);

        // Draw the specific frame from sprite sheet
        ctx.drawImage(
          img,
          col * frameWidth, // source x
          row * frameHeight, // source y
          frameWidth, // source width
          frameHeight, // source height
          0, // destination x
          0, // destination y
          frameWidth, // destination width
          frameHeight // destination height
        );

        // Create new image from canvas
        const frameImg = new Image();
        frameImg.src = canvas.toDataURL();
        extractedFrames.push(frameImg);
      });

      resolve(extractedFrames);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load sprite sheet: ${spritePath}`));
    };

    img.src = spritePath;
  });
};

const SpriteAnimation: React.FC<SpriteAnimationProps> = ({
  className = '',
  onAnimationComplete,
  autoPlay = false,
  loop = false,
  animationType = 'once',
  frameWidth = 128,
  frameHeight = 128
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isAnimating, setIsAnimating] = useState(autoPlay);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for reverse (pingpong)
  const [extractedFrames, setExtractedFrames] = useState<HTMLImageElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | undefined>(undefined);

  // Sprite configuration - matches your requirements: 20 sprites, 5 per row, 4 rows
  const totalFrames = 20;
  const framesPerRow = 5;
  const totalRows = 4;
  const frameIndices = Array.from({ length: totalFrames }, (_, i) => i);

  // Animation configurations
  const getAnimationConfig = useCallback((): AnimationConfig => {
    switch (animationType) {
      case 'loop':
        return {
          frames: frameIndices,
          frameDuration: 100,
          loop: true
        };
      case 'pingpong':
        return {
          frames: frameIndices,
          frameDuration: 120,
          loop: true
        };
      case 'once':
      default:
        return {
          frames: frameIndices,
          frameDuration: 100,
          loop: false
        };
    }
  }, [animationType, frameIndices]);

  // Load and extract frames from sprite sheet (like CharacterSprite example)
  useEffect(() => {
    const loadFrames = async () => {
      try {
        setIsLoading(true);
        const frames = await loadSpriteSheet(
          '/sprites-main.png',
          frameWidth,
          frameHeight,
          framesPerRow,
          frameIndices
        );
        setExtractedFrames(frames);
        console.log(`Extracted ${frames.length} frames from sprite sheet`);
      } catch (error) {
        console.error('Failed to load sprite frames:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFrames();
  }, [frameWidth, frameHeight, framesPerRow, frameIndices]);

  // Trigger initial appearance animation after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Trigger initial appearance animation after component mounts
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Auto-start animation if requested
  useEffect(() => {
    if (autoPlay && !isAnimating) {
      startAnimation();
    }
  }, [autoPlay]);

  const animate = useCallback((timestamp: number) => {
    if (!lastFrameTimeRef.current) {
      lastFrameTimeRef.current = timestamp;
    }

    const animConfig = getAnimationConfig();
    const elapsed = timestamp - lastFrameTimeRef.current;
    const frameDuration = animConfig.frameDuration;

    if (elapsed >= frameDuration) {
      lastFrameTimeRef.current = timestamp;

      setCurrentFrame(prevFrame => {
        const totalAnimFrames = animConfig.frames.length;

        if (animationType === 'pingpong') {
          // Ping-pong animation: go forward then backward
          const maxFrame = totalAnimFrames - 1;
          let nextFrame = prevFrame + direction;

          if (nextFrame >= maxFrame) {
            nextFrame = maxFrame;
            setDirection(-1); // Start going backward
          } else if (nextFrame <= 0) {
            nextFrame = 0;
            setDirection(1); // Start going forward
          }

          return nextFrame;
        } else {
          // Normal forward animation
          const nextFrame = (prevFrame + 1) % totalAnimFrames;

          // If we've completed one cycle and not looping
          if (nextFrame === 0 && !animConfig.loop) {
            setIsAnimating(false);
            onAnimationComplete?.();
            return totalAnimFrames - 1; // Stay on last frame
          }

          return nextFrame;
        }
      });
    }

    if (isAnimating) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [getAnimationConfig, animationType, direction, isAnimating, onAnimationComplete]);

  const startAnimation = useCallback(() => {
    if (isAnimating) return;

    setIsAnimating(true);
    setCurrentFrame(0);
    setDirection(1); // Reset direction for pingpong
    lastFrameTimeRef.current = undefined;
    animationRef.current = requestAnimationFrame(animate);
  }, [isAnimating, animate]);

  const stopAnimation = useCallback(() => {
    setIsAnimating(false);
    setCurrentFrame(0);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  const handleClick = () => {
    if (isAnimating) {
      stopAnimation();
    } else {
      startAnimation();
    }
  };

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Show loading state while extracting frames
  if (isLoading) {
    return (
      <div
        className={`relative cursor-pointer select-none flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded ${className}`}
        style={{
          width: frameWidth,
          height: frameHeight,
        }}
      >
        <div className="text-sm text-gray-500">Loading frames...</div>
      </div>
    );
  }

  // Get current frame image
  const currentFrameImage = extractedFrames[currentFrame];

  return (
    <div
      className={`relative cursor-pointer select-none ${className}`}
      onClick={handleClick}
      style={{
        width: frameWidth,
        height: frameHeight,
      }}
    >
      {/* Transparent overlay that fades out */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-500 ${
          isVisible ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ zIndex: 1 }}
      />

      {/* Render extracted frame image */}
      {currentFrameImage && (
        <img
          src={currentFrameImage.src}
          alt={`Frame ${currentFrame + 1}`}
          className={`absolute inset-0 transition-transform duration-700 ease-out ${
            isVisible ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{
            width: frameWidth,
            height: frameHeight,
            imageRendering: 'pixelated', // Keep pixel art crisp
            transform: `scaleX(${direction})`, // Flip for pingpong effect
          }}
        />
      )}

      {/* Animation controls and info */}
      <div className="absolute top-1 left-1 text-xs px-1 py-0.5 rounded bg-black/50 text-white">
        {animationType}
      </div>

      <div className="absolute top-1 right-1 text-xs px-1 py-0.5 rounded bg-black/50 text-white">
        {isAnimating ? '▶️' : '⏸️'} {currentFrame + 1}/{totalFrames}
      </div>

      {/* Debug info - extracted frames */}
      <div className="absolute bottom-1 left-1 text-xs px-1 py-0.5 rounded bg-black/50 text-white">
        Extracted: {extractedFrames.length} frames
      </div>

      {/* More debug info */}
      <div className="absolute bottom-1 right-1 text-xs px-1 py-0.5 rounded bg-black/50 text-white">
        Frame {currentFrame}: {Math.floor(currentFrame / framesPerRow)},{currentFrame % framesPerRow}
      </div>

      {/* Hover glow effect */}
      <div
        className="absolute inset-0 rounded opacity-0 hover:opacity-20 transition-opacity duration-200 bg-blue-400 pointer-events-none"
        style={{ zIndex: 2 }}
      />
    </div>
  );
};

export default SpriteAnimation;
