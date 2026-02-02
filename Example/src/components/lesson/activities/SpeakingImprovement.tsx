'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { memo } from 'react'
import { Card, Button } from '@/components/ui'
import MascotThinking from '@/components/ui/MascotThinking'
import { useAuth } from '@/contexts/AuthContext'
import { useApi } from '@/hooks/useApi'
import { useNotification } from '@/contexts/NotificationContext'
import { getSpeakingHelper } from '@/utils/speakingHelper'
import { lessonProgressStorage } from '@/services/LessonProgressStorage'

interface SpeakingImprovementProps {
  lessonData: {
    lessonId: string
    activityOrder: number
    prompt?: string
    improvedText: string
    similarityThreshold?: number
  }
  onComplete: (result?: any) => void
}

type ProcessingStep = 'idle' | 'recording' | 'analyzing' | 'complete'

const SpeakingImprovement = memo<SpeakingImprovementProps>(({ lessonData, onComplete }) => {
  const { user } = useAuth()
  const { makeAuthenticatedRequest } = useApi()
  const { showNotification } = useNotification()

  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('idle')
  const [transcript, setTranscript] = useState('')
  const [similarityResult, setSimilarityResult] = useState<any>(null)
  const [attempts, setAttempts] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [startTime] = useState(Date.now())
  const [originalTranscript, setOriginalTranscript] = useState<string>('')
  const [improvedTranscript, setImprovedTranscript] = useState<string>('')
  const [isLoadingFromDB, setIsLoadingFromDB] = useState(false)
  const [hasTriedLoadingFromDB, setHasTriedLoadingFromDB] = useState(false)

  const speakingHelper = getSpeakingHelper()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const improvedTranscriptRef = useRef<string>('')

  // Load original and improved transcripts from previous speaking activity
  const loadImprovedTranscript = useCallback(() => {
    if (!user?.id || !lessonData.lessonId) return

    console.log('🔍 SpeakingImprovement: Loading improved transcript', {
      lessonId: lessonData.lessonId,
      improvedTextFromProps: lessonData.improvedText
    });

    // Try to get transcripts from localStorage (from previous speaking activity)
    const savedProgress = lessonProgressStorage.loadProgress(user.id, lessonData.lessonId)
    console.log('🔍 SpeakingImprovement: Saved progress', {
      hasProgress: !!savedProgress,
      activitiesCount: savedProgress?.activities?.length || 0
    });

    let foundImproved = false;

    if (savedProgress?.activities) {
      // Find the previous speaking_practice activity - check all activities, not just most recent
      const speakingActivities = savedProgress.activities
        .filter(a => (a.activityType === 'speaking_practice' || a.activityType === 'speaking_with_feedback') && a.result?.answers)
        .sort((a, b) => (b.activityOrder || 0) - (a.activityOrder || 0)); // Get most recent first

      console.log('🔍 SpeakingImprovement: Found speaking activities', {
        count: speakingActivities.length,
        activities: speakingActivities.map(a => ({
          activityType: a.activityType,
          activityOrder: a.activityOrder,
          hasResult: !!a.result,
          hasAnswers: !!a.result?.answers,
          hasImprovedTranscript: !!a.result?.answers?.improvedTranscript
        }))
      });

      // Try each speaking activity until we find one with improved transcript
      for (const speakingActivity of speakingActivities) {
        const answers = speakingActivity.result?.answers || {};
        const improved = answers.improvedTranscript ||
                        answers.improvedTranscripts?.[Object.keys(answers.improvedTranscripts || {})[0]];
        
        if (improved) {
          console.log('🔍 SpeakingImprovement: Improved transcript found', {
            activityType: speakingActivity.activityType,
            activityOrder: speakingActivity.activityOrder,
            fromAnswers: !!answers.improvedTranscript,
            improved: improved.substring(0, 50) + '...'
          });
          
          setImprovedTranscript(improved);
          improvedTranscriptRef.current = improved;
          foundImproved = true;

          // Get original transcript
          if (answers.transcripts) {
            // Get the last transcript from the transcripts object
            const transcriptKeys = Object.keys(answers.transcripts)
            if (transcriptKeys.length > 0) {
              const lastKey = transcriptKeys[transcriptKeys.length - 1]
              setOriginalTranscript(answers.transcripts[lastKey] || '')
            }
          } else if (typeof answers === 'string') {
            setOriginalTranscript(answers)
          } else if (answers.transcript) {
            setOriginalTranscript(answers.transcript)
          } else if (Array.isArray(answers) && answers.length > 0) {
            const lastAnswer = answers[answers.length - 1]
            setOriginalTranscript(typeof lastAnswer === 'string' ? lastAnswer : lastAnswer.transcript || '')
          }
          break; // Found it, stop looking
        }
      }
    }
    
    // Fallback: use improvedText from lessonData if not found in localStorage
    if (!foundImproved && lessonData.improvedText) {
      console.log('🔍 SpeakingImprovement: Using improvedText from lessonData', lessonData.improvedText);
      const improved = lessonData.improvedText;
      setImprovedTranscript(prev => prev || improved);
      improvedTranscriptRef.current = improved;
      foundImproved = true;
    }
    
    // Final check: if still no improved transcript, try loading from database automatically
    if (!foundImproved && !hasTriedLoadingFromDB) {
      console.warn('⚠️ SpeakingImprovement: No improved transcript found in localStorage, trying database...', {
        improvedTextFromProps: lessonData.improvedText,
        savedProgress: savedProgress?.activities?.length || 0,
        speakingActivities: savedProgress?.activities?.filter(a => 
          a.activityType === 'speaking_practice' || a.activityType === 'speaking_with_feedback'
        ).length || 0
      });
      // Automatically try loading from database
      setHasTriedLoadingFromDB(true);
      // Call loadImprovedTranscriptFromDB - it's defined below, so we'll use useEffect to call it
    } else if (foundImproved) {
      const currentImproved = improvedTranscript || lessonData.improvedText;
      console.log('✅ SpeakingImprovement: Improved transcript ready', currentImproved?.substring(0, 50) + '...');
    }
  }, [user?.id, lessonData.lessonId, lessonData.improvedText, improvedTranscript, hasTriedLoadingFromDB]);

  // Load improved transcript directly from database (no regeneration needed)
  const loadImprovedTranscriptFromDB = useCallback(async () => {
    if (!user?.id || !lessonData.lessonId || isLoadingFromDB) return;

    setIsLoadingFromDB(true);
    try {
      // Fetch lesson data with activity results from database
      const response = await makeAuthenticatedRequest(`/.netlify/functions/get-lesson?lessonId=${lessonData.lessonId}&userId=${user.id}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch lesson data');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch lesson data');
      }

      // activityResults is at the top level, not in data
      const activityResults = result.activityResults || [];
      
      if (activityResults.length === 0) {
        throw new Error('No activity results found. Please complete the speaking activity first.');
      }

      // Find the speaking activity result
      const speakingActivity = activityResults.find((ar: any) => 
        (ar.activityType === 'speaking_with_feedback' || ar.activityType === 'speaking_practice') &&
        ar.answers
      );

      if (!speakingActivity || !speakingActivity.answers) {
        throw new Error('No speaking activity results found. Please complete the speaking activity first.');
      }

      const answers = speakingActivity.answers;
      
      // Get improved transcript directly from database (already stored)
      const improvedFromDB = answers.improvedTranscript;
      
      if (!improvedFromDB) {
        throw new Error('Improved transcript not found in database. It may not have been generated yet.');
      }

      console.log('✅ Loaded improved transcript from database:', {
        activityType: speakingActivity.activityType,
        activityOrder: speakingActivity.activityOrder,
        improvedLength: improvedFromDB.length,
        preview: improvedFromDB.substring(0, 50) + '...'
      });

      // Update improved transcript
      setImprovedTranscript(improvedFromDB);
      improvedTranscriptRef.current = improvedFromDB;
      
      // Also update localStorage
      if (user.id && lessonData.lessonId) {
        const savedProgress = lessonProgressStorage.loadProgress(user.id, lessonData.lessonId);
        if (savedProgress?.activities) {
          const activityIndex = savedProgress.activities.findIndex((a: any) => 
            (a.activityType === 'speaking_practice' || a.activityType === 'speaking_with_feedback') &&
            a.activityOrder === speakingActivity.activityOrder
          );
          
          if (activityIndex >= 0) {
            const existing = savedProgress.activities[activityIndex];
            savedProgress.activities[activityIndex] = {
              ...existing,
              result: {
                ...existing.result,
                attempts: existing.result?.attempts || 1,
                answers: {
                  ...existing.result?.answers,
                  improvedTranscript: improvedFromDB
                }
              }
            };
            lessonProgressStorage.saveProgress(user.id, lessonData.lessonId, savedProgress);
          }
        }
      }

      // Don't show notification for automatic loading - it's expected behavior
      console.log('✅ Improved text loaded from database automatically');
    } catch (error: any) {
      console.error('Error loading improved transcript from database:', error);
      // Don't show error notification for automatic loading - it's silent fallback
    } finally {
      setIsLoadingFromDB(false);
    }
  }, [user?.id, lessonData.lessonId, isLoadingFromDB, makeAuthenticatedRequest]);

  // Auto-load from database if not found in localStorage
  useEffect(() => {
    if (hasTriedLoadingFromDB && !improvedTranscript && !lessonData.improvedText) {
      loadImprovedTranscriptFromDB();
    }
  }, [hasTriedLoadingFromDB, improvedTranscript, lessonData.improvedText, loadImprovedTranscriptFromDB]);

  // Load on mount and re-check periodically in case data is saved after mount
  useEffect(() => {
    loadImprovedTranscript();
    
    // Re-check after a short delay in case the improved transcript is being saved
    const timeout1 = setTimeout(() => {
      loadImprovedTranscript();
    }, 500);
    
    const timeout2 = setTimeout(() => {
      loadImprovedTranscript();
    }, 1500);
    
    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [loadImprovedTranscript])

  // Get supported MIME type (platform-specific)
  const getSupportedMimeType = () => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOSDevice) {
      // iOS Safari only supports MP4 formats
      const iosTypes = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2'];
      const supportedType = iosTypes.find(type => MediaRecorder.isTypeSupported(type));
      if (supportedType) {
        console.log(`✅ iOS: Using audio format: ${supportedType}`);
        return supportedType;
      }
      throw new Error('MediaRecorder is not fully supported on this iOS version. Please update iOS or use a different browser.');
    }

    // Android/Desktop: Prioritize WebM/Opus (better quality)
    const preferredTypes = [
      'audio/webm;codecs=opus',      // Best quality for speech
      'audio/webm',                   // WebM fallback
      'audio/mp4;codecs=mp4a.40.2',  // MP4 AAC fallback
      'audio/mp4'                     // Generic MP4 last resort
    ];
    const supportedType = preferredTypes.find(type => MediaRecorder.isTypeSupported(type));
    if (!supportedType) {
      throw new Error("No supported audio format found.");
    }
    console.log(`✅ Non-iOS: Using audio format: ${supportedType}`);
    return supportedType;
  }

  // Convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Start recording
  const startRecording = useCallback(async () => {
    // Reset stopping state when starting a new recording
    setIsStopping(false)
    if (isRecording) return

    try {
      setIsRecording(true)
      setCurrentStep('recording')

      // Platform-specific audio constraints
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      const audioConstraints = isIOSDevice
        ? { audio: { echoCancellation: true } } // iOS: minimal constraints
        : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }; // Others: full constraints

      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints)

      streamRef.current = stream
      const mimeType = getSupportedMimeType()
      
      // Platform-specific MediaRecorder options
      const recorderOptions = isIOSDevice
        ? { mimeType } // iOS: no audioBitsPerSecond (not supported)
        : { mimeType, audioBitsPerSecond: 64000 }; // Others: optimal bitrate for speech

      const mediaRecorder = new MediaRecorder(stream, recorderOptions)

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType })
        if (audioBlob.size === 0) {
          showNotification('No audio recorded. Please try again.', 'error')
          setIsRecording(false)
          setCurrentStep('idle')
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
          }
          mediaRecorderRef.current = null
          return
        }

        setIsProcessing(true)
        setCurrentStep('analyzing')

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
        mediaRecorderRef.current = null

        try {
          const base64Audio = await blobToBase64(audioBlob)
          
          // Transcribe the audio
          const response = await fetch('/.netlify/functions/ai-speech-to-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio_blob: base64Audio,
              audio_mime_type: mimeType,
              test_id: 'lesson_speaking_improvement',
              question_id: 'improvement',
              prompt: lessonData.improvedText
            })
          })

          const result = await response.json()

          if (!result.success) {
            throw new Error(result.error || 'Transcription failed')
          }

          setTranscript(result.transcript || '')

          // Check similarity with improved transcript using ai-similarity endpoint
          // Use ref to get current value (closure may have stale value from when recording started)
          let targetText = improvedTranscriptRef.current || improvedTranscript || lessonData.improvedText
          
          // If still not available, wait a bit for database load to complete
          if (!targetText && isLoadingFromDB) {
            // Wait up to 2 seconds for database load to complete
            for (let i = 0; i < 20; i++) {
              await new Promise(resolve => setTimeout(resolve, 100))
              // Re-read from ref and state (ref is updated when DB load completes)
              targetText = improvedTranscriptRef.current || improvedTranscript || lessonData.improvedText
              if (targetText) break
            }
          }
          
          if (!targetText) {
            throw new Error('No improved transcript available for comparison. Please wait for it to load or complete the speaking activity first.')
          }

          const similarityResponse = await makeAuthenticatedRequest('/.netlify/functions/ai-similarity', {
            method: 'POST',
            body: JSON.stringify({
              targetText: targetText,
              userText: result.transcript || '',
              threshold: (lessonData.similarityThreshold || 70) / 100 // Convert percentage to 0-1 scale
            })
          })

          if (!similarityResponse.ok) {
            throw new Error('Similarity check failed')
          }

          const similarityResult = await similarityResponse.json()
          
          if (similarityResult.success && similarityResult.similarity !== undefined) {
            // Convert similarity from 0-1 to 0-100 if needed
            const similarity = typeof similarityResult.similarity === 'number' 
              ? (similarityResult.similarity <= 1 ? Math.round(similarityResult.similarity * 100) : similarityResult.similarity)
              : 0
            
            setSimilarityResult({
              ...similarityResult,
              similarity
            })

            const threshold = lessonData.similarityThreshold || 70

            if (similarity >= threshold) {
              setIsComplete(true)
              setCurrentStep('complete')
              showNotification(`Excellent! Similarity: ${similarity}%`, 'success')
            } else if (attempts >= 2) {
              // After 3 attempts, allow to continue
              setIsComplete(true)
              setCurrentStep('complete')
              showNotification(`Good effort! Similarity: ${similarity}%. Moving to next activity.`, 'info')
            } else {
              setAttempts(prev => prev + 1)
              showNotification(`Similarity: ${similarity}%. Try reading again for better accuracy.`, 'info')
              setCurrentStep('idle')
            }
          } else {
            // If similarity check fails, just mark as complete after reading
            setIsComplete(true)
            setCurrentStep('complete')
            showNotification('Good reading!', 'success')
          }

        } catch (error: any) {
          console.error('Processing error:', error)
          showNotification(error.message || 'Failed to process your reading. Please try again.', 'error')
          setCurrentStep('idle')
        } finally {
          setIsProcessing(false)
          setIsRecording(false)
        }
      }

      mediaRecorder.start()
    } catch (error: any) {
      console.error('Recording error:', error)
      showNotification(error.message || 'Failed to start recording. Please check microphone permissions.', 'error')
      setIsRecording(false)
      setCurrentStep('idle')
    }
  }, [isRecording, lessonData, showNotification])

  // Stop recording
  const stopRecording = useCallback(() => {
    // Immediately disable button and show gray state
    setIsStopping(true)
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
  }, [isRecording])

  // Handle completion
  const handleComplete = useCallback(async () => {
    if (!user?.id) return

    const timeSpent = Math.floor((Date.now() - startTime) / 1000)
    const similarityScore = similarityResult?.similarity || 0

    // Save activity result
    const activityResult = {
      activityId: undefined,
      activityType: 'speaking_improvement',
      activityOrder: lessonData.activityOrder,
      score: similarityScore,
      maxScore: 100,
      attempts: attempts + 1,
      timeSpent,
      completedAt: new Date().toISOString(),
      answers: {
        transcript,
        originalTranscript,
        improvedTranscript: improvedTranscript || lessonData.improvedText,
        similarity: similarityScore
      },
      feedback: similarityResult
    }

    // Call parent's completion handler with result
    if (onComplete) {
      onComplete(activityResult)
    }
  }, [user?.id, lessonData, transcript, originalTranscript, improvedTranscript, similarityResult, attempts, startTime, onComplete])

  if (isComplete) {
    return (
      <Card>
        <Card.Header>
          <h3 className="text-lg md:text-xl font-semibold">Speaking Improvement</h3>
        </Card.Header>
        <Card.Body>
          <div className="text-center space-y-4">
            <div className="p-6 bg-green-50 rounded-lg border-2 border-green-200">
              <p className="text-sm md:text-lg font-semibold text-green-800">
                {similarityResult?.similarity && similarityResult.similarity >= (lessonData.similarityThreshold || 70)
                  ? 'Excellent reading!'
                  : 'Good effort!'}
              </p>
              {similarityResult?.similarity !== undefined && (
                <p className="text-sm text-green-600 mt-2">
                  Similarity: {similarityResult.similarity}%
                </p>
              )}
              {similarityResult?.feedback && (
                <p className="text-sm text-green-700 mt-2 italic">
                  {similarityResult.feedback}
                </p>
              )}
            </div>
            <Button 
              onClick={handleComplete} 
              size="sm" 
              className="w-full"
            >
              Next
            </Button>
          </div>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Header>
        <h3 className="text-xl font-semibold">Speaking Improvement</h3>
        <p className="text-sm text-neutral-600">
          Read the improved version of your response
        </p>
      </Card.Header>
      <Card.Body>
        {/* Show improved text */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-2">Read this improved version:</h4>
          {improvedTranscript || lessonData.improvedText ? (
            <p className="text-sm md:text-lg text-blue-900">{improvedTranscript || lessonData.improvedText}</p>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm md:text-lg text-blue-600 italic mb-2">
                {isLoadingFromDB ? 'Loading from database...' : 'Loading improved version...'}
              </p>
              <p className="text-sm text-blue-500">Please wait while we prepare the improved text.</p>
            </div>
          )}
        </div>

        {/* Recording Controls */}
        {!isProcessing && currentStep !== 'analyzing' && (
          <div className="mb-6 flex justify-center">
            {!isRecording ? (
              <img
                src="/mic-start.png"
                alt="Start Recording"
                className="w-16 h-16 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={startRecording}
              />
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <img
                  src="/mic-stop.png"
                  alt="Stop Recording"
                  className={`w-16 h-16 transition-all duration-200 ${
                    isStopping 
                      ? 'opacity-50 grayscale cursor-not-allowed' 
                      : 'cursor-pointer hover:opacity-80'
                  }`}
                  onClick={isStopping ? undefined : stopRecording}
                />
                <p className="text-sm text-neutral-600">Recording... Click to stop</p>
              </div>
            )}
          </div>
        )}

        {/* Processing State */}
        {isProcessing && currentStep === 'analyzing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <MascotThinking
              speechText="Analyzing your Meow meow"
              className="scale-125"
              alwaysShowSpeech={true}
            />
            <div className="mt-8 text-center">
              <div className="inline-flex space-x-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"
                    style={{
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: '1.5s'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Similarity Result */}
        {similarityResult && !isComplete && (
          <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-800">
              Similarity: {similarityResult.similarity}% - Try reading again for better accuracy.
            </p>
          </div>
        )}
      </Card.Body>
    </Card>
  )
})

SpeakingImprovement.displayName = 'SpeakingImprovement'

export default SpeakingImprovement

