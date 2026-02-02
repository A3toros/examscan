import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ActivityLayout } from '../ActivityLayout'
import { useRecorder } from '../../hooks/useRecorder'
import { ensureAudioAvailable, toBase64 } from '../../utils/validators'
import { apiClient } from '../../services/apiClient'
import { useClearLocalStorage } from '../../hooks/useClearLocalStorage'
import { readLocalJson, writeLocalJson } from '../../utils/storage'
import { useConfetti } from '../../hooks/useConfetti'

const STORAGE_KEY = 'speak-with-santa-storage'

const praiseWords = [
  'Pure Christmas magic',
  'Wonder-filled',
  'North-Pole-worthy',
  'Santa would be proud',
  'Snow-globe perfect',
  'Reindeer-level awesome',
  'Sleigh-ride spectacular',
  'North-Star brilliant',
  'Christmas-Eve epic',
  'Magical',
  'True christmas spirit',
  'Spectacular',
  'Super dooper awesome',
]

const SpeakWithSanta = () => {
  useClearLocalStorage([STORAGE_KEY])

  const { isRecording, startRecording, stopRecording } = useRecorder()
  const { fire } = useConfetti()
  const [transcript, setTranscript] = useState<string>()
  const [santaResponse, setSantaResponse] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()
  const [isProcessing, setIsProcessing] = useState(false)
  const [celebrationStage, setCelebrationStage] = useState<'idle' | 'praise' | 'done'>('idle')
  const [praiseWord, setPraiseWord] = useState('')
  const timers = useRef<number[]>([])
  const hasSpokenRef = useRef<string>('')

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
  }

  const startCelebration = useCallback(() => {
    clearTimers()
    setPraiseWord(praiseWords[Math.floor(Math.random() * praiseWords.length)])
    setCelebrationStage('praise')
    fire()
    timers.current.push(
      window.setTimeout(() => {
        setCelebrationStage('done')
      }, 2000),
    )
  }, [fire])

  // Photo booth state
  const [imageUrl, setImageUrl] = useState<string>()
  const [styledUrl, setStyledUrl] = useState<string>()
  const [isGenerating, setIsGenerating] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string>()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [email, setEmail] = useState('')
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string>()
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [textInput, setTextInput] = useState('')
  const [elfStyle, setElfStyle] = useState<'santas-helper' | 'evil-elf' | 'dobby'>('santas-helper')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [isAudioPlaying, setIsAudioPlaying] = useState(false)

  const handleRecord = async () => {
    setTranscript(undefined)
    setSantaResponse(undefined)
    setErrorMessage(undefined)
    setCelebrationStage('idle')
    setTextInput('')
    hasSpokenRef.current = ''
    clearTimers()
    await startRecording()
  }

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [])

  const finalizeRecording = useCallback(async () => {
    setIsProcessing(true)
    startCelebration()
    try {
      const blob = ensureAudioAvailable(await stopRecording())
      const base64 = await toBase64(blob)
      const response = await apiClient.post<{
        transcript: string
        santaResponse: string
      }>('/santa-chat', {
        audioBlob: base64,
      })

      const transcriptText = response.transcript || ''
      setTranscript(transcriptText)
      setSantaResponse(response.santaResponse || '')
      
      // Store transcript in cache
      writeLocalJson(STORAGE_KEY, { transcript: transcriptText, santaResponse: response.santaResponse })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process speech')
      clearTimers()
      setCelebrationStage('idle')
    } finally {
      setIsProcessing(false)
    }
  }, [stopRecording, startCelebration])

  const handleSubmitText = useCallback(async () => {
    if (!textInput.trim()) {
      setErrorMessage('Please type your Christmas wish.')
      return
    }

    setIsProcessing(true)
    startCelebration()
    try {
      const response = await apiClient.post<{
        transcript: string
        santaResponse: string
      }>('/santa-chat', {
        textInput: textInput.trim(),
      })

      const transcriptText = response.transcript || ''
      setTranscript(transcriptText)
      setSantaResponse(response.santaResponse || '')
      setTextInput('')
      
      // Store transcript in cache
      writeLocalJson(STORAGE_KEY, { transcript: transcriptText, santaResponse: response.santaResponse })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process text')
      clearTimers()
      setCelebrationStage('idle')
    } finally {
      setIsProcessing(false)
    }
  }, [textInput, startCelebration])

  // Load cached data
  useEffect(() => {
    const cached = readLocalJson<{ transcript?: string; santaResponse?: string }>(STORAGE_KEY, {})
    if (cached.transcript) {
      setTranscript(cached.transcript)
      setSantaResponse(cached.santaResponse)
    }
  }, [])

  // Stop speech
  const stopSpeech = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    // Also stop browser TTS if active
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsLoadingAudio(false)
    setIsAudioPlaying(false)
  }, [])

  // TTS function for Santa's voice using API with browser fallback
  const speakSantaResponse = useCallback(async (text: string) => {
    if (!text) return
    
    // Stop any ongoing speech
    stopSpeech()
    
    setIsLoadingAudio(true)
    try {
      // Use Santa TTS API for high-quality Santa voice
      const response = await apiClient.post<{ audioUrl: string; success: boolean }>('/santa-tts', {
        text: text,
      })

      if (response.success && response.audioUrl) {
        const audio = new Audio(response.audioUrl)
        audioRef.current = audio
        
        audio.onended = () => {
          audioRef.current = null
          setIsLoadingAudio(false)
          setIsAudioPlaying(false)
        }
        
        audio.onerror = () => {
          audioRef.current = null
          setIsLoadingAudio(false)
          setIsAudioPlaying(false)
        }
        
        audio.onplay = () => {
          setIsAudioPlaying(true)
        }
        
        audio.onpause = () => {
          setIsAudioPlaying(false)
        }
        
        setIsLoadingAudio(false)
        await audio.play()
        setIsAudioPlaying(true)
      } else {
        setIsLoadingAudio(false)
        console.error('TTS API returned unsuccessful response')
        // Fallback to browser TTS
        fallbackToBrowserTTS(text)
      }
    } catch (error) {
      console.error('TTS API error:', error)
      setIsLoadingAudio(false)
      // Fallback to browser TTS if API fails (e.g., 402 free tier limitation)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('402') || errorMessage.includes('free tier') || errorMessage.includes('blocked')) {
        console.log('[santa-tts] Falling back to browser TTS due to API limitation')
        fallbackToBrowserTTS(text)
      }
    }
  }, [stopSpeech])

  // Fallback to browser TTS
  const fallbackToBrowserTTS = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      console.log('Browser TTS not supported')
      return
    }

    window.speechSynthesis.cancel()

    const getVoices = () => {
      return new Promise<SpeechSynthesisVoice[]>((resolve) => {
        let voices = window.speechSynthesis.getVoices()
        if (voices.length > 0) {
          resolve(voices)
          return
        }
        
        window.speechSynthesis.onvoiceschanged = () => {
          voices = window.speechSynthesis.getVoices()
          resolve(voices)
        }
      })
    }

    getVoices().then((voices) => {
      const utterance = new SpeechSynthesisUtterance(text)
      
      // Find a male voice for Santa
      const maleVoices = voices.filter(voice => 
        voice.name.toLowerCase().includes('male') || 
        voice.name.toLowerCase().includes('david') ||
        voice.name.toLowerCase().includes('daniel') ||
        voice.name.toLowerCase().includes('james') ||
        (voice.lang.startsWith('en') && !voice.name.toLowerCase().includes('female') && !voice.name.toLowerCase().includes('zira'))
      )
      
      if (maleVoices.length > 0) {
        utterance.voice = maleVoices[0]
      }

      // Adjust for Santa-like voice
      utterance.pitch = 0.7
      utterance.rate = 0.85
      utterance.volume = 1.0

      utterance.onstart = () => {
        setIsAudioPlaying(true)
      }

      utterance.onend = () => {
        setIsLoadingAudio(false)
        setIsAudioPlaying(false)
      }

      utterance.onerror = () => {
        setIsLoadingAudio(false)
        setIsAudioPlaying(false)
      }

      window.speechSynthesis.speak(utterance)
    })
  }, [])

  // Speak Santa's response when it's received (only once per response)
  useEffect(() => {
    if (santaResponse && !isProcessing && hasSpokenRef.current !== santaResponse) {
      hasSpokenRef.current = santaResponse
      // Small delay to ensure UI is updated
      setTimeout(() => {
        speakSantaResponse(santaResponse)
      }, 500)
    }
  }, [santaResponse, isProcessing, speakSantaResponse])

  // Camera helpers
  const enumerateCameras = async () => {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
      tempStream.getTracks().forEach((track) => track.stop())
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((device) => device.kind === 'videoinput')
      setAvailableCameras(videoDevices)
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId)
      }
    } catch (error) {
      console.error('Error enumerating cameras:', error)
    }
  }

  const startCamera = async () => {
    try {
      setCameraError(undefined)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      
      const constraints: MediaStreamConstraints = {
        video: {
          width: 1280,
          height: 720,
          ...(selectedCameraId ? { deviceId: { exact: selectedCameraId } } : {}),
        },
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
    } catch (error) {
      setCameraError((error as Error).message)
    }
  }

  useEffect(() => {
    enumerateCameras()
  }, [])

  const captureFrame = () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    setImageUrl(dataUrl)
  }

  const handleGenerate = async () => {
    if (!imageUrl) {
      setCameraError('Capture a photo first.')
      return
    }

    if (!transcript) {
      setCameraError('Please record your Christmas wish first.')
      return
    }

    setIsGenerating(true)
    setCameraError(undefined)
    setStyledUrl(undefined)
    setEmailStatus(undefined)

    try {
      const response = await apiClient.post<{
        styledImageUrl: string
      }>('/elf-portrait', {
        photoDataUrl: imageUrl,
        transcript,
        style: elfStyle,
      })

      setStyledUrl(response.styledImageUrl)
    } catch (error) {
      setCameraError((error as Error).message)
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      stopSpeech()
    }
  }, [stopSpeech])

  const handleSendEmail = async () => {
    if (!styledUrl) {
      setEmailStatus('Generate an elf portrait first.')
      return
    }
    if (!email.trim()) {
      setEmailStatus('Enter an email address.')
      return
    }
    setIsSendingEmail(true)
    setEmailStatus(undefined)
    try {
      await apiClient.post('/send-photo-email', {
        email,
        styledImageUrl: styledUrl,
        characterType: 'elf',
      })
      setEmailStatus('Email sent! Check your inbox.')
    } catch (error) {
      setEmailStatus((error as Error).message)
    } finally {
      setIsSendingEmail(false)
    }
  }

  const getPrompt = () => {
    return {
      en: 'What do you want for Christmas?',
      th: 'คุณต้องการอะไรสำหรับคริสต์มาส?',
    }
  }

  return (
    <ActivityLayout
      title="Speak with Santa"
      subtitle="Tell Santa what you want for Christmas and become his friend elf!"
    >
      {/* Voice Recording Section */}
      <section className="space-y-4 rounded-2xl border-2 border-white bg-[#16A34A]/10 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/70">Prompt</p>
            <div className="space-y-1">
              <p className="font-semibold text-white text-lg" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
                {getPrompt().en}
              </p>
              <p className="font-semibold text-white/80 text-lg" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
                {getPrompt().th}
              </p>
            </div>
          </div>

          {/* Input Section - Show both recording and text input side by side when not recording */}
          <div className="flex flex-wrap items-start gap-3">
            {/* Start Recording Button */}
            <button
              onClick={handleRecord}
              disabled={isRecording}
              className="rounded-xl border-2 border-white bg-white/20 px-6 py-3 font-semibold text-white transition hover:bg-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] disabled:opacity-50"
            >
              {isRecording ? 'Recording…' : 'Start Recording'}
            </button>
            
            {/* Stop Recording Button - Only show when recording */}
            {isRecording && (
              <button
                onClick={finalizeRecording}
                className="rounded-xl border-2 border-[#F59E0B] bg-[#F59E0B]/20 px-6 py-3 font-semibold text-[#F59E0B] transition hover:bg-[#F59E0B]/30 hover:shadow-[0_0_15px_rgba(245,158,11,0.4)]"
              >
                Stop Recording
              </button>
            )}

            {/* Text Input - Hide when recording */}
            {!isRecording && (
              <div className="flex-1 flex gap-3 min-w-[300px]">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your Christmas wish here..."
                  className="flex-1 rounded-xl border-2 border-white/30 bg-[#ee564a]/20 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:border-white resize-none"
                  rows={1}
                />
                <button
                  onClick={handleSubmitText}
                  disabled={isProcessing || !textInput.trim()}
                  className="rounded-xl border-2 border-white bg-white/20 px-6 py-3 font-semibold text-white transition hover:bg-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Submit
                </button>
              </div>
            )}
          </div>

          {transcript && (
            <div className="rounded-xl bg-white/10 p-4 text-sm text-white/90">
              <p className="font-semibold text-white mb-2">Your Wish:</p>
              <p>{transcript}</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {celebrationStage === 'praise' && (
              <motion.div
                key="praise"
                initial={{ opacity: 0, scale: 0.5, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -30 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20, duration: 0.6 }}
                className="rounded-2xl border-2 border-white bg-white/5 p-8 text-center"
              >
                <motion.p
                  key={praiseWord}
                  initial={{ opacity: 0, scale: 0.3, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.5 }}
                  className="text-5xl font-display text-white"
                >
                  {praiseWord || 'Great!'}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {isProcessing && celebrationStage === 'done' && !santaResponse && (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-white bg-[#16A34A]/10 px-4 py-3 text-white/80">
              <motion.span
                className="h-6 w-6 rounded-full border-2 border-white/40 border-t-white"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
              />
              <span>Santa is listening…</span>
            </div>
          )}

          {santaResponse && (
            <div className="rounded-xl bg-[#16A34A]/20 border-2 border-[#16A34A]/50 p-4 text-sm text-white">
              <div className="flex items-start gap-3 mb-2">
                {/* Mute/Stop Button - Left side */}
                <button
                  onClick={stopSpeech}
                  disabled={!isAudioPlaying && !isLoadingAudio}
                  className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 flex-shrink-0"
                  title={isAudioPlaying ? "Stop audio" : "Audio stopped"}
                >
                  {isAudioPlaying ? (
                    <>
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Stop
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Muted
                    </>
                  )}
                </button>
                
                {/* Santa Says label */}
                <p className="font-semibold text-[#16A34A] flex-1">Santa Says:</p>
                
                {/* Play Button - Right side */}
                <button
                  onClick={() => speakSantaResponse(santaResponse)}
                  disabled={isLoadingAudio}
                  className="rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 flex-shrink-0"
                  title="Replay Santa's message"
                >
                  {isLoadingAudio ? (
                    <>
                      <motion.span
                        className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
                      />
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                      Play
                    </>
                  )}
                </button>
              </div>
              <p className="text-lg">{santaResponse}</p>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border-2 border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}
        </section>

        {/* Photo Booth Section - Only show when Santa has responded */}
        {santaResponse && (
          <section className="space-y-4 rounded-2xl border-2 border-white bg-gradient-to-br from-[#16A34A]/40 via-[#15803D]/30 to-[#DC2626]/30 p-4 shadow-[0_0_20px_rgba(22,163,74,0.3)]">
            <h3 className="text-xl font-semibold text-white">Become an Elf!</h3>
            <div className="grid gap-6 md:grid-cols-[3fr,2fr]">
              <div className="space-y-3">
                <p className="text-sm text-white/70">Live camera preview</p>
                {availableCameras.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs block text-white/70">Select Camera</label>
                    <select
                      value={selectedCameraId}
                      onChange={(e) => {
                        setSelectedCameraId(e.target.value)
                        setCameraReady(false)
                        if (streamRef.current) {
                          streamRef.current.getTracks().forEach((track) => track.stop())
                        }
                      }}
                      className="w-full rounded-xl border-2 border-white/30 bg-gradient-to-r from-[#16A34A]/60 to-[#DC2626]/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:border-white"
                    >
                      {availableCameras.map((camera) => (
                        <option key={camera.deviceId} value={camera.deviceId}>
                          {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="rounded-2xl border-2 border-white/20 bg-gradient-to-br from-[#16A34A]/30 via-[#15803D]/20 to-[#DC2626]/20 p-3 shadow-[0_0_15px_rgba(22,163,74,0.2)]">
                  <video ref={videoRef} className="h-96 w-full rounded-xl bg-gradient-to-br from-[#16A34A]/20 to-[#DC2626]/20 object-cover" playsInline muted />
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      onClick={startCamera}
                      className="rounded-full border-2 border-white/30 px-4 py-2 text-sm text-white hover:border-white"
                    >
                      {cameraReady ? 'Restart Camera' : 'Start Camera'}
                    </button>
                    <button
                      onClick={captureFrame}
                      disabled={!cameraReady}
                      className="rounded-full border-2 border-white px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 disabled:border-white/20"
                    >
                      Capture Photo
                    </button>
                  </div>
                </div>
                {cameraError && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{cameraError}</p>}
              </div>

              <div className="space-y-3 rounded-2xl border-2 border-white/20 bg-gradient-to-br from-[#16A34A]/30 via-[#F59E0B]/20 to-[#DC2626]/30 p-4 shadow-[0_0_15px_rgba(22,163,74,0.2)]">
                {/* Style Selection */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 block">Choose Elf Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setElfStyle('santas-helper')}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition ${
                        elfStyle === 'santas-helper'
                          ? 'border-white bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                          : 'border-white/30 bg-[#16A34A]/20 text-white/70 hover:border-white/60'
                      }`}
                    >
                      Santa's Helper
                    </button>
                    <button
                      onClick={() => setElfStyle('evil-elf')}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition ${
                        elfStyle === 'evil-elf'
                          ? 'border-white bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                          : 'border-white/30 bg-[#16A34A]/20 text-white/70 hover:border-white/60'
                      }`}
                    >
                      Evil Elf
                    </button>
                    <button
                      onClick={() => setElfStyle('dobby')}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition ${
                        elfStyle === 'dobby'
                          ? 'border-white bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                          : 'border-white/30 bg-[#16A34A]/20 text-white/70 hover:border-white/60'
                      }`}
                    >
                      Dobby
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !transcript}
                  className="w-full rounded-xl border-2 border-white bg-white/20 px-6 py-3 font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                >
                  {isGenerating ? (
                    <>
                      <motion.span
                        className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
                      />
                      Generating Elf Portrait...
                    </>
                  ) : (
                    'Generate Elf Portrait'
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {imageUrl && (
                <div className="space-y-2 rounded-2xl border-2 border-white/20 bg-[#16A34A]/10 p-4">
                  <p className="text-sm text-white/60">Captured photo</p>
                  <img src={imageUrl} alt="Captured" className="w-full rounded-xl border-2 border-white/10 object-cover" />
                </div>
              )}

              {isGenerating && (
                <div className="space-y-2 rounded-2xl border-2 border-white/20 bg-[#16A34A]/10 p-4 flex flex-col items-center justify-center min-h-[200px]">
                  <motion.span
                    className="h-12 w-12 rounded-full border-4 border-white/20 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, ease: 'linear', duration: 1 }}
                  />
                  <p className="text-sm text-white/70 mt-4">Creating your elf portrait...</p>
                </div>
              )}

              {styledUrl && !isGenerating && (
                <div className="space-y-2 rounded-2xl border-2 border-[#16A34A] bg-[#16A34A]/10 p-4">
                  <p className="text-sm font-semibold text-[#16A34A]">Your Elf Portrait</p>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="w-full focus:outline-none"
                  >
                    <img src={styledUrl} alt="Elf Portrait" className="w-full rounded-xl border-2 border-white/10 object-cover transition hover:opacity-90 cursor-pointer" />
                  </button>
                  
                  <div className="space-y-2 mt-4">
                    <label className="text-sm text-white/70 block">
                      Email your portrait
                      <input
                        type="email"
                        className="mt-2 w-full rounded-xl border-2 border-white/30 bg-[#16A34A]/20 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:border-white"
                        placeholder="student@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                    <button
                      onClick={handleSendEmail}
                      disabled={isSendingEmail}
                      className="w-full rounded-xl border-2 border-[#F59E0B] bg-[#F59E0B]/20 px-4 py-2 text-sm font-semibold text-[#F59E0B] transition disabled:opacity-50 hover:bg-[#F59E0B]/30"
                    >
                      {isSendingEmail ? 'Sending…' : 'Send to email'}
                    </button>
                    {emailStatus && (
                      <p className="text-xs text-white/70">{emailStatus}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Image Modal */}
            <AnimatePresence>
              {isModalOpen && styledUrl && (
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsModalOpen(false)}
                >
                  <motion.img
                    src={styledUrl}
                    alt="Expanded Elf Portrait"
                    className="max-h-[90vh] max-w-5xl rounded-2xl border border-white/20 object-contain"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}
    </ActivityLayout>
  )
}

export default SpeakWithSanta

