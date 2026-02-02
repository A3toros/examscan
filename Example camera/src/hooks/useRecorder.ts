import { useCallback } from 'react'
import { useAudio } from '../contexts/AudioContext'

export const useRecorder = () => {
  const audio = useAudio()

  const recordOnce = useCallback(
    async (durationMs: number) => {
      await audio.startRecording()
      await new Promise((resolve) => setTimeout(resolve, durationMs))
      return audio.stopRecording()
    },
    [audio],
  )

  return {
    ...audio,
    recordOnce,
  }
}

