import { useEffect, useRef } from 'react'

interface Snowflake {
  x: number
  y: number
  size: number
  speed: number
  drift: number // Left-right drift amount
  driftSpeed: number // Speed of drift oscillation
  driftDirection: number // Current drift direction (-1 or 1)
}

interface SnowfallBackgroundProps {
  density?: number // Snowflakes per 10000 pixels
  className?: string
}

export const SnowfallBackground = ({
  density = 0.3, // Low density - not thick
  className = '',
}: SnowfallBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const setCanvasSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    setCanvasSize()
    window.addEventListener('resize', setCanvasSize)

    const snowflakes: Snowflake[] = []
    const numSnowflakes = Math.floor((canvas.width * canvas.height * density) / 10000)

    // Initialize snowflakes
    for (let i = 0; i < numSnowflakes; i++) {
      snowflakes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1, // Small sizes: 1-4px
        speed: Math.random() * 0.5 + 0.3, // Slow speed: 0.3-0.8 px/frame
        drift: Math.random() * 2 - 1, // Random initial drift position
        driftSpeed: Math.random() * 0.02 + 0.01, // Slow drift oscillation
        driftDirection: Math.random() > 0.5 ? 1 : -1, // Random initial direction
      })
    }

    let animationFrameId: number

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#FFFFFF'
      ctx.globalAlpha = 0.8

      snowflakes.forEach((flake) => {
        // Update vertical position (falling down)
        flake.y += flake.speed

        // Update horizontal drift (slight left-right movement)
        flake.drift += flake.driftSpeed * flake.driftDirection
        
        // Reverse direction when drift gets too far
        if (Math.abs(flake.drift) > 1) {
          flake.driftDirection *= -1
        }
        
        // Apply drift to x position
        flake.x += flake.drift * 0.3 // Small horizontal movement

        // Reset if snowflake falls off screen
        if (flake.y > canvas.height) {
          flake.y = 0
          flake.x = Math.random() * canvas.width
        }

        // Wrap around horizontally if needed
        if (flake.x < 0) flake.x = canvas.width
        if (flake.x > canvas.width) flake.x = 0

        // Draw snowflake
        ctx.beginPath()
        ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2)
        ctx.fill()
      })

      ctx.globalAlpha = 1
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', setCanvasSize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [density])

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      style={{ background: 'transparent' }}
    />
  )
}

