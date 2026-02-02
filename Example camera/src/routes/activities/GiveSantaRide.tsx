import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ActivityLayout } from '../ActivityLayout'
import { useRecorder } from '../../hooks/useRecorder'
import { ensureAudioAvailable, toBase64 } from '../../utils/validators'
import { apiClient } from '../../services/apiClient'
import { useClearLocalStorage } from '../../hooks/useClearLocalStorage'
import { readLocalJson, writeLocalJson } from '../../utils/storage'
import { useConfetti } from '../../hooks/useConfetti'

const STORAGE_KEY = 'give-santa-ride-storage'

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

const GiveSantaRide = () => {
  useClearLocalStorage([STORAGE_KEY])

  const { isRecording, startRecording, stopRecording } = useRecorder()
  const { fire } = useConfetti()
  const [transcript, setTranscript] = useState<string>()
  const [errorMessage, setErrorMessage] = useState<string>()
  const [isProcessing, setIsProcessing] = useState(false)
  const [celebrationStage, setCelebrationStage] = useState<'idle' | 'praise' | 'done'>('idle')
  const [praiseWord, setPraiseWord] = useState('')
  const timers = useRef<number[]>([])

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
  const [mode, setMode] = useState<'single' | 'group'>('single')
  const [sleighStyle, setSleighStyle] = useState<'rider' | 'the-ride' | 'the-mess'>('rider')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleRecord = async () => {
    setTranscript(undefined)
    setErrorMessage(undefined)
    setCelebrationStage('idle')
    setTextInput('')
    clearTimers()
    await startRecording()
  }

  const finalizeRecording = useCallback(async () => {
    setIsProcessing(true)
    startCelebration()
    try {
      const blob = ensureAudioAvailable(await stopRecording())
      const base64 = await toBase64(blob)
      const response = await apiClient.post<{
        transcript: string
      }>('/santa-chat', {
        audioBlob: base64,
        activity: 'give-santa-ride',
      })

      const transcriptText = response.transcript || ''
      setTranscript(transcriptText)
      
      // Store transcript in cache
      writeLocalJson(STORAGE_KEY, { transcript: transcriptText })
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
      setErrorMessage('Please type your thoughts about giving presents on Christmas.')
      return
    }

    setIsProcessing(true)
    startCelebration()
    try {
      const response = await apiClient.post<{
        transcript: string
      }>('/santa-chat', {
        textInput: textInput.trim(),
        activity: 'give-santa-ride',
      })

      const transcriptText = response.transcript || ''
      setTranscript(transcriptText)
      setTextInput('')
      
      // Store transcript in cache
      writeLocalJson(STORAGE_KEY, { transcript: transcriptText })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process text')
      clearTimers()
      setCelebrationStage('idle')
    } finally {
      setIsProcessing(false)
    }
  }, [textInput, startCelebration])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [])

  // Load cached data
  useEffect(() => {
    const cached = readLocalJson<{ transcript?: string }>(STORAGE_KEY, {})
    if (cached.transcript) {
      setTranscript(cached.transcript)
    }
  }, [])

  // Camera helpers
  const enumerateCameras = async () => {
    try {
      // Request permission first
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
      tempStream.getTracks().forEach((track) => track.stop())
      
      // Now enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((device) => device.kind === 'videoinput')
      setAvailableCameras(videoDevices)
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId)
      }
    } catch (error) {
      // Silently handle camera permission errors - user can grant permission later when they click "Start Camera"
      console.log('Camera enumeration skipped (permission not granted or no camera available):', error)
      setAvailableCameras([])
    }
  }

  const startCamera = async () => {
    try {
      setCameraError(undefined)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      
      // If no cameras are available, try to enumerate again (user may have granted permission)
      if (availableCameras.length === 0) {
        await enumerateCameras()
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
      
      // After starting camera, enumerate devices again to get proper labels
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((device) => device.kind === 'videoinput')
      if (videoDevices.length > 0) {
        setAvailableCameras(videoDevices)
        if (!selectedCameraId && videoDevices.length > 0) {
          setSelectedCameraId(videoDevices[0].deviceId)
        }
      }
    } catch (error) {
      setCameraError((error as Error).message)
    }
  }

  useEffect(() => {
    enumerateCameras().catch((error) => {
      // Handle any unhandled promise rejections
      console.log('Camera enumeration error handled:', error)
      setAvailableCameras([])
    })
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
      setCameraError('Please record your thoughts about giving presents first.')
      return
    }

    setIsGenerating(true)
    setCameraError(undefined)
    setStyledUrl(undefined)
    setEmailStatus(undefined)

    try {
      const response = await apiClient.post<{
        styledImageUrl: string
      }>('/sleigh-portrait', {
        photoDataUrl: imageUrl,
        transcript,
        mode,
        style: sleighStyle,
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
    }
  }, [])

  const handleSendEmail = async () => {
    if (!styledUrl) {
      setEmailStatus('Generate a sleigh portrait first.')
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
        characterType: 'sleigh',
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
      en: 'Why is giving presents on Christmas important?',
      th: 'ทำไมการให้ของขวัญในวันคริสต์มาสจึงสำคัญ?',
    }
  }

  return (
    <ActivityLayout
      title="Give Santa a Ride"
      subtitle="Share why giving presents is important and ride with Santa!"
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

          {/* Input Section */}
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
                  placeholder="Type your thoughts about giving presents here..."
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

          {isProcessing && celebrationStage === 'done' && !transcript && (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-white bg-[#16A34A]/10 px-4 py-3 text-white/80">
              <motion.span
                className="h-6 w-6 rounded-full border-2 border-white/40 border-t-white"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
              />
              <span>Processing your thoughts…</span>
            </div>
          )}

          {transcript && (
            <div className="rounded-xl bg-white/10 p-4 text-sm text-white/90">
              <p className="font-semibold text-white mb-2">Your Thoughts:</p>
              <p>{transcript}</p>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border-2 border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}
        </section>

        {/* Photo Booth Section - Only show when transcript exists */}
        {transcript && (
          <section className="space-y-4 rounded-2xl border-2 border-white bg-gradient-to-br from-[#8B4513]/40 via-[#DC2626]/30 to-[#16A34A]/30 p-4 shadow-[0_0_20px_rgba(139,69,19,0.3)]">
            <h3 className="text-xl font-semibold text-white">Ride with Santa!</h3>

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
                      className="w-full rounded-xl border-2 border-white/30 bg-gradient-to-r from-[#8B4513]/60 to-[#DC2626]/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:border-white"
                    >
                      {availableCameras.map((camera) => (
                        <option key={camera.deviceId} value={camera.deviceId}>
                          {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="rounded-2xl border-2 border-white/20 bg-gradient-to-br from-[#8B4513]/30 via-[#DC2626]/20 to-[#16A34A]/20 p-3 shadow-[0_0_15px_rgba(139,69,19,0.2)]">
                  <video ref={videoRef} className="h-96 w-full rounded-xl bg-gradient-to-br from-[#8B4513]/20 to-[#DC2626]/20 object-cover" playsInline muted />
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

              <div className="space-y-3 rounded-2xl border-2 border-white/20 bg-gradient-to-br from-[#8B4513]/30 via-[#F59E0B]/20 to-[#DC2626]/30 p-4 shadow-[0_0_15px_rgba(139,69,19,0.2)]">
                {/* Mode Selection */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 block">Choose Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setMode('single')}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition ${
                        mode === 'single'
                          ? 'border-white bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                          : 'border-white/30 bg-[#16A34A]/20 text-white/70 hover:border-white/60'
                      }`}
                    >
                      1 Person
                    </button>
                    <button
                      onClick={() => setMode('group')}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition ${
                        mode === 'group'
                          ? 'border-white bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                          : 'border-white/30 bg-[#16A34A]/20 text-white/70 hover:border-white/60'
                      }`}
                    >
                      Group
                    </button>
                  </div>
                </div>

                {/* Style Selection */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 block">Choose Style</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => setSleighStyle('rider')}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition ${
                        sleighStyle === 'rider'
                          ? 'border-white bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                          : 'border-white/30 bg-[#16A34A]/20 text-white/70 hover:border-white/60'
                      }`}
                    >
                      The Rider
                    </button>
                    <button
                      onClick={() => setSleighStyle('the-ride')}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition ${
                        sleighStyle === 'the-ride'
                          ? 'border-white bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                          : 'border-white/30 bg-[#16A34A]/20 text-white/70 hover:border-white/60'
                      }`}
                    >
                      The Ride
                    </button>
                    <button
                      onClick={() => setSleighStyle('the-mess')}
                      className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition ${
                        sleighStyle === 'the-mess'
                          ? 'border-white bg-white/20 text-white shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                          : 'border-white/30 bg-[#16A34A]/20 text-white/70 hover:border-white/60'
                      }`}
                    >
                      The Mess
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
                      Generating Sleigh Portrait...
                    </>
                  ) : (
                    'Generate Sleigh Portrait'
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
                  <p className="text-sm text-white/70 mt-4">Creating your sleigh portrait...</p>
                </div>
              )}

              {styledUrl && !isGenerating && (
                <div className="space-y-2 rounded-2xl border-2 border-[#DC2626] bg-[#DC2626]/10 p-4">
                  <p className="text-sm font-semibold text-[#DC2626]">Your Sleigh Portrait</p>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="w-full focus:outline-none"
                  >
                    <img src={styledUrl} alt="Sleigh Portrait" className="w-full rounded-xl border-2 border-white/10 object-cover transition hover:opacity-90 cursor-pointer" />
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
                    alt="Expanded Sleigh Portrait"
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

  export default GiveSantaRide

