import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

type SpeakingTestStep = 'permission' | 'recording' | 'processing' | 'transcribing' | 'analyzing' | 'feedback' | 'error';

// AI Models Used:
// - Transcription: whisper-1 (fast, accurate for complete audio)
// - Feedback: gpt-4o-mini (intelligent analysis)
import { Card, Button } from '../ui';
import Modal from '../ui/Modal';
import { getAIFeedbackHelper } from '../../utils/aiFeedbackHelper';
import Mascot from '../ui/Mascot';
import MascotThinking from '../ui/MascotThinking';

interface SpeakingTestProps {
  onComplete: (results: any) => void;
}

// Sample speaking test prompts
const speakingPrompts = [
  {
    id: 'prompt1',
    prompt: 'Introduce yourself. Say your name, where you are from, and what you like to do.',
    instructions: 'Speak clearly for 20-30 seconds about yourself.'
  },
  {
    id: 'prompt2',
    prompt: 'Describe your favorite hobby or activity. Why do you enjoy it?',
    instructions: 'Speak for 20-30 seconds about something you enjoy doing.'
  }
];

const SpeakingTest: React.FC<SpeakingTestProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<SpeakingTestStep>('permission');
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcripts, setTranscripts] = useState<{[key: string]: string}>({});
  const [feedback, setFeedback] = useState<{[key: string]: any}>({});
  const [startTime] = useState(Date.now());
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // NEW: Two-stage processing state (like example)
  const [transcriptionState, setTranscriptionState] = useState<'idle' | 'transcribing' | 'succeeded' | 'failed'>('idle');
  const [analysisState, setAnalysisState] = useState<'idle' | 'analyzing' | 'succeeded' | 'failed'>('idle');
  const [cachedTranscript, setCachedTranscript] = useState<string | null>(null);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);

  // NEW: Error handling state
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [failedPayload, setFailedPayload] = useState<any>(null);
  const [isResending, setIsResending] = useState(false);

  // NEW: Confirmation modal state
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);


  const aiFeedbackHelper = getAIFeedbackHelper();

  // OpenAI Realtime Transcription (using gpt-4o-mini-transcribe model)

  // Utility function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // NEW: Helper function to check network status (like example)
  const checkNetworkStatus = useCallback(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('No internet connection. Please check your network and try again.');
    }
    return true;
  }, []);

  // NEW: Helper function to detect if error is a transient network error (like example)
  const isTransientNetworkError = useCallback((error: any) => {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';

    // Network-related errors
    if (errorName === 'networkerror' || errorName === 'typeerror') {
      return true;
    }

    // Fetch-related errors
    if (errorMessage.includes('failed to fetch') ||
        errorMessage.includes('networkerror') ||
        errorMessage.includes('network request failed')) {
      return true;
    }

    // Timeout errors
    if (errorName === 'aborterror' ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('aborted')) {
      return true;
    }

    // HTTP 5xx errors (server errors that might be transient)
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // HTTP 408, 429 (timeout, rate limit)
    if (error.status === 408 || error.status === 429) {
      return true;
    }

    return false;
  }, []);

  // NEW: Helper function to make request with timeout and automatic retry for transient errors (like example)
  const makeRequestWithRetry = useCallback(async (url: string, options: RequestInit, maxRetries = 2) => {
    checkNetworkStatus();

    let lastError: any;
    let timeoutId: NodeJS.Timeout | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout to request
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const requestOptions = {
          ...options,
          signal: controller.signal
        };

        const response = await fetch(url, requestOptions);
        if (timeoutId) clearTimeout(timeoutId);

        return response;
      } catch (error: any) {
        lastError = error;
        if (timeoutId) clearTimeout(timeoutId);

        // Check if it's a transient network error
        if (isTransientNetworkError(error) && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
          console.log(`🔄 Transient network error detected. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Not a transient error or max retries reached
        throw error;
      }
    }

    throw lastError;
  }, [checkNetworkStatus, isTransientNetworkError]);

  // Check microphone permission status without automatically requesting it
  React.useEffect(() => {
    const checkPermissionStatus = async () => {
      try {
        // Check if we're in a secure context (required for iOS)
        if (!window.isSecureContext && !window.location.hostname.includes('localhost')) {
          setError('Microphone access requires HTTPS. Please use a secure connection.');
          return;
        }

        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Microphone access is not supported in this browser. Please use a modern browser like Chrome, Safari, or Firefox.');
          return;
        }

        // Check permission status without requesting it
        if (navigator.permissions) {
          try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            if (permissionStatus.state === 'granted') {
              setHasMicPermission(true);
              setCurrentStep('recording');
              console.log('🎤 Microphone permission already granted');
            } else {
              console.log('🎤 Microphone permission not yet granted - user will need to click allow button');
            }
          } catch (err) {
            console.log('🎤 Could not check microphone permission status:', err);
          }
        }
      } catch (err) {
        console.error('🎤 Error checking microphone permission:', err);
      }
    };

    checkPermissionStatus();
  }, []);

  // Request microphone permission with forced popup
  const requestMicPermission = async () => {
    try {
      console.log('🎤 Requesting microphone permission...');

      // Check if we're in a secure context
      if (!window.isSecureContext) {
        setError('Microphone access requires HTTPS or localhost. Please use a secure connection.');
        return;
      }

      // This should trigger the browser's native permission popup
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      console.log('🎤 Microphone permission granted!');
      setHasMicPermission(true);
      setCurrentStep('recording');
      setError(null);

      // Stop the stream immediately - we just wanted permission
      stream.getTracks().forEach(track => track.stop());

    } catch (err) {
      console.error('🎤 Microphone permission denied:', err);

      const error = err as Error;
      if (error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser and try again.');
      } else if (error.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotSupportedError') {
        setError('Microphone access is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
      } else {
        setError(`Microphone access failed: ${error.message}`);
      }
    }
  };

  const currentPrompt = speakingPrompts[currentPromptIndex];
  const currentTranscript = transcripts[currentPrompt.id] || '';
  const currentFeedback = feedback[currentPrompt.id];

  // These functions are no longer needed with MediaRecorder approach
  const handleSpeechError = useCallback((error: string) => {
    console.error('Speech processing error:', error);
    setIsRecording(false);
    setError('Speech processing failed. Please try recording again.');
  }, []);


  // Handle analyzing transcript (second stage of two-stage processing)
  // Defined before handleRecordingComplete to avoid "before initialization" error
  const handleAnalyzeTranscript = useCallback(async (transcriptText: string) => {
    if (!transcriptText || !transcriptText.trim()) {
      console.error('🎤 Cannot analyze: No transcript provided');
      setAnalysisState('failed');
      setSubmissionError('No transcript available for analysis');
      setCurrentStep('error');
      return;
    }

    setAnalysisState('analyzing');
    setCurrentStep('analyzing');
    setSubmissionError(null);

    try {
      // Check network status before analysis
      checkNetworkStatus();

      console.log('🎤 Analyzing transcript with GPT-4o-mini...');
      console.log('🎤 API Request:', {
        transcription: transcriptText.substring(0, 100) + '...',
        prompt: currentPrompt.prompt,
        criteria: { grammar: true, vocabulary: true, pronunciation: false, topic_validation: true }
      });

      const response = await makeRequestWithRetry('/.netlify/functions/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription: transcriptText,
          prompt: currentPrompt.prompt,
          criteria: { grammar: true, vocabulary: true, pronunciation: false, topic_validation: true }
        })
      });

      console.log('🎤 API Response status:', response.status);

      let result;
      try {
        const responseText = await response.text();
        console.log('🎤 Raw API Response:', responseText.substring(0, 200) + '...');
        result = JSON.parse(responseText);
        console.log('🎤 Parsed API Result:', result);
      } catch (jsonError) {
        console.error('🎤 JSON parsing error:', jsonError);
        throw new Error('AI_SERVER_ERROR');
      }

      if (!result.success) {
        console.error('🎤 API returned success=false:', result);
        throw new Error(result.message || result.error || 'Analysis failed');
      }

      console.log('🎤 API call successful, processing result...');

      // Success - process the analysis result
      const analysisEndTime = Date.now();
      const totalDuration = (window as any).speakingTestStartTime ?
        (analysisEndTime - (window as any).speakingTestStartTime) / 1000 : 0;

      console.log(`✅ GPT ANALYSIS SUCCESS - Total process completed in ${totalDuration.toFixed(1)}s`);
      console.log(`📊 Scores: Grammar ${result.grammar_score}, Vocab ${result.vocabulary_score}, Fluency ${result.fluency_score}, Content ${result.content_score}`);

      // Clear countdown interval
      if ((window as any).speakingTestCountdownInterval) {
        clearInterval((window as any).speakingTestCountdownInterval);
        console.log('⏱️  Countdown stopped - process complete');
      }

      setAnalysisState('succeeded');
      setSubmissionError(null);

      // Verify word count
      const actualWordCount = transcriptText ? transcriptText.split(/\s+/).filter(word => word.length > 0).length : 0;

      const mappedScores = {
        overall_score: result.overall_score,
        is_off_topic: result.is_off_topic || false,
        feedback: result.feedback,
        grammar_corrections: result.grammar_corrections || [],
        vocabulary_corrections: result.vocabulary_corrections || [],
        ai_feedback: result.ai_feedback || null,
        api_status: result.api_status || (result.mock_data ? 'mock' : 'live')
      };

      setFeedback(prev => ({
        ...prev,
        [currentPrompt.id]: mappedScores
      }));
      setCurrentStep('feedback');

    } catch (error: any) {
      console.error('🎤 Analysis error:', error);
      setAnalysisState('failed');
      let errorMessage = 'Analysis failed. Please try again.';
      if (error.message && error.message.includes('No internet connection')) {
        errorMessage = error.message;
      } else if (error.message && (error.message.includes('timeout') || error.message.includes('aborted'))) {
        errorMessage = 'Request timed out. Your connection may be slow. Please try again.';
      } else if (error.message && error.message.includes('network')) {
        errorMessage = 'Connection failed. Please check your internet and try again.';
      } else if (error.message === 'AI_SERVER_ERROR' || error.message.includes('JSON')) {
        errorMessage = 'AI servers are overloaded. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      setSubmissionError(errorMessage);
      setCurrentStep('error');
    }
  }, [currentPrompt, checkNetworkStatus, makeRequestWithRetry]);

  const handleRecordingComplete = useCallback(async (audioBlob: Blob, recordingDuration: number) => {
    const processingStartTime = Date.now();
    const mediaStopToProcessingDelay = (window as any).speakingTestStopTime ?
      processingStartTime - (window as any).speakingTestStopTime : 0;
    console.log('🎤 handleRecordingComplete called with blob size:', audioBlob.size);
    console.log(`⏱️ Delay from stop button to processing start: ${mediaStopToProcessingDelay}ms`);
    console.log('🎬 AUDIO PROCESSING STARTED - Converting and sending to APIs...');

    // Setup cleanup function for UI timeouts
    let phaseTimeout: NodeJS.Timeout | null = null;
    const cleanup = () => {
      if (phaseTimeout) {
        clearTimeout(phaseTimeout);
        phaseTimeout = null;
      }
    };

    // Prevent duplicate processing
    if (isProcessing) {
      console.log('🎤 Already processing, skipping duplicate call');
      return;
    }

    console.log('🎤 Recording completed, duration:', recordingDuration);
    console.log('🎤 Setting isProcessing to true and currentStep to analyzing...');

    // IMMEDIATE STATE CHANGES - should show "Analyzing..." instantly
    setIsProcessing(true);
    setRecordingTime(recordingDuration);
    setCurrentStep('analyzing');
    setAnalysisState('analyzing');
    setError(null);

    console.log('🎤 State changes completed - UI should now show Analyzing...');

    try {
      // Validate audio blob before processing
      if (!audioBlob) {
        throw new Error('No audio recording available. Please record again.');
      }
      if (audioBlob.size === 0) {
        throw new Error('Audio recording is empty. Please record again.');
      }
      if (audioBlob.size < 1000) { // Less than 1KB is likely corrupted
        throw new Error('Audio recording appears to be corrupted. Please record again.');
      }

      // Check network status
      try {
        checkNetworkStatus();
      } catch (networkError) {
        console.error('🎤 Network check failed:', networkError);
        setSubmissionError(networkError instanceof Error ? networkError.message : 'Network check failed');
        setCurrentStep('error');
        setIsProcessing(false);
        return;
      }

      // Convert to base64
      console.log('🔄 Starting base64 conversion...');
      const base64StartTime = Date.now();
      const base64Audio = await blobToBase64(audioBlob);
      const base64Time = Date.now() - base64StartTime;
      console.log(`✅ Base64 conversion completed in ${base64Time}ms`);

      // Store metadata for potential retry
      setFailedPayload({
        test_id: 'evaluation_test',
        question_id: 1
      });

      // USE NEW STREAMING ENDPOINT WITH PROGRESSIVE UI
      console.log('🎬 Using streaming analysis endpoint with progressive UI...');

      try {
        // Start with transcription phase
        setTranscriptionState('transcribing');
        setAnalysisState('idle');
        console.log('🎤 Starting transcription phase...');

        // Simulate progressive UI updates during processing
        phaseTimeout = setTimeout(() => {
          if (transcriptionState === 'transcribing') {
            console.log('🎤 Switching to analysis phase in UI...');
            setTranscriptionState('succeeded');
            setAnalysisState('analyzing');
          }
        }, 3000); // Switch to analysis phase after 3 seconds

        const apiCallStartTime = Date.now();
        const response = await makeRequestWithRetry('/.netlify/functions/ai-speech-to-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_blob: base64Audio,
            audio_mime_type: audioBlob.type || 'audio/webm',
            test_id: 'evaluation_test',
            question_id: currentPrompt.id,
            prompt: currentPrompt.prompt
          })
        });

        if (!response.ok) {
          throw new Error(`Streaming analysis request failed: ${response.status}`);
        }

        const apiResponseTime = Date.now();
        const apiCallDuration = apiResponseTime - apiCallStartTime;

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || result.message || 'Streaming analysis failed');
        }

        const processingCompleteTime = Date.now();
        const totalDuration = (window as any).speakingTestStartTime ?
          (processingCompleteTime - (window as any).speakingTestStartTime) / 1000 : 0;
        const serverProcessingTime = result.timing || 0;
        const networkAndClientDelay = totalDuration - (serverProcessingTime / 1000);

        console.log(`🌐 API call completed in ${apiCallDuration}ms`);
        console.log(`⏱️ Server processing: ${serverProcessingTime}ms`);
        console.log(`⏱️ Network + client delay: ${networkAndClientDelay.toFixed(1)}s`);
        console.log(`🎯 TOTAL TIME BREAKDOWN:`);
        console.log(`  - Stop button to processing start: ${mediaStopToProcessingDelay}ms`);
        console.log(`  - Base64 conversion: ${base64Time}ms`);
        console.log(`  - API call: ${apiCallDuration}ms`);
        console.log(`  - Server processing: ${serverProcessingTime}ms`);
        console.log(`  - Total delay: ${(totalDuration - serverProcessingTime/1000).toFixed(1)}s`);

        console.log(`✅ STREAMING ANALYSIS SUCCESS - Total completed in ${totalDuration.toFixed(1)}s (server reported: ${result.timing}ms)`);
        console.log(`📝 Transcript: "${result.transcript.substring(0, 100)}${result.transcript.length > 100 ? '...' : ''}"`);
        console.log(`📊 Score: ${result.feedback?.overall_score || 'N/A'}/100`);

        // Cleanup UI updates
        cleanup();

        // Set final results
        setTranscriptionState('succeeded');
        setAnalysisState('succeeded');
        setCachedTranscript(result.transcript);
        setTranscriptId(result.transcript_id || null);

        // Set the transcription in transcripts state
        setTranscripts(prev => ({
          ...prev,
          [currentPrompt.id]: result.transcript
        }));

        // Set feedback result directly (already analyzed by streaming endpoint)
        if (result.feedback) {
          setFeedback(prev => ({
            ...prev,
            [currentPrompt.id]: result.feedback
          }));

          // Transition to feedback display
          setCurrentStep('feedback');
        }

      } catch (transcriptionError: any) {
        // Handle transcription errors
        console.error('🎤 Transcription error:', transcriptionError);
        setTranscriptionState('failed');

        // Set user-friendly error message
        let errorMessage = 'Transcription failed. Please try again.';
        if (transcriptionError.message && transcriptionError.message.includes('Your speech was not recognized')) {
          errorMessage = transcriptionError.message;
        } else if (transcriptionError.message && transcriptionError.message.includes('No internet connection')) {
          errorMessage = transcriptionError.message;
        } else if (transcriptionError.message && (transcriptionError.message.includes('timeout') || transcriptionError.message.includes('aborted'))) {
          errorMessage = 'Request timed out. Your connection may be slow. Please try again.';
        } else if (transcriptionError.message && transcriptionError.message.includes('network')) {
          errorMessage = 'Connection failed. Please check your internet and try again.';
        } else if (transcriptionError.message) {
          errorMessage = transcriptionError.message;
        }

        setSubmissionError(errorMessage);
        setCurrentStep('error');
        setIsProcessing(false);
      }

      } catch (error: any) {
        // Cleanup UI updates on error
        cleanup();

        // Handle unexpected errors
        console.error('Speaking test processing error:', error);

        // Check if it's a validation or network error
        if (error.message && (
          error.message.includes('No audio recording') ||
          error.message.includes('Audio recording is') ||
          error.message.includes('No internet connection')
        )) {
          setSubmissionError(error.message);
          setCurrentStep('error');
        } else {
          setError(error.message || 'An unexpected error occurred. Please try again.');
          setCurrentStep('recording');
        }
      } finally {
        setIsProcessing(false);
      }
  }, [isProcessing, currentPrompt.id, checkNetworkStatus, makeRequestWithRetry, handleAnalyzeTranscript]);

  // Store MediaRecorder reference for stopping
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // CRITICAL: Feature Detection for Audio Formats
  const getSupportedMimeType = useCallback(() => {
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

    const supportedType = preferredTypes.find(type =>
      MediaRecorder.isTypeSupported(type)
    );

    if (!supportedType) {
      throw new Error("No supported audio format found. Please update your browser.");
    }

    console.log(`✅ Non-iOS: Using audio format: ${supportedType}`);
    return supportedType;
  }, []);

  // Start recording with proper feature detection and direct upload
  const startRecording = useCallback(async () => {
    if (isRecording || !hasMicPermission) return;

    try {
      setIsRecording(true);
      setError(null);

      console.log(`🎬 Starting optimized audio recording for prompt: ${currentPrompt.id} (${currentPromptIndex + 1}/${speakingPrompts.length}) - "${currentPrompt.prompt.substring(0, 50)}..."`);

      // Platform-specific audio constraints
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      const audioConstraints = isIOSDevice
        ? { audio: { echoCancellation: true } } // iOS: minimal constraints
        : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }; // Others: full constraints

      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);

      // CRITICAL: Feature detection - find supported format
      const mimeType = getSupportedMimeType();
      console.log(`🎵 ${isIOSDevice ? 'iOS' : 'Non-iOS'}: Using audio format: ${mimeType}`);

      // Platform-specific MediaRecorder options
      const recorderOptions = isIOSDevice
        ? { mimeType } // iOS: no audioBitsPerSecond (not supported)
        : { mimeType, audioBitsPerSecond: 64000 }; // Others: optimal bitrate for speech

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);

      // Store reference for stopping
      mediaRecorderRef.current = mediaRecorder;

      // CRITICAL: Direct upload pattern - no blob conversion
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size === 0) return;

        console.log(`📤 Uploading audio chunk: ${(event.data.size / 1024).toFixed(1)}KB`);

        // Upload immediately - no conversion, no re-encoding
        await uploadAudioDirect(event.data, mimeType);
      };

      mediaRecorder.onstop = () => {
        console.log('🎙️ MediaRecorder stopped - finalizing...');
        const mediaRecorderStopTime = Date.now();
        const stopToMediaStopDelay = (window as any).speakingTestStopTime ?
          mediaRecorderStopTime - (window as any).speakingTestStopTime : 0;
        const actualRecordingDuration = (window as any).recordingStartTime ?
          mediaRecorderStopTime - (window as any).recordingStartTime : 0;

        console.log(`⏱️ Delay from stop button to MediaRecorder.onstop: ${stopToMediaStopDelay}ms`);
        console.log(`🎵 Actual recording duration: ${actualRecordingDuration}ms`);

        // Clear MediaRecorder reference
        mediaRecorderRef.current = null;

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      // Start recording - upload on stop (single chunk for short recordings)
      mediaRecorder.start();

      // Store recording start time for analysis
      (window as any).recordingStartTime = Date.now();

      // Auto-stop after 1 minute (60 seconds) - generous time for long responses
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('⏰ Auto-stopping recording after 1 minute');
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        }
      }, 60000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to start recording. Please check your microphone permissions.');
      setIsRecording(false);
    }
  }, [isRecording, hasMicPermission, getSupportedMimeType]);

  // CRITICAL: Direct upload with base64 encoding (more reliable than FormData)
  const uploadAudioDirect = useCallback(async (audioBlob: Blob, mimeType: string) => {
    try {
      console.log(`📤 Converting audio blob to base64... (${(audioBlob.size / 1024).toFixed(1)}KB)`);

      // Convert blob to base64 (more reliable for Netlify functions)
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
      const base64Audio = btoa(binaryString);

      const payload = {
        audio_blob: base64Audio,
        audio_mime_type: mimeType,
        test_id: 'evaluation_test',
        question_id: currentPrompt.id,
        prompt: currentPrompt.prompt
      };

      console.log(`🚀 Uploading audio... (${(base64Audio.length / 1024).toFixed(1)}KB base64)`);

      const response = await fetch('/.netlify/functions/ai-speech-to-text', { // Use existing reliable function
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || result.message || 'Processing failed');
      }

      console.log(`✅ Audio processed for ${currentPrompt.id} - Score: ${result.overall_score || 'N/A'}/100`);

      // Set transcript from the result
      setTranscripts(prev => ({
        ...prev,
        [currentPrompt.id]: result.transcript || ''
      }));
      console.log(`📝 Set transcript for ${currentPrompt.id}: "${result.transcript?.substring(0, 50)}..."`);

      // Update feedback
      setFeedback(prev => ({
        ...prev,
        [currentPrompt.id]: {
          overall_score: result.overall_score,
          is_off_topic: result.is_off_topic || false,
          feedback: result.feedback,
          grammar_corrections: result.grammar_corrections || [],
          vocabulary_corrections: result.vocabulary_corrections || []
        }
      }));
      console.log(`🤖 Set feedback for ${currentPrompt.id}: score ${result.overall_score}`);

      // Transition to feedback display
      setCurrentStep('feedback');
      setIsProcessing(false);

    } catch (error: any) {
      console.error('Direct upload error:', error);
      setSubmissionError('Failed to process audio. Please try again.');
      setCurrentStep('error');
      setIsProcessing(false);
    }
  }, [currentPrompt.id, currentPrompt.prompt]);

  // NEW: Retry transcription (re-convert audio and retry)
  const handleRetryTranscription = useCallback(async () => {
    if (!audioBlob) {
      console.error('🎤 Cannot retry transcription: No audio blob available');
      return;
    }

    // Check network status before retry
    try {
      checkNetworkStatus();
    } catch (networkError) {
      setSubmissionError(networkError instanceof Error ? networkError.message : 'Network check failed');
      setCurrentStep('error');
      return;
    }

    // Validate audio blob before retry
    try {
      if (!audioBlob) {
        throw new Error('No audio recording available. Please record again.');
      }
      if (audioBlob.size === 0) {
        throw new Error('Audio recording is empty. Please record again.');
      }
      if (audioBlob.size < 1000) {
        throw new Error('Audio recording appears to be corrupted. Please record again.');
      }
    } catch (validationError: any) {
      setSubmissionError(validationError.message);
      setCurrentStep('error');
      return;
    }

    setIsResending(true);
    setSubmissionError(null);
    setTranscriptionState('transcribing');
    setCurrentStep('transcribing');

    try {
      // Convert audio blob to base64
      const base64Audio = await blobToBase64(audioBlob);

      if (!base64Audio || base64Audio.length < 100) {
        throw new Error('Audio conversion failed. Please record again.');
      }

      console.log('🎤 Retrying transcription with WebM (fallback to WAV if needed)...');

      // Try WebM first, fallback to WAV if it fails (like example)
      let response;
      let result;
      let useWavFallback = false;

      // First retry attempt: WebM
      console.log('🎤 Retrying with WebM...');
      response = await makeRequestWithRetry('/.netlify/functions/ai-speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_blob: base64Audio,
          audio_mime_type: audioBlob.type || 'audio/webm',
          test_id: 'evaluation_test',
          question_id: currentPrompt.id
        })
      });

      if (!response.ok) {
        throw new Error(`WebM transcription retry failed: ${response.status}`);
      }

      result = await response.json();

      // If WebM failed, try WAV fallback
      if (!result.success && audioBlob.type !== 'audio/wav') {
        console.log('🎤 WebM retry failed, trying WAV fallback...');
        useWavFallback = true;

        // Convert to WAV (simplified - in real implementation you'd use convertBlobToWav16kHz)
        const wavBase64 = base64Audio; // In a real implementation, you'd convert to WAV first

        response = await makeRequestWithRetry('/.netlify/functions/ai-speech-to-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_blob: wavBase64,
            audio_mime_type: 'audio/wav',
            test_id: 'evaluation_test',
            question_id: currentPrompt.id
          })
        });

        if (!response.ok) {
          throw new Error(`WAV transcription retry failed: ${response.status}`);
        }

        result = await response.json();

        if (!result.success) {
          throw new Error(result.error || result.message || 'WAV transcription retry failed');
        }

        console.log('🎤 Transcription retry succeeded with WAV fallback:', result.cached ? '(cached)' : '(new)');
      } else if (!result.success) {
        throw new Error(result.error || result.message || 'Transcription retry failed');
      } else {
        console.log('🎤 Transcription retry succeeded with WebM:', result.cached ? '(cached)' : '(new)');
      }

      // Transcription retry succeeded (either WebM or WAV)
      setTranscriptionState('succeeded');
      setCachedTranscript(result.transcript);
      setTranscriptId(result.transcript_id || null);

      // Update transcripts state
      setTranscripts(prev => ({
        ...prev,
        [currentPrompt.id]: result.transcript
      }));

      setIsResending(false);

      // Auto-proceed to analysis
      await handleAnalyzeTranscript(result.transcript);

    } catch (error: any) {
      console.error('🎤 Transcription retry error:', error);
      setTranscriptionState('failed');
      setIsResending(false);
      let errorMessage = 'Transcription failed. Please try again.';
      if (error.message && error.message.includes('Your speech was not recognized')) {
        errorMessage = error.message;
      } else if (error.message && error.message.includes('No internet connection')) {
        errorMessage = error.message;
      } else if (error.message && (error.message.includes('timeout') || error.message.includes('aborted'))) {
        errorMessage = 'Request timed out. Your connection may be slow. Please try again.';
      } else if (error.message && error.message.includes('network')) {
        errorMessage = 'Connection failed. Please check your internet and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      setSubmissionError(errorMessage);
      setCurrentStep('error');
    }
  }, [audioBlob, currentPrompt.id, checkNetworkStatus, makeRequestWithRetry, handleAnalyzeTranscript]);

  // NEW: Retry analysis (uses cached transcript)
  const handleRetryAnalysis = useCallback(async () => {
    if (!cachedTranscript) {
      console.error('🎤 Cannot retry analysis: No cached transcript available');
      return;
    }

    // Check network status before retry
    try {
      checkNetworkStatus();
    } catch (networkError) {
      setSubmissionError(networkError instanceof Error ? networkError.message : 'Network check failed');
      setCurrentStep('error');
      return;
    }

    setIsResending(true);
    setSubmissionError(null);
    try {
      await handleAnalyzeTranscript(cachedTranscript);
      setIsResending(false);
    } catch (error) {
      setIsResending(false);
      // Error is already handled in handleAnalyzeTranscript
    }
  }, [cachedTranscript, handleAnalyzeTranscript, checkNetworkStatus]);

  // NEW: Handle resending to AI (fallback retry mechanism)
  const handleResend = useCallback(async () => {
    // Check if we have audio blob
    if (!audioBlob) {
      console.error('🎤 Cannot resend: No audio blob available');
      return;
    }

    // Use failedPayload if available
    const payloadMetadata = failedPayload || {
      test_id: 'evaluation_test',
      question_id: 1
    };

    setIsResending(true);
    setSubmissionError(null);
    setCurrentStep('processing');

    try {
      // Convert audio blob to base64
      const base64Audio = await blobToBase64(audioBlob);

      if (!base64Audio || base64Audio.length < 100) {
        throw new Error('Audio conversion failed. Please record again.');
      }

      // Create payload
      const payload = {
        audio_blob: base64Audio,
        audio_mime_type: audioBlob.type || 'audio/webm',
        test_id: 'evaluation_test',
        question_id: currentPrompt.id
      };

      // Store metadata for potential future retries
      if (!failedPayload) {
        setFailedPayload(payloadMetadata);
      }

      console.log('🎤 Resending audio for processing with WebM (fallback to WAV if needed)...');

      // Try WebM first, fallback to WAV if it fails (like example)
      let response;
      let result;
      let useWavFallback = false;

      // First resend attempt: WebM
      console.log('🎤 Resending with WebM...');
      response = await makeRequestWithRetry('/.netlify/functions/ai-speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_blob: base64Audio,
          audio_mime_type: audioBlob.type || 'audio/webm',
          test_id: 'evaluation_test',
          question_id: currentPrompt.id
        })
      });

      if (!response.ok) {
        throw new Error(`WebM resend failed: ${response.status}`);
      }

      result = await response.json();

      // If WebM failed, try WAV fallback
      if (!result.success && audioBlob.type !== 'audio/wav') {
        console.log('🎤 WebM resend failed, trying WAV fallback...');
        useWavFallback = true;

        // Convert to WAV (simplified - in real implementation you'd use convertBlobToWav16kHz)
        const wavBase64 = base64Audio; // In a real implementation, you'd convert to WAV first

        response = await makeRequestWithRetry('/.netlify/functions/ai-speech-to-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audio_blob: wavBase64,
            audio_mime_type: 'audio/wav',
            test_id: 'evaluation_test',
            question_id: currentPrompt.id
          })
        });

        if (!response.ok) {
          throw new Error(`WAV resend failed: ${response.status}`);
        }

        result = await response.json();

        if (!result.success) {
          throw new Error(result.error || result.message || 'WAV processing failed');
        }

        console.log('🎤 Processing resend succeeded with WAV fallback:', result.cached ? '(cached)' : '(new)');
      } else if (!result.success) {
        throw new Error(result.error || result.message || 'Processing resend failed');
      } else {
        console.log('🎤 Processing resend succeeded with WebM:', result.cached ? '(cached)' : '(new)');
      }

      // Success - clear error state
      setSubmissionError(null);
      setFailedPayload(null);
      setIsResending(false);

      // Process the successful result
      setCachedTranscript(result.transcript);
      setTranscriptId(result.transcript_id || null);

      // Update transcripts state
      setTranscripts(prev => ({
        ...prev,
        [currentPrompt.id]: result.transcript
      }));

      // Auto-analyze the transcript
      await handleAnalyzeTranscript(result.transcript);

    } catch (error: any) {
      console.error('🎤 Resend error:', error);
      let errorMessage = 'Processing failed. Please try again.';
      if (error.message && error.message.includes('Your speech was not recognized')) {
        errorMessage = error.message;
      } else if (error.message === 'AI_SERVER_ERROR' || error.message.includes('JSON')) {
        errorMessage = 'AI servers are overloaded. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      setSubmissionError(errorMessage);
      setCurrentStep('error');
      setIsResending(false);
    }
  }, [failedPayload, audioBlob, currentPrompt.id, makeRequestWithRetry, handleAnalyzeTranscript]);

  // Stop recording - Show confirmation modal first
  const stopRecording = useCallback(() => {
    console.log('🛑 STOP SPEAKING PRESSED - Showing confirmation modal');
    setShowStopConfirmation(true);
  }, []);

  // Confirm stop recording - Actually stop the recording
  const confirmStopRecording = useCallback(() => {
    console.log('🛑 CONFIRMED - Immediate stop + UI update');
    setShowStopConfirmation(false);

    // IMMEDIATE UI CHANGE: Show "Analyzing Your Speech" right away
    setIsRecording(false);
    setIsProcessing(true);
    setCurrentStep('analyzing');
    setAnalysisState('analyzing');
    setError(null);
    console.log('🎤 Stop recording confirmed - UI immediately shows Analyzing...');

    // Store timing reference for logging
    (window as any).speakingTestStopTime = Date.now();

    // CRITICAL: Actually stop the MediaRecorder immediately
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('🎤 Immediately stopping MediaRecorder...');
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null; // Clear reference
    } else {
      console.log('⚠️ No active MediaRecorder to stop');
    }
  }, []);



  // Handle completion
  const handleComplete = useCallback(async () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    // Calculate scores based on feedback and transcript length
    let totalScore = 0;
    let maxScore = 0;

    speakingPrompts.forEach(prompt => {
      const transcript = transcripts[prompt.id] || '';
      const promptFeedback = feedback[prompt.id];

      maxScore += 10; // Max 10 points per prompt

      // Score based on transcript length (minimum 10 words)
      const wordCount = transcript.trim().split(/\s+/).filter(word => word.length > 0).length;
      if (wordCount >= 10) {
        totalScore += 6; // 6 points for adequate length
      } else if (wordCount >= 5) {
        totalScore += 4; // 4 points for basic response
      } else if (transcript.trim().length > 0) {
        totalScore += 2; // 2 points for any attempt
      }

      // Add points based on AI feedback score if available
      if (promptFeedback?.score) {
        const feedbackPoints = Math.round((promptFeedback.score / 100) * 4); // Max 4 points from AI
        totalScore += feedbackPoints;
      }
    });

    onComplete({
      testType: 'speaking',
      score: totalScore,
      maxScore,
      percentage: Math.round((totalScore / maxScore) * 100),
      transcripts,
      feedback,
      timeSpent,
      completedAt: new Date().toISOString()
    });
  }, [transcripts, feedback, startTime, onComplete]);

  // Handle next prompt
  const handleNext = useCallback(async () => {
    console.log(`🔄 Switching from prompt ${currentPrompt.id} to next prompt`);
    if (currentPromptIndex < speakingPrompts.length - 1) {
      setCurrentPromptIndex(prev => prev + 1);
      console.log(`✅ Switched to prompt ${speakingPrompts[currentPromptIndex + 1].id}`);
    } else {
      console.log('🏁 All prompts completed, finishing evaluation');
      handleComplete();
    }
  }, [currentPromptIndex, currentPrompt.id, handleComplete]);

  const canProceed = currentTranscript.trim().length > 0;
  const allPromptsCompleted = speakingPrompts.every(prompt => transcripts[prompt.id]?.trim().length > 0);

  // Render different steps based on current state

  // Transcribing state
  if (currentStep === 'transcribing') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <MascotThinking
          speechText="Analyzing your Meow meow"
          alwaysShowSpeech={true}
          className="scale-125"
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
    );
  }

  // Analyzing state - Show fun mascot with speech bubble
  if (currentStep === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <MascotThinking
          speechText="Analyzing your Meow meow"
          alwaysShowSpeech={true}
          className="scale-125"
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
    );
  }

  // Error state with retry options
  if (currentStep === 'error') {
    const isTranscriptionError = transcriptionState === 'failed';
    const isAnalysisError = analysisState === 'failed';
    const retryHandler = isTranscriptionError ? handleRetryTranscription :
                       isAnalysisError ? handleRetryAnalysis :
                       handleResend;

    return (
      <Card>
        <Card.Header>
          <h3 className="text-xl font-semibold text-red-800">⚠️ Processing Error</h3>
          <p className="text-sm text-red-600">
            {submissionError}
          </p>
        </Card.Header>
        <Card.Body>
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              {isTranscriptionError
                ? 'Transcription failed. Click "Retry Transcription" to try again, or "Re-record" to start over.'
                : isAnalysisError
                ? 'Analysis failed. Your transcription was successful. Click "Retry Analysis" to try again.'
                : 'Your recording has been saved. Click "Resend" to try again, or "Re-record" to start over.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={retryHandler}
                disabled={isResending}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {isResending ? 'Retrying...' :
                 isTranscriptionError ? 'Retry Transcription' :
                 isAnalysisError ? 'Retry Analysis' : 'Resend'}
              </Button>

              {!isAnalysisError && (
                <Button
                  onClick={() => {
                    setAudioBlob(null);
                    setError(null);
                    setSubmissionError(null);
                    setFailedPayload(null);
                    setIsProcessing(false);
                    setIsResending(false);
                    setTranscriptionState('idle');
                    setAnalysisState('idle');
                    setCachedTranscript(null);
                    setTranscriptId(null);
                    setCurrentStep('recording');
                  }}
                  variant="secondary"
                  disabled={isResending}
                >
                  Re-record
                </Button>
              )}
            </div>
          </div>
        </Card.Body>
      </Card>
    );
  }

  if (currentStep === 'permission') {
    return (
      <Card>
        <Card.Header>
          <h3 className="text-xl font-semibold">{t('evaluation.speaking.title', 'Speaking Skills Test')}</h3>
          <p className="text-sm text-neutral-600">
            {t('evaluation.speaking.permissionInstructions', 'We need access to your microphone to record your speech. Click "Allow Microphone" to continue.')}
          </p>
        </Card.Header>
        <Card.Body>
          <div className="text-center py-8">
            <div className="mb-6">
              <div className="text-6xl mb-4">🎤</div>
              <h4 className="text-lg font-semibold mb-2">Microphone Access Required</h4>
              <p className="text-neutral-600">
                This test requires microphone access to record and analyze your spoken responses.
              </p>
            </div>

            <div className="mb-6">
              <Button
                onClick={requestMicPermission}
                size="lg"
                className="bg-blue-500 hover:bg-blue-600"
              >
                🎤 {t('evaluation.speaking.allowMicrophone', 'Allow Microphone Access')}
              </Button>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">{error}</p>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <h3 className="text-xl font-semibold">{t('evaluation.speaking.title', 'Speaking Skills Test')}</h3>
        <p className="text-sm text-neutral-600">
          {t('evaluation.speaking.instructions', 'Read the prompts aloud clearly. Your speech will be recorded and evaluated.')}
        </p>
      </Card.Header>
      <Card.Body>
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
            <Button
              onClick={() => setError(null)}
              size="sm"
              variant="secondary"
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-neutral-600 mb-2">
            <span>{t('evaluation.prompt', 'Prompt')}</span>
            <span>{currentPromptIndex + 1} of {speakingPrompts.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-900 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentPromptIndex + 1) / speakingPrompts.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Current Prompt */}
        <div className="mb-6 p-4 bg-blue-100 rounded-lg border-2 border-x-cyan-100">
          <h4 className="font-semibold text-black mb-2">
            🎤 {t('evaluation.speaking.prompt', 'Speaking Prompt')} {currentPromptIndex + 1}:
          </h4>
          <p className="text-black mb-3">{currentPrompt.prompt}</p>
          <div className="text-sm text-black bg-blue-100 p-2 rounded mb-2">
            <strong>{t('evaluation.speaking.instructions', 'Instructions')}:</strong> {currentPrompt.instructions}
          </div>
          <div className="text-sm text-blue-800 bg-yellow-50 border border-yellow-200 p-2 rounded mt-2">
            💡 <strong>{t('evaluation.speaking.tip', 'Tip')}:</strong> {t('evaluation.speaking.speakLonger', 'Speak longer for more accurate results. The more you say, the better we can assess your level.')}
          </div>
        </div>


        {/* Recording Controls - Hide during processing/transcribing/analyzing and when feedback exists */}
        {!isProcessing && (currentStep as SpeakingTestStep) !== 'transcribing' && (currentStep as SpeakingTestStep) !== 'analyzing' && !currentFeedback && (
          <div className="mb-6 flex justify-center">
            {!isRecording ? (
            <Button
              onClick={startRecording}
              size="lg"
              className="bg-blue-900 hover:bg-blue-800 text-white"
              disabled={isProcessing}
            >
              🎤 {t('evaluation.speaking.startRecording', 'Start Speaking')}
            </Button>
            ) : (
              <Button
                onClick={stopRecording}
                size="lg"
                className="bg-gray-500 hover:bg-gray-600"
              >
                ⏹️ {t('evaluation.speaking.stopRecording', 'Stop Recording')}
              </Button>
            )}
          </div>
        )}

        {/* Recording Status */}
        {isRecording && (
          <div className="mb-4 text-center">
            <div className="inline-flex items-center space-x-2 text-blue-900 mb-2">
              <div className="w-3 h-3 bg-blue-900 rounded-full animate-pulse"></div>
              <span className="font-medium">{t('evaluation.speaking.recording', 'Recording your speech...')}</span>
            </div>

          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mb-4 text-center">
            <div className="inline-flex items-center space-x-2 text-blue-600">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              <span>{t('evaluation.speaking.analyzing', 'Analyzing your speech...')}</span>
            </div>
          </div>
        )}

        {/* Combined Transcript and Feedback Display */}
        {currentTranscript && !isProcessing && (
          <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <h4 className="font-semibold text-green-800 mb-2">
              📝 {t('evaluation.speaking.yourResponse', 'Your Response')}:
            </h4>
            <p className="text-green-900 italic">&ldquo;{currentTranscript}&rdquo;</p>


            {/* AI Feedback in same container */}
            {currentFeedback && (
              <div className="mt-4 pt-4 border-t border-green-300">
                {/* Debug: Show current state */}
                <div className="mb-2 p-2 bg-yellow-100 text-xs text-yellow-800 rounded">
                  Debug: Prompt {currentPrompt.id}, Transcript: {currentTranscript ? 'YES' : 'NO'}, Feedback: {currentFeedback ? 'YES' : 'NO'}
                </div>
                <h5 className="font-semibold text-green-800 mb-3 flex items-center justify-between">
                  <span>{t('evaluation.speaking.aiFeedback', 'AI Feedback')}:</span>
                  {currentFeedback.api_status && currentFeedback.api_status === 'live' && (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                      🔗 Live API
                    </span>
                  )}
                </h5>

                {/* Topic validation - show if off-topic */}
                {currentFeedback.is_off_topic && (
                  <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-red-600 font-medium">⚠️ Off Topic</span>
                    </div>
                    <p className="text-red-800 text-sm">
                      {currentFeedback.feedback || `Your response doesn't seem to address the prompt. Please speak about: ${currentPrompt.prompt}`}
                    </p>
                    <div className="mt-3">
                      <Button
                        onClick={() => {
                          // Clear current transcript and feedback, allow re-recording
                          setTranscripts(prev => ({
                            ...prev,
                            [currentPrompt.id]: ''
                          }));
                          setFeedback(prev => ({
                            ...prev,
                            [currentPrompt.id]: undefined
                          }));
                        }}
                        size="sm"
                        className="bg-red-500 hover:bg-red-600"
                        disabled={isProcessing}
                      >
                        🎤 Try Again
                      </Button>
                    </div>
                  </div>
                )}

                    {/* Show feedback only if on-topic */}
                {!currentFeedback.is_off_topic && (
                  <>
                    {currentFeedback.overall_score !== undefined && (
                      <div className="mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{t('evaluation.score', 'Score')}:</span>
                          <div className="flex space-x-1">
                            {Array.from({ length: 5 }, (_, i) => (
                              <div
                                key={i}
                                className={`w-4 h-4 rounded ${
                                  i < Math.round(currentFeedback.overall_score / 20) ? 'bg-yellow-400' : 'bg-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-600">({currentFeedback.overall_score}/100)</span>
                        </div>
                      </div>
                    )}

                    {/* Concise Corrections */}
                    {currentFeedback.grammar_corrections && currentFeedback.grammar_corrections.length > 0 && (
                      <div className="mb-3">
                        <span className="font-medium text-red-700">Grammar:</span>
                        <div className="mt-1 space-y-1">
                          {currentFeedback.grammar_corrections.map((correction: any, index: number) => (
                            <div key={index} className="text-sm flex items-center space-x-2">
                              <span className="text-red-600 line-through">{correction.mistake}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-600 font-medium">{correction.correction}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentFeedback.vocabulary_corrections && currentFeedback.vocabulary_corrections.length > 0 && (
                      <div className="mb-3">
                        <span className="font-medium text-blue-700">Vocabulary:</span>
                        <div className="mt-1 space-y-1">
                          {currentFeedback.vocabulary_corrections.map((correction: any, index: number) => (
                            <div key={index} className="text-sm">
                              <span className="text-blue-600 font-medium">{correction.correction}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Brief feedback only */}
                    {currentFeedback.feedback && currentFeedback.feedback !== 'brief summary' && (
                      <div className="mb-3">
                        <p className="text-green-900 text-sm italic">{currentFeedback.feedback}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}


        {/* Navigation */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-neutral-600">
            {currentPromptIndex === speakingPrompts.length - 1
              ? (allPromptsCompleted
                  ? t('evaluation.readyToSubmit', 'Ready to submit your speaking test')
                  : t('evaluation.completeAllPrompts', 'Complete all prompts to finish')
                )
              : (canProceed
                  ? t('evaluation.clickNext', 'Click Next to continue')
                  : t('evaluation.recordResponse', 'Record your response to continue')
                )
            }
          </div>

          <Button
            onClick={handleNext}
            disabled={!canProceed || isProcessing}
            size="lg"
            className={canProceed ? 'bg-blue-500 hover:bg-blue-600' : ''}
          >
            {currentPromptIndex < speakingPrompts.length - 1
              ? t('evaluation.nextPrompt', 'Next')
              : t('evaluation.completeSpeaking', 'Complete Speaking Test')
            }
          </Button>
        </div>
      </Card.Body>
      
      {/* Stop Recording Confirmation Modal */}
      <Modal
        isOpen={showStopConfirmation}
        onClose={() => setShowStopConfirmation(false)}
        title={t('evaluation.speaking.stopRecordingTitle', 'Stop Recording?')}
        size="sm"
      >
        <div className="text-center">
          <p className="text-gray-600 mb-6">
            {t('evaluation.speaking.stopRecordingConfirm', 'Are you sure you want to stop recording?')}
          </p>
          <div className="flex justify-center space-x-4">
            <Button
              onClick={() => setShowStopConfirmation(false)}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800"
            >
              {t('common.no', 'No')}
            </Button>
            <Button
              onClick={confirmStopRecording}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {t('common.yes', 'Yes')}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default SpeakingTest;
