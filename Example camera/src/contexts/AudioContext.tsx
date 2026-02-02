import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type AudioState = {
  isRecording: boolean
  permission: PermissionState
  lastBlob?: Blob
  error?: string
}

type AudioContextValue = AudioState & {
  requestPermission: () => Promise<void>
  startRecording: () => Promise<void>
  stopRecording: () => Promise<Blob | undefined>
  reset: () => void
}

const AudioContext = createContext<AudioContextValue | null>(null)

export const AudioProvider = ({ children }: { children: ReactNode }) => {
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const [state, setState] = useState<AudioState>({ isRecording: false, permission: 'prompt' })

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
      setState((prev) => ({ ...prev, permission: 'granted', error: undefined }))
    } catch (error) {
      setState((prev) => ({ ...prev, permission: 'denied', error: (error as Error).message }))
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (state.permission !== 'granted') {
      await requestPermission()
    }
    if (!mediaRecorder.current) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
    }
    chunks.current = []
    mediaRecorder.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.current.push(event.data)
      }
    }
    mediaRecorder.current.start()
    setState((prev) => ({ ...prev, isRecording: true, error: undefined }))
  }, [requestPermission, state.permission])

  const stopRecording = useCallback(async () => {
    if (!mediaRecorder.current || state.isRecording === false) return state.lastBlob

    await new Promise<void>((resolve) => {
      if (!mediaRecorder.current) return resolve()
      mediaRecorder.current.onstop = () => resolve()
      mediaRecorder.current.stop()
    })
    const blob = new Blob(chunks.current, { type: 'audio/webm' })
    setState((prev) => ({ ...prev, isRecording: false, lastBlob: blob }))
    return blob
  }, [state.isRecording])

  const reset = useCallback(() => {
    setState({ isRecording: false, permission: state.permission, lastBlob: undefined })
  }, [state.permission])

  useEffect(() => {
    return () => {
      mediaRecorder.current?.stream.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const value = useMemo<AudioContextValue>(
    () => ({
      ...state,
      requestPermission,
      startRecording,
      stopRecording,
      reset,
    }),
    [requestPermission, startRecording, state, stopRecording, reset],
  )

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
}

export const useAudio = () => {
  const ctx = useContext(AudioContext)
  if (!ctx) throw new Error('useAudio must be used within an AudioProvider')
  return ctx
}

