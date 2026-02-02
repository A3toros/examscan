import { useEffect, useMemo, useRef, useState } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadBasic } from '@tsparticles/basic'
import { loadEmittersPlugin } from '@tsparticles/plugin-emitters'
import { loadLifeUpdater } from '@tsparticles/updater-life'
import { loadRotateUpdater } from '@tsparticles/updater-rotate'
import { CONFETTI_EVENT_NAME } from '../../hooks/useConfetti'

const loadFull = async (engine: any): Promise<void> => {
  await loadBasic(engine)
  await loadEmittersPlugin(engine)
  await loadLifeUpdater(engine)
  await loadRotateUpdater(engine)
}

const ConfettiOverlay = () => {
  const [visible, setVisible] = useState(false)
  const [burstKey, setBurstKey] = useState(0)
  const timeoutRef = useRef<number | null>(null)
  const [engineReady, setEngineReady] = useState(false)
  const visibleRef = useRef(false)
  const isSettingTimeoutRef = useRef(false)
  const timeoutStartTimeRef = useRef<number | null>(null)
  const timeoutGenerationRef = useRef(0)

  useEffect(() => {
    console.log('[ConfettiOverlay] Initializing particles engine...')
    initParticlesEngine(async (engine) => {
      await loadFull(engine)
    })
      .then(() => {
        console.log('[ConfettiOverlay] Particles engine ready')
        setEngineReady(true)
      })
      .catch((error: unknown) => {
        console.error('[ConfettiOverlay] engine init failed', error)
      })
  }, [])

  useEffect(() => {
    if (engineReady && visibleRef.current && !visible) {
      console.log('[ConfettiOverlay] Engine ready and visibleRef is true, forcing burst')
      setBurstKey((prev) => prev + 1)
      setVisible(true)
    }
  }, [engineReady, visible])

  const [customColors, setCustomColors] = useState<string[] | undefined>(undefined)

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ colors?: string[] }>
      const colors = customEvent.detail?.colors
      console.log('[ConfettiOverlay] Event received, current visibleRef:', visibleRef.current, 'custom colors:', colors)
      
      if (colors) {
        setCustomColors(colors)
      } else {
        setCustomColors(undefined)
      }
      
      if (timeoutRef.current !== null) {
        console.log('[ConfettiOverlay] Clearing existing timeout:', timeoutRef.current)
        const oldTimeout = timeoutRef.current
        window.clearTimeout(oldTimeout)
        timeoutRef.current = null
        timeoutStartTimeRef.current = null
        timeoutGenerationRef.current += 1
        console.log('[ConfettiOverlay] Cleared timeout, timeoutRef now:', timeoutRef.current, 'generation:', timeoutGenerationRef.current)
      }
      
      visibleRef.current = true
      console.log('[ConfettiOverlay] Set visibleRef.current to true, verified:', visibleRef.current)
      
      console.log('[ConfettiOverlay] Setting visible state to true')
      setVisible(true)
      setBurstKey((prev) => {
        const newKey = prev + 1
        console.log('[ConfettiOverlay] Incrementing burstKey to:', newKey)
        return newKey
      })
      
      if (isSettingTimeoutRef.current) {
        console.log('[ConfettiOverlay] Already setting timeout, skipping')
        return
      }
      
      isSettingTimeoutRef.current = true
      const startTime = Date.now()
      const currentGeneration = timeoutGenerationRef.current
      timeoutStartTimeRef.current = startTime
      
      const timeoutId = window.setTimeout(() => {
        const elapsed = timeoutStartTimeRef.current ? Date.now() - timeoutStartTimeRef.current : 0
        console.log('[ConfettiOverlay] Timeout callback executed - elapsed:', elapsed, 'ms, timeoutRef:', timeoutRef.current, 'timeoutId:', timeoutId, 'generation:', currentGeneration, 'current gen:', timeoutGenerationRef.current, 'startTime:', timeoutStartTimeRef.current)
        isSettingTimeoutRef.current = false
        
        if (timeoutGenerationRef.current !== currentGeneration) {
          console.log('[ConfettiOverlay] ❌ Timeout generation mismatch, IGNORING. Expected:', currentGeneration, 'got:', timeoutGenerationRef.current)
          return
        }
        
        if (elapsed < 2500) {
          console.log('[ConfettiOverlay] ❌ Timeout fired too quickly, IGNORING. Elapsed:', elapsed, 'ms (need at least 2500ms)')
          return
        }
        
        if (timeoutRef.current !== timeoutId) {
          console.log('[ConfettiOverlay] ❌ Timeout ID mismatch, IGNORING. Expected:', timeoutId, 'got:', timeoutRef.current)
          return
        }
        
        if (!visibleRef.current) {
          console.log('[ConfettiOverlay] ❌ visibleRef is false, IGNORING')
          return
        }
        
        console.log('[ConfettiOverlay] ✅ All checks passed - Hiding confetti now')
        visibleRef.current = false
        setVisible(false)
        timeoutRef.current = null
        timeoutStartTimeRef.current = null
      }, 3000)
      timeoutRef.current = timeoutId
      isSettingTimeoutRef.current = false
      console.log('[ConfettiOverlay] Set timeout to hide after 3 seconds, timeoutId:', timeoutId, 'timeoutRef:', timeoutRef.current, 'startTime:', startTime, 'generation:', currentGeneration)
    }

    console.log('[ConfettiOverlay] Setting up event listener for:', CONFETTI_EVENT_NAME)
    window.addEventListener(CONFETTI_EVENT_NAME, handler as EventListener)
    return () => {
      console.log('[ConfettiOverlay] Removing event listener')
      window.removeEventListener(CONFETTI_EVENT_NAME, handler as EventListener)
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  const defaultColors = [
    '#DC2626', // Christmas red
    '#B91C1C', // Dark red
    '#EF4444', // Light red
    '#16A34A', // Christmas green
    '#15803D', // Dark green
    '#22C55E', // Light green
    '#FFFFFF', // White
    '#F3F4F6', // Off-white
    '#E5E7EB', // Light gray-white
  ]

  const particleColors = customColors || defaultColors

  const options = useMemo(
    () => ({
      fullScreen: { enable: true },
      detectRetina: true,
      fpsLimit: 120,
      particles: {
        number: { value: 0 },
        color: {
          value: particleColors,
        },
        shape: { 
          type: ['circle', 'square', 'star'],
        },
        opacity: {
          value: { min: 0.8, max: 1 },
        },
        size: {
          value: { min: 6, max: 12 },
        },
        life: {
          duration: {
            sync: false,
            value: { min: 2, max: 4 },
          },
          count: 1,
        },
        move: {
          enable: true,
          gravity: { 
            enable: true, 
            acceleration: 15,
            maxSpeed: 100,
          },
          speed: { min: 40, max: 80 },
          decay: 0.05,
          direction: 'none' as const,
          outModes: {
            default: 'destroy' as const,
          },
          trail: {
            enable: false,
          },
        },
        rotate: {
          value: { min: 0, max: 360 },
          direction: 'random',
          animation: { 
            enable: true, 
            speed: { min: 20, max: 50 },
          },
        },
        shadow: {
          enable: true,
          blur: 5,
          offset: {
            x: 2,
            y: 2,
          },
          color: {
            value: '#000000',
            opacity: 0.3,
          },
        },
      },
      emitters: [
        // Left emitter
        {
          life: { 
            duration: 0.3,
            count: 1,
          },
          rate: {
            delay: 0,
            quantity: 50,
          },
          position: { 
            x: 20, 
            y: 90,
            mode: 'percent' as const,
          },
          size: { 
            width: 0, 
            height: 0,
          },
          particles: {
            move: {
              angle: { 
                value: 90, 
                offset: { min: -45, max: 45 },
              },
              speed: { min: 60, max: 100 },
            },
            life: {
              duration: {
                sync: false,
                value: { min: 3, max: 5 },
              },
            },
            size: {
              value: { min: 8, max: 16 },
            },
            color: {
              value: particleColors,
            },
          },
        },
        // Center emitter
        {
          life: { 
            duration: 0.3,
            count: 1,
          },
          rate: {
            delay: 0,
            quantity: 50,
          },
          position: { 
            x: 50, 
            y: 90,
            mode: 'percent' as const,
          },
          size: { 
            width: 0, 
            height: 0,
          },
          particles: {
            move: {
              angle: { 
                value: 90, 
                offset: { min: -45, max: 45 },
              },
              speed: { min: 60, max: 100 },
            },
            life: {
              duration: {
                sync: false,
                value: { min: 3, max: 5 },
              },
            },
            size: {
              value: { min: 8, max: 16 },
            },
            color: {
              value: particleColors,
            },
          },
        },
        // Right emitter
        {
          life: { 
            duration: 0.3,
            count: 1,
          },
          rate: {
            delay: 0,
            quantity: 50,
          },
          position: { 
            x: 80, 
            y: 90,
            mode: 'percent' as const,
          },
          size: { 
            width: 0, 
            height: 0,
          },
          particles: {
            move: {
              angle: { 
                value: 90, 
                offset: { min: -45, max: 45 },
              },
              speed: { min: 60, max: 100 },
            },
            life: {
              duration: {
                sync: false,
                value: { min: 3, max: 5 },
              },
            },
            size: {
              value: { min: 8, max: 16 },
            },
            color: {
              value: particleColors,
            },
          },
        },
      ],
    }),
    [particleColors],
  )

  const shouldRender = visible && engineReady
  
  if (!shouldRender) {
    console.log('[ConfettiOverlay] Not rendering - visible:', visible, 'engineReady:', engineReady, 'visibleRef:', visibleRef.current, 'burstKey:', burstKey)
    return null
  }

  console.log('[ConfettiOverlay] Rendering confetti with burstKey:', burstKey, 'visible:', visible, 'visibleRef:', visibleRef.current)
  return (
    <Particles
      id={`confetti-overlay-${burstKey}`}
      key={burstKey}
      options={options}
      className="pointer-events-none fixed inset-0 z-[9999]"
    />
  )
}

export default ConfettiOverlay

