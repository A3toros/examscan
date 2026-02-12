import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Camera, Upload, CheckCircle, AlertCircle, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import ocrService, { OCRResult } from '../../services/ocrService';
import { authenticatedFetch } from '../../utils/auth';

interface Exam {
  id: number;
  name: string;
  total_questions: number;
  question_types: { question_number: number; type: 'mc' | 'tf'; options?: number }[];
  answer_key: Record<number, string>;
  mc_options_summary?: string;
  student_info?: {
    student_id?: boolean;
    student_id_digits?: number;
  };
}

interface ScanResult {
  examId: number;
  examName: string;
  studentAnswers: Record<number, string>;
  score: number;
  totalQuestions: number;
  confidence: number;
  studentId?: string;
  recognizedNumbers?: Array<{ digit: number | null; confidence: number }>;
  processingTime: number;
  imageQuality: number;
  // Dual detection results (bubbles)
  templateMethod?: {
    answers: Record<number, string>;
    score: number;
    confidence: number;
  };
  detectionMethod?: {
    answers: Record<number, string>;
    score: number;
    confidence: number;
  };
  // Dual student ID methods
  recognizedNumbersBySegments?: Array<{ digit: number | null; confidence: number }>;
  recognizedNumbersByTemplate?: Array<{ digit: number | null; confidence: number }>;
  studentIdDebugSegmentBoxes?: Array<{ squareIndex: number; segments: Record<string, { x: number; y: number; w: number; h: number }> }>;
}

function AnswerSheetScanner() {
  // Basic iOS detection (includes iPhone, iPad, iPod, and iPadOS)
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recognitionStatus, setRecognitionStatus] = useState<'idle' | 'searching' | 'ready' | 'captured'>('idle');

  // Detect if we're on a small/mobile screen (used for camera constraints)
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  });

  // Camera zoom (pinch + buttons). 1 = 100%, display-only (capture uses raw video).
  const [cameraZoom, setCameraZoom] = useState(1);
  const [cameraPan, setCameraPan] = useState({ x: 0, y: 0 });
  const zoomWrapperRef = useRef<HTMLDivElement>(null);
  const lastPinchRef = useRef<{ distance: number; centerX: number; centerY: number } | null>(null);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraCaptureInputRef = useRef<HTMLInputElement>(null);
  const cameraContainerRef = useRef<HTMLDivElement>(null);

  // Check camera permission status & viewport on mount
  useEffect(() => {
    checkCameraPermission();

    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMobileViewport(window.innerWidth <= 768);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load exams from API
  useEffect(() => {
    loadExams();
  }, []);

  // Check camera permission status
  const checkCameraPermission = async () => {
    try {
      // Use Permissions API if available
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          setHasCameraPermission(permissionStatus.state === 'granted');
          
          // Listen for permission changes
          permissionStatus.onchange = () => {
            setHasCameraPermission(permissionStatus.state === 'granted');
            if (permissionStatus.state === 'denied') {
              setCameraError('Camera access denied. Please allow camera permissions in your browser settings.');
            } else {
              setCameraError(null);
            }
          };
        } catch (err) {
          // Permissions API might not support 'camera' name in some browsers
          // Fall back to checking via getUserMedia
          console.log('Permissions API not fully supported, will check on button press');
          setHasCameraPermission(null);
        }
      } else {
        // Permissions API not available, will check on button press
        setHasCameraPermission(null);
      }
    } catch (error) {
      console.log('Could not check camera permission:', error);
      setHasCameraPermission(null);
    }
  };

  const loadExams = async () => {
    try {
      const response = await authenticatedFetch('/.netlify/functions/exams');

      if (response.ok) {
        const data = await response.json();
        // Transform API data to component format
        const transformedExams = data.exams?.map((exam: any) => {
          const sections = Array.isArray(exam.questions) ? exam.questions : [];
          const totalFromSections = sections.reduce(
            (total: number, section: any) => total + (Number(section.count) || 0),
            0
          );

          console.log('[OCR][db] exam test_structure', {
            examId: exam.id,
            examName: exam.exam_name,
            sections: sections.map((section: any) => ({
              type: section.type,
              count: Number(section.count) || 0,
              options: section.options,
            }))
          });

          const questionTypes = sections.length > 0
            ? sections.flatMap((section: any) => {
                const count = Number(section.count) || 0;
                const type = section.type === 'tf' ? 'tf' : 'mc';
                const optionsRaw = Number(section.options);
                const options = Number.isFinite(optionsRaw)
                  ? Math.min(4, Math.max(2, optionsRaw))
                  : undefined;
                return Array.from({ length: count }, () => ({ type, options }));
              }).map((q: any, index: number) => ({
                question_number: index + 1,
                type: q.type as 'mc' | 'tf',
                options: Number.isFinite(q.options)
                  ? Math.min(4, Math.max(2, q.options))
                  : undefined
              }))
            : (exam.question_types || []);

          console.log('[OCR][db] exam question_types', {
            examId: exam.id,
            examName: exam.exam_name,
            questionTypes: questionTypes.map((q: any) => ({
              type: q.type,
              options: q.options,
            }))
          });

          const mcOptionsSet = new Set<number>();
          sections.forEach((section: any) => {
            const type = section.type === 'tf' ? 'tf' : 'mc';
            if (type === 'mc') {
              const optionsRaw = Number(section.options);
              const options = Number.isFinite(optionsRaw)
                ? Math.min(4, Math.max(2, optionsRaw))
                : 4;
              mcOptionsSet.add(options);
            }
          });
          const mcOptionsSummary = Array.from(mcOptionsSet).sort().join(', ');

          return {
            id: exam.id,
            name: exam.exam_name,
            total_questions: totalFromSections || exam.total_questions || 0,
            question_types: questionTypes,
            answer_key: exam.answer_key || {},
            student_info: exam.student_info || undefined,
            mc_options_summary: mcOptionsSummary
          };
        }) || [];

        setExams(transformedExams);
      } else if (response.status === 401) {
        alert('Session expired. Please log in again.');
        window.location.href = '/login';
      } else {
        console.error('Failed to load exams');
        alert('Failed to load exams. Please check your connection and try again.');
      }
    } catch (error) {
      console.error('Error loading exams:', error);
      alert('Error loading exams. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize OpenCV on component mount
  useEffect(() => {
    ocrService.initialize().catch(console.error);
  }, []);

  // When we have a stream and a video element, attach the stream and handle readiness
  useEffect(() => {
    if (!stream || !videoRef.current) return;

    const video = videoRef.current;
    setCameraReady(false);

    console.log('[Camera] Attaching stream to video element from useEffect', {
      trackCount: stream.getTracks().length,
      videoTracks: stream.getVideoTracks().length,
    });

    video.srcObject = stream;

    const handleLoadedMetadata = () => {
      console.log('[Camera] Video metadata loaded', { w: video.videoWidth, h: video.videoHeight });
      setCameraReady(true);
    };

    video.onloadedmetadata = handleLoadedMetadata;

    const playPromise = video.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => console.log('[Camera] Video element play() resolved (effect)'))
        .catch(err => console.error('[Camera] Video element play() failed (effect)', err));
    }

    return () => {
      // Clean up handler when stream or component changes
      video.onloadedmetadata = null;
    };
  }, [stream]);

  const startCamera = async () => {
    console.log('[Camera] startCamera clicked', {
      hasCameraPermission,
      hasNavigatorMediaDevices: !!navigator.mediaDevices,
      hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
    });

    try {
      setCameraError(null);

      // If permission is already granted and we have a stream, don't request again
      if (hasCameraPermission === true && stream) {
        console.log('[Camera] Permission already granted and stream active, skipping new request');
        return;
      }

      // iOS-specific checks
      if (isIOS) {
        console.log('[Camera][iOS] Detected iOS device', {
          isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : undefined,
          protocol: typeof window !== 'undefined' ? window.location.protocol : undefined,
        });

        // iOS Safari requires HTTPS or localhost for camera access
        if (typeof window !== 'undefined' && !window.isSecureContext) {
          setCameraError(
            'On iPhone/iPad, camera access requires a secure connection (https) or localhost. Please open this page over https.'
          );
          return;
        }
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('[Camera] navigator.mediaDevices.getUserMedia is not available in this browser/context');
        setCameraError('Camera access is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
        return;
      }

      // Prefer back camera; keep constraints loose so stream actually starts on all devices.
      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: isMobileViewport ? 1280 : 1920 },
        height: { ideal: isMobileViewport ? 720 : 1080 },
      };

      console.log('[Camera] Requesting camera...', { isMobileViewport });

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      } catch (firstErr: any) {
        if (firstErr?.name === 'OverconstrainedError' || firstErr?.name === 'ConstraintNotSatisfiedError') {
          console.log('[Camera] Constraints failed, retrying with video: true');
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } else {
          throw firstErr;
        }
      }

      console.log('[Camera] getUserMedia succeeded', {
        trackCount: mediaStream.getTracks().length,
      });

      setHasCameraPermission(true);
      setStream(mediaStream);

      // On mobile, request fullscreen for the camera container once it's in the DOM
      if (isMobileViewport) {
        const tryFullscreen = () => {
          const el = cameraContainerRef.current;
          if (el && el.requestFullscreen) {
            el.requestFullscreen().catch(() => {});
          }
        };
        requestAnimationFrame(() => setTimeout(tryFullscreen, 100));
      }
    } catch (error: any) {
      console.error('[Camera] getUserMedia error:', error);
      
      // Update permission status based on error
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        console.warn('[Camera] Permission denied by user or browser settings');
        setHasCameraPermission(false);
        if (isIOS) {
          // iOS-specific guidance
          setCameraError(
            'Camera access denied on iPhone/iPad. Please go to Settings → Safari → Camera and allow access, then reload this page.'
          );
        } else {
          setCameraError('Camera access denied. Please allow camera permissions in your browser settings and try again.');
        }
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setCameraError('No camera found. Please connect a camera device and try again.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setCameraError('Camera is already in use by another application. Please close other applications and try again.');
      } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        console.warn('[Camera] OverconstrainedError, retrying with simpler constraints');
        setCameraError('Camera does not support the required settings. Trying with default settings...');
        // Retry with simpler constraints
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
          console.log('[Camera] Fallback getUserMedia({ video: true }) succeeded');
          setHasCameraPermission(true);
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            const playPromise = videoRef.current.play();
            if (playPromise && typeof playPromise.then === 'function') {
              playPromise
                .then(() => console.log('[Camera] Video element play() resolved (fallback)'))
                .catch(err => console.error('[Camera] Video element play() failed (fallback)', err));
            }
          }
          setCameraError(null);
        } catch (retryError) {
          console.error('[Camera] Fallback getUserMedia({ video: true }) failed', retryError);
          setCameraError('Camera access failed. Please check your camera settings and try again.');
        }
      } else {
        console.error('[Camera] Unknown camera error type', { name: error.name, message: error.message });
        setCameraError(`Camera access failed: ${error.message || 'Unknown error'}. Please try again.`);
      }
    }
  };

  const stopCamera = () => {
    if (document.fullscreenElement && cameraContainerRef.current?.contains(document.fullscreenElement)) {
      document.exitFullscreen().catch(() => {});
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraReady(false);
    setRecognitionStatus('idle');
    setCameraZoom(1);
    setCameraPan({ x: 0, y: 0 });
  };

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;
  const ZOOM_STEP = 0.35;

  const handleZoomIn = () => {
    setCameraZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
  };
  const handleZoomOut = () => {
    setCameraZoom((z) => {
      const next = Math.max(ZOOM_MIN, z - ZOOM_STEP);
      if (next <= 1) setCameraPan({ x: 0, y: 0 });
      return next;
    });
  };

  const getTouchDistance = (touches: React.TouchEvent['touches']) => {
    if (touches.length < 2) return 0;
    return Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);
  };
  const getTouchCenter = (touches: React.TouchEvent['touches']): { centerX: number; centerY: number } => {
    if (touches.length < 2) return { centerX: 0, centerY: 0 };
    return {
      centerX: (touches[0].clientX + touches[1].clientX) / 2,
      centerY: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const onZoomWrapperTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastPanRef.current = null;
      lastPinchRef.current = {
        distance: getTouchDistance(e.touches),
        ...getTouchCenter(e.touches),
      };
    } else if (e.touches.length === 1 && cameraZoom > 1) {
      lastPinchRef.current = null;
      lastPanRef.current = { x: e.touches[0].clientX - cameraPan.x, y: e.touches[0].clientY - cameraPan.y };
    }
  };

  const onZoomWrapperTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchRef.current) {
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      if (distance === 0) return;
      const ratio = distance / lastPinchRef.current.distance;
      setCameraZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z * ratio)));
      lastPinchRef.current = { distance, ...getTouchCenter(e.touches) };
    } else if (e.touches.length === 1 && lastPanRef.current !== null) {
      e.preventDefault();
      setCameraPan({
        x: e.touches[0].clientX - lastPanRef.current.x,
        y: e.touches[0].clientY - lastPanRef.current.y,
      });
    }
  };

  const onZoomWrapperTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) lastPinchRef.current = null;
    if (e.touches.length < 1) lastPanRef.current = null;
  };

  // Non-passive touchmove so we can preventDefault() during pinch/pan (stops page scroll)
  useEffect(() => {
    const el = zoomWrapperRef.current;
    if (!el) return;
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 || (e.touches.length === 1 && lastPanRef.current !== null)) e.preventDefault();
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, []);

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current || !selectedExam) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Ensure video metadata is loaded and has non-zero dimensions
    if (!cameraReady || !video.videoWidth || !video.videoHeight) {
      console.warn('[Camera] captureImage called before video is ready', {
        cameraReady,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
      setCameraError('Camera is not ready yet. Please wait a second after starting the camera, then try again.');
      return;
    }

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to image data for OCR processing
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    console.log('[OCR] Starting OCR from live camera frame', {
      width: canvas.width,
      height: canvas.height,
      examId: selectedExam.id,
      totalQuestions: selectedExam.total_questions,
      questionTypes: selectedExam.question_types,
    });

    setIsScanning(true);
    setRecognitionStatus('captured');

    try {
      // Transform question_types to match OCR service format
      const questionTypes = selectedExam.question_types.map(q => ({
        questionNumber: q.question_number,
        type: q.type,
        options: q.options
      }));

      console.log('[OCR][db] questionTypes summary (upload)', {
        examId: selectedExam.id,
        questionTypes: questionTypes.map(q => ({
          questionNumber: q.questionNumber,
          type: q.type,
          options: q.options
        }))
      });

      const layoutConfig = {
        studentInfoEnabled: true,
        studentIdEnabled: !!selectedExam.student_info?.student_id,
        studentIdDigits: selectedExam.student_info?.student_id_digits || 6
      };

      console.log('[OCR][db] student_id config (live camera)', {
        examId: selectedExam.id,
        studentIdEnabled: !!selectedExam.student_info?.student_id,
        studentIdDigits: selectedExam.student_info?.student_id_digits,
        layoutConfig
      });

      // Same pipeline as upload: one “photo” (this frame) → same OCR entry point
      const ocrResult: OCRResult = selectedExam.student_info?.student_id
        ? await ocrService.processAnswerSheetWithStudentID(
            imageData,
            questionTypes,
            selectedExam.student_info.student_id_digits ?? 6,
            layoutConfig
          )
        : await ocrService.processAnswerSheet(imageData, questionTypes, layoutConfig);

      console.log('[OCR] Result from live camera frame', {
        detectedBubblesCount: ocrResult.detectedBubbles?.length ?? 0,
        detectedBubblesSample: ocrResult.detectedBubbles?.slice(0, 10) ?? [],
        recognizedNumbers: ocrResult.recognizedNumbers,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.processingTime,
        imageQuality: ocrResult.imageQuality,
      });

      // Normalize answer for comparison (case-insensitive)
      const normalizeAnswer = (ans: unknown): string =>
        typeof ans === 'string' ? ans.trim().toUpperCase() : '';

      // Calculate score based on answer key (primary method)
      const studentAnswers: Record<number, string> = {};
      let correctAnswers = 0;

      ocrResult.detectedBubbles.forEach(bubble => {
        studentAnswers[bubble.questionNumber] = bubble.answer || '';
        const detected = normalizeAnswer(bubble.answer);
        const correct = normalizeAnswer(selectedExam.answer_key[bubble.questionNumber]);
        if (detected && detected === correct) {
          correctAnswers++;
        }
      });

      // Process template method results
      let templateMethod: ScanResult['templateMethod'] | undefined;
      if (ocrResult.templateMethod) {
        const templateAnswers: Record<number, string> = {};
        let templateCorrect = 0;
        ocrResult.templateMethod.bubbles.forEach(bubble => {
          templateAnswers[bubble.questionNumber] = bubble.answer || '';
          const detected = normalizeAnswer(bubble.answer);
          const correct = normalizeAnswer(selectedExam.answer_key[bubble.questionNumber]);
          if (detected && detected === correct) {
            templateCorrect++;
          }
        });
        templateMethod = {
          answers: templateAnswers,
          score: templateCorrect,
          confidence: ocrResult.templateMethod.confidence
        };
      }

      // Process detection method results
      let detectionMethod: ScanResult['detectionMethod'] | undefined;
      if (ocrResult.detectionMethod) {
        const detectionAnswers: Record<number, string> = {};
        let detectionCorrect = 0;
        ocrResult.detectionMethod.bubbles.forEach(bubble => {
          detectionAnswers[bubble.questionNumber] = bubble.answer || '';
          const detected = normalizeAnswer(bubble.answer);
          const correct = normalizeAnswer(selectedExam.answer_key[bubble.questionNumber]);
          if (detected && detected === correct) {
            detectionCorrect++;
          }
        });
        detectionMethod = {
          answers: detectionAnswers,
          score: detectionCorrect,
          confidence: ocrResult.detectionMethod.confidence
        };
      }

      const answeredCount = Object.keys(studentAnswers).length;
      console.log('[OCR] Scoring summary (live camera)', {
        answeredCount,
        correctAnswers,
        totalQuestions: selectedExam.total_questions,
        templateMethod: templateMethod ? { score: templateMethod.score, confidence: templateMethod.confidence } : null,
        detectionMethod: detectionMethod ? { score: detectionMethod.score, confidence: detectionMethod.confidence } : null
      });

      // Extract student ID if enabled
      let studentId: string | undefined;
      let recognizedNumbers: Array<{ digit: number | null; confidence: number }> | undefined;

      if (selectedExam.student_info?.student_id && ocrResult.recognizedNumbers) {
        recognizedNumbers = ocrResult.recognizedNumbers.map(num => ({
          digit: num.digit,
          confidence: num.confidence
        }));

        // Build student ID string from recognized digits
        const digits = ocrResult.recognizedNumbers
          .filter(num => num.digit !== null)
          .map(num => num.digit!.toString());

        studentId = digits.length > 0 ? digits.join('') : undefined;
      }

      const result: ScanResult = {
        examId: selectedExam.id,
        examName: selectedExam.name,
        studentAnswers,
        score: correctAnswers,
        totalQuestions: selectedExam.total_questions,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.processingTime,
        imageQuality: ocrResult.imageQuality,
        studentId,
        recognizedNumbers,
        templateMethod,
        detectionMethod,
        recognizedNumbersBySegments: ocrResult.recognizedNumbersBySegments?.map((n) => ({ digit: n.digit, confidence: n.confidence })),
        recognizedNumbersByTemplate: ocrResult.recognizedNumbersByTemplate?.map((n) => ({ digit: n.digit, confidence: n.confidence })),
        studentIdDebugSegmentBoxes: ocrResult.studentIdDebugSegmentBoxes
      };

      console.log('[OCR] Final scan result (live camera)', result);

      setScanResult(result);
      setShowResultModal(true);

      // Stop camera after successful scan
      stopCamera();

    } catch (error) {
      console.error('[OCR] OCR processing failed (live camera):', error);
      setCameraError('Failed to process the image. Please try again with better lighting and alignment.');
    } finally {
      setIsScanning(false);
      setRecognitionStatus('idle');
    }
  };

  // Lightweight auto-recognition loop while camera is on:
  // periodically analyzes frames and, when an answer sheet is confidently detected,
  // updates the UI and can trigger automatic capture via the main captureImage flow.
  useEffect(() => {
    if (!stream || !videoRef.current || !selectedExam || !cameraReady) {
      return;
    }

    let cancelled = false;
    let isChecking = false;

    const checkFrame = async () => {
      if (cancelled || isChecking || isScanning || recognitionStatus === 'captured') return;
      if (!videoRef.current || !canvasRef.current) return;

      isChecking = true;
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context || !video.videoWidth || !video.videoHeight) {
          return;
        }

        // Use a downscaled version for fast preview recognition
        const previewWidth = 640;
        const scale = previewWidth / video.videoWidth;
        const previewHeight = video.videoHeight * scale;

        canvas.width = previewWidth;
        canvas.height = previewHeight;
        context.drawImage(video, 0, 0, previewWidth, previewHeight);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

        setRecognitionStatus(prev => (prev === 'idle' ? 'searching' : prev));

        // Transform question_types to match OCR service format
        const questionTypes = selectedExam.question_types.map(q => ({
          questionNumber: q.question_number,
          type: q.type,
          options: q.options
        }));

        const layoutConfig = {
          studentInfoEnabled: true,
          studentIdEnabled: !!selectedExam.student_info?.student_id,
          studentIdDigits: selectedExam.student_info?.student_id_digits || 6
        };

        console.log('[OCR][db] student_id config (preview)', {
          examId: selectedExam.id,
          studentIdEnabled: !!selectedExam.student_info?.student_id,
          studentIdDigits: selectedExam.student_info?.student_id_digits,
          layoutConfig
        });

        const ocrResult: OCRResult = await ocrService.processAnswerSheet(
          imageData,
          questionTypes,
          layoutConfig
        );

        const detectedCount = ocrResult.detectedBubbles?.length ?? 0;
        const quality = ocrResult.imageQuality ?? 0;
        const confidence = ocrResult.confidence ?? 0;

        console.log('[OCR][Preview] frame analysis', {
          detectedCount,
          quality,
          confidence,
        });

        const hasEnoughBubbles = detectedCount > 0 && detectedCount >= Math.max(3, Math.floor(selectedExam.total_questions * 0.5));
        const goodQuality = quality >= 0.55;

        if (hasEnoughBubbles && goodQuality) {
          setRecognitionStatus('ready');
        } else {
          // Only set to 'searching' if not already 'captured' or 'ready'
          setRecognitionStatus(prev => {
            if (prev === 'captured' || prev === 'ready') {
              return prev;
            }
            return 'searching';
          });
        }
      } catch (error) {
        console.error('[OCR][Preview] Frame analysis failed:', error);
      } finally {
        isChecking = false;
      }
    };

    // On mobile use shorter interval for snappier auto-detect
    const intervalMs = isMobileViewport ? 1500 : 2000;
    const intervalId = window.setInterval(checkFrame, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [stream, selectedExam, cameraReady, isScanning, recognitionStatus, isMobileViewport]);

  // Auto-capture (and evaluate) on mobile once answer sheet is confidently detected
  useEffect(() => {
    if (isMobileViewport && recognitionStatus === 'ready' && !isScanning) {
      console.log('[OCR][AutoCapture] mobile: recognitionStatus=ready, auto-capturing and grading');
      void captureImage();
    }
  }, [isMobileViewport, recognitionStatus, isScanning]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedExam) return;

    console.log('[OCR] Starting OCR from uploaded image', {
      fileName: file.name,
      fileSize: file.size,
      examId: selectedExam.id,
      totalQuestions: selectedExam.total_questions,
      questionTypes: selectedExam.question_types,
      studentIdEnabled: !!selectedExam.student_info?.student_id,
      studentIdDigits: selectedExam.student_info?.student_id_digits || 6,
    });

    setIsScanning(true);

    try {
      const imageData = await fileToImageData(file);

      // Transform question_types to match OCR service format
      const questionTypes = selectedExam.question_types.map(q => ({
        questionNumber: q.question_number,
        type: q.type,
        options: q.options
      }));

      const layoutConfig = {
        studentInfoEnabled: true,
        studentIdEnabled: !!selectedExam.student_info?.student_id,
        studentIdDigits: selectedExam.student_info?.student_id_digits || 6
      };

      console.log('[OCR][db] student_id config (upload)', {
        examId: selectedExam.id,
        studentIdEnabled: !!selectedExam.student_info?.student_id,
        studentIdDigits: selectedExam.student_info?.student_id_digits,
        layoutConfig
      });

      // Use appropriate OCR method based on student ID settings
      const ocrResult = selectedExam.student_info?.student_id
        ? await ocrService.processAnswerSheetWithStudentID(
            imageData,
            questionTypes,
            selectedExam.student_info.student_id_digits || 6,
            layoutConfig
          )
        : await ocrService.processAnswerSheet(imageData, questionTypes, layoutConfig);

      console.log('[OCR] Result from uploaded image', {
        detectedBubblesCount: ocrResult.detectedBubbles?.length ?? 0,
        detectedBubblesSample: ocrResult.detectedBubbles?.slice(0, 10) ?? [],
        recognizedNumbers: ocrResult.recognizedNumbers,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.processingTime,
        imageQuality: ocrResult.imageQuality,
      });

      // Normalize answer for comparison (case-insensitive)
      const normalizeAnswer = (ans: unknown): string =>
        typeof ans === 'string' ? ans.trim().toUpperCase() : '';

      // Debug: log the raw answer key
      console.log('[OCR] Answer key debug (upload)', {
        answerKey: selectedExam.answer_key,
        answerKeyType: typeof selectedExam.answer_key,
        keys: Object.keys(selectedExam.answer_key),
        values: Object.values(selectedExam.answer_key)
      });

      // Process template method results
      let templateMethod: ScanResult['templateMethod'] | undefined;
      if (ocrResult.templateMethod) {
        const templateAnswers: Record<number, string> = {};
        let templateCorrect = 0;
        ocrResult.templateMethod.bubbles.forEach(bubble => {
          templateAnswers[bubble.questionNumber] = bubble.answer || '';
          const detected = normalizeAnswer(bubble.answer);
          const correct = normalizeAnswer(selectedExam.answer_key[bubble.questionNumber]);
          if (detected && detected === correct) {
            templateCorrect++;
          }
        });
        templateMethod = {
          answers: templateAnswers,
          score: templateCorrect,
          confidence: ocrResult.templateMethod.confidence
        };
      }

      // Process detection method results
      let detectionMethod: ScanResult['detectionMethod'] | undefined;
      if (ocrResult.detectionMethod) {
        const detectionAnswers: Record<number, string> = {};
        let detectionCorrect = 0;
        ocrResult.detectionMethod.bubbles.forEach(bubble => {
          detectionAnswers[bubble.questionNumber] = bubble.answer || '';
          const detected = normalizeAnswer(bubble.answer);
          const correct = normalizeAnswer(selectedExam.answer_key[bubble.questionNumber]);
          console.log('[OCR] Detection compare', {
            q: bubble.questionNumber,
            detected,
            correct,
            rawKey: selectedExam.answer_key[bubble.questionNumber],
            match: detected === correct
          });
          if (detected && detected === correct) {
            detectionCorrect++;
          }
        });
        detectionMethod = {
          answers: detectionAnswers,
          score: detectionCorrect,
          confidence: ocrResult.detectionMethod.confidence
        };
      }

      // Primary = method with higher score (so UI shows best result)
      const detectionScore = detectionMethod?.score ?? 0;
      const templateScore = templateMethod?.score ?? 0;
      let studentAnswers: Record<number, string>;
      let correctAnswers: number;
      if (detectionMethod && detectionScore >= templateScore) {
        studentAnswers = detectionMethod.answers;
        correctAnswers = detectionScore;
      } else if (templateMethod) {
        studentAnswers = templateMethod.answers;
        correctAnswers = templateScore;
      } else {
        studentAnswers = {};
        correctAnswers = 0;
        ocrResult.detectedBubbles.forEach(bubble => {
          studentAnswers[bubble.questionNumber] = bubble.answer || '';
          const detected = normalizeAnswer(bubble.answer);
          const correct = normalizeAnswer(selectedExam.answer_key[bubble.questionNumber]);
          if (detected && detected === correct) {
            correctAnswers++;
          }
        });
      }

      const answeredCount = Object.keys(studentAnswers).length;
      console.log('[OCR] Scoring summary (uploaded image)', {
        answeredCount,
        correctAnswers,
        totalQuestions: selectedExam.total_questions,
        templateMethod: templateMethod ? { score: templateMethod.score, confidence: templateMethod.confidence } : null,
        detectionMethod: detectionMethod ? { score: detectionMethod.score, confidence: detectionMethod.confidence } : null
      });

      // Extract student ID if enabled
      let studentId: string | undefined;
      let recognizedNumbers: Array<{ digit: number | null; confidence: number }> | undefined;

      if (selectedExam.student_info?.student_id && ocrResult.recognizedNumbers) {
        recognizedNumbers = ocrResult.recognizedNumbers.map(num => ({
          digit: num.digit,
          confidence: num.confidence
        }));

        const digits = ocrResult.recognizedNumbers
          .filter(num => num.digit !== null)
          .map(num => num.digit!.toString());
        studentId = digits.length > 0 ? digits.join('') : undefined;
      }

      const result: ScanResult = {
        examId: selectedExam.id,
        examName: selectedExam.name,
        studentAnswers,
        score: correctAnswers,
        totalQuestions: selectedExam.total_questions,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.processingTime,
        imageQuality: ocrResult.imageQuality,
        studentId,
        recognizedNumbers,
        templateMethod,
        detectionMethod,
        recognizedNumbersBySegments: ocrResult.recognizedNumbersBySegments?.map((n) => ({ digit: n.digit, confidence: n.confidence })),
        recognizedNumbersByTemplate: ocrResult.recognizedNumbersByTemplate?.map((n) => ({ digit: n.digit, confidence: n.confidence })),
        studentIdDebugSegmentBoxes: ocrResult.studentIdDebugSegmentBoxes
      };

      console.log('[OCR] Final scan result (uploaded image)', result);

      setScanResult(result);
      setShowResultModal(true);

    } catch (error) {
      console.error('[OCR] File processing failed:', error);
      setCameraError('Failed to process the uploaded image. Please ensure it\'s a clear photo of the answer sheet.');
    } finally {
      setIsScanning(false);
    }
  };

  const fileToImageData = (file: File): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        resolve(imageData!);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 text-sm font-semibold group-hover:bg-emerald-500/20">
            ES
          </span>
          <span className="text-lg font-semibold tracking-tight text-gray-900 group-hover:text-emerald-600">
            Exam<span className="text-emerald-500 group-hover:text-emerald-400">Scan</span>
          </span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Answer Sheet Scanner</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Use computer vision technology to automatically grade completed exams
          </p>
        </div>
      </div>

      {/* Exam Selection */}
      <Card className="mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Exam to Grade</h2>

        {loading ? (
          <div className="text-center py-8">
            <LoadingSpinner />
            <p className="text-gray-500 mt-2">Loading exams...</p>
          </div>
        ) : exams.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No exams available. Create an exam first to start scanning.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((exam) => (
              <div
                key={exam.id}
                onClick={() => setSelectedExam(exam)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedExam?.id === exam.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <h3 className="font-semibold text-gray-800 mb-2">{exam.name}</h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{exam.total_questions} questions</p>
                  <p>
                    {exam.question_types.filter(q => q.type === 'mc').length} Multiple Choice, {' '}
                    {exam.question_types.filter(q => q.type === 'tf').length} True/False
                  </p>
                  {exam.mc_options_summary && (
                    <p className="text-gray-600">
                      MC options: {exam.mc_options_summary}
                    </p>
                  )}
                  {exam.student_info?.student_id && (
                    <p className="text-blue-600 font-medium">
                      📝 Student ID: {exam.student_info.student_id_digits} digits
                    </p>
                  )}
                </div>
                {selectedExam?.id === exam.id && (
                  <CheckCircle className="text-blue-500 mt-2" size={20} />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Scanning Interface */}
      {selectedExam && (
        <Card className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <h2 className="text-lg md:text-xl font-semibold text-gray-800">
              Scanning: {selectedExam.name}
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Button
                onClick={() => cameraCaptureInputRef.current?.click()}
                disabled={isScanning}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
              >
                <Camera size={20} className="mr-2" />
                Take photo
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={isScanning}
                className="w-full sm:w-auto"
              >
                <Upload size={20} className="mr-2" />
                Upload image
              </Button>
              <Button
                onClick={startCamera}
                disabled={isScanning || !!stream}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Camera size={20} className="mr-2" />
                Live camera
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={cameraCaptureInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Camera View: full-screen on mobile, inline on desktop */}
          {stream && (
            <motion.div
              ref={cameraContainerRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={
                isMobileViewport
                  ? 'fixed inset-0 z-50 flex flex-col bg-black'
                  : 'mb-6'
              }
            >
              <div
                className={
                  isMobileViewport
                    ? 'relative flex-1 flex flex-col min-h-0'
                    : 'relative bg-gray-900 rounded-lg overflow-hidden'
                }
              >
                {/* Camera preview: video fills layer; zoom/pan on wrapper. */}
                <div
                  ref={zoomWrapperRef}
                  className={
                    isMobileViewport
                      ? 'relative flex-1 w-full min-h-[40vh] overflow-hidden touch-none'
                      : 'relative w-full aspect-[9/16] md:aspect-[16/9] overflow-hidden'
                  }
                  onTouchStart={onZoomWrapperTouchStart}
                  onTouchMove={onZoomWrapperTouchMove}
                  onTouchEnd={onZoomWrapperTouchEnd}
                  style={{ touchAction: 'none' }}
                >
                  <div
                    className="absolute inset-0 origin-center transition-transform duration-100"
                    style={{
                      transform: `scale(${Math.max(1, Math.min(4, Number(cameraZoom) || 1))}) translate(${cameraPan.x}px, ${cameraPan.y}px)`,
                    }}
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ display: 'block' }}
                    />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Alignment overlay for answer sheet borders */}
                  <div className="pointer-events-none absolute inset-4 md:inset-8 flex items-center justify-center">
                    <div
                      className={`h-full w-full rounded-md border-2 transition-colors duration-200
                        ${recognitionStatus === 'ready'
                          ? 'border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.4)]'
                          : 'border-slate-300/70 md:border-slate-200/80'}
                      `}
                    >
                      {/* Corner guides */}
                      <div className="absolute inset-0">
                        {/* top-left */}
                        <div className="absolute left-0 top-0 h-6 w-0.5 bg-white/80" />
                        <div className="absolute left-0 top-0 h-0.5 w-6 bg-white/80" />
                        {/* top-right */}
                        <div className="absolute right-0 top-0 h-6 w-0.5 bg-white/80" />
                        <div className="absolute right-0 top-0 h-0.5 w-6 bg-white/80" />
                        {/* bottom-left */}
                        <div className="absolute bottom-0 left-0 h-6 w-0.5 bg-white/80" />
                        <div className="absolute bottom-0 left-0 h-0.5 w-6 bg-white/80" />
                        {/* bottom-right */}
                        <div className="absolute bottom-0 right-0 h-6 w-0.5 bg-white/80" />
                        <div className="absolute bottom-0 right-0 h-0.5 w-6 bg-white/80" />
                      </div>
                    </div>
                  </div>

                  {/* Zoom controls: pinch works on the wrapper; buttons for zoom in/out */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
                    <button
                      type="button"
                      onClick={handleZoomIn}
                      disabled={cameraZoom >= ZOOM_MAX}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg hover:bg-black/80 disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
                      aria-label="Zoom in"
                    >
                      <ZoomIn size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      disabled={cameraZoom <= ZOOM_MIN}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg hover:bg-black/80 disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
                      aria-label="Zoom out"
                    >
                      <ZoomOut size={22} />
                    </button>
                  </div>
                </div>

                <div
                  className={
                    isMobileViewport
                      ? 'absolute bottom-4 left-0 right-0 z-20 p-4 flex flex-col gap-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto'
                      : 'absolute bottom-4 left-1/2 z-20 transform -translate-x-1/2 flex space-x-4'
                  }
                >
                  {!isMobileViewport && (
                    <>
                      <Button
                        onClick={captureImage}
                        disabled={isScanning || !cameraReady}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isScanning ? (
                          <>
                            <RefreshCw size={20} className="mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Camera size={20} className="mr-2" />
                            Capture & Grade
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={stopCamera}
                        variant="outline"
                        className="bg-white hover:bg-gray-100"
                      >
                        Stop Camera
                      </Button>
                    </>
                  )}
                  {isMobileViewport && (
                    <>
                      <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-white">
                        {recognitionStatus === 'idle' && (
                          <span>Position the answer sheet in view.</span>
                        )}
                        {recognitionStatus === 'searching' && (
                          <span className="flex items-center">
                            <span className="mr-2 inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                            Looking for answer sheet…
                          </span>
                        )}
                        {recognitionStatus === 'ready' && (
                          <span className="flex items-center text-emerald-300">
                            <span className="mr-2 inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                            Sheet detected — grading…
                          </span>
                        )}
                        {recognitionStatus === 'captured' && (
                          <span className="text-gray-300">Processing…</span>
                        )}
                      </div>
                      <Button
                        onClick={stopCamera}
                        variant="outline"
                        className="bg-white/90 hover:bg-white text-gray-900 border-0"
                      >
                        Stop Camera
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Recognition status + tips: desktop only (on mobile status is in overlay) */}
              {!isMobileViewport && (
                <>
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs sm:text-sm">
                    {recognitionStatus === 'idle' && (
                      <span className="text-gray-500">Camera ready. Position the answer sheet in view.</span>
                    )}
                {recognitionStatus === 'searching' && (
                  <span className="flex items-center text-amber-600">
                    <span className="mr-2 inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                    Looking for answer sheet… Adjust distance, angle, and lighting.
                  </span>
                )}
                {recognitionStatus === 'ready' && (
                  <span className="flex items-center text-emerald-600">
                    <span className="mr-2 inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                    Answer sheet recognized. Tap “Capture &amp; Grade” to scan.
                  </span>
                )}
                {recognitionStatus === 'captured' && (
                  <span className="text-gray-600">Processing captured image…</span>
                )}
              </div>

                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">Scanning Tips:</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Ensure good lighting and avoid shadows</li>
                      <li>• Keep the answer sheet flat and centered</li>
                      <li>• Place the answer sheet vertically (portrait)</li>
                      <li>• Make sure bubbles are clearly filled</li>
                      <li>• Avoid camera shake when capturing</li>
                    </ul>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Error Display */}
          {cameraError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="text-red-500 mr-3" size={24} />
                <div>
                  <h4 className="font-semibold text-red-800">Camera Error</h4>
                  <p className="text-red-700 text-sm">{cameraError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isScanning && (
            <div className="text-center py-8">
              <LoadingSpinner size="lg" message="Analyzing answer sheet with AI..." />
              <p className="text-gray-600 mt-4">
                Our computer vision algorithms are processing the image and detecting filled bubbles.
                This may take a few seconds for accurate results.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Results Modal */}
      {scanResult && (
        <Modal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          title="Scan Results"
          size="xl"
        >
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {scanResult.score}/{scanResult.totalQuestions}
                </div>
                <p className="text-sm text-blue-700">Correct Answers (Primary)</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round((scanResult.score / scanResult.totalQuestions) * 100)}%
                </div>
                <p className="text-sm text-green-700">Score Percentage</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className={`text-2xl font-bold ${getConfidenceColor(scanResult.confidence)}`}>
                  {Math.round(scanResult.confidence * 100)}%
                </div>
                <p className="text-sm text-purple-700">AI Confidence</p>
              </div>
            </div>

            {/* Dual Detection Methods Comparison */}
            {(scanResult.templateMethod || scanResult.detectionMethod) && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Detection Methods Comparison</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Template Method */}
                  {scanResult.templateMethod && (
                    <div className="p-4 bg-white rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-2">Template-Based Method</h4>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="text-xl font-bold text-blue-600">
                            {scanResult.templateMethod.score}/{scanResult.totalQuestions}
                          </div>
                          <p className="text-xs text-blue-700">Correct</p>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <div className={`text-xl font-bold ${getConfidenceColor(scanResult.templateMethod.confidence)}`}>
                            {Math.round(scanResult.templateMethod.confidence * 100)}%
                          </div>
                          <p className="text-xs text-purple-700">Confidence</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        Uses template positions with alignment shifts
                      </div>
                    </div>
                  )}

                  {/* Detection Method */}
                  {scanResult.detectionMethod && (
                    <div className="p-4 bg-white rounded-lg border border-green-200">
                      <h4 className="font-semibold text-green-800 mb-2">Detection-Based Method</h4>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="text-center p-2 bg-green-50 rounded">
                          <div className="text-xl font-bold text-green-600">
                            {scanResult.detectionMethod.score}/{scanResult.totalQuestions}
                          </div>
                          <p className="text-xs text-green-700">Correct</p>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded">
                          <div className={`text-xl font-bold ${getConfidenceColor(scanResult.detectionMethod.confidence)}`}>
                            {Math.round(scanResult.detectionMethod.confidence * 100)}%
                          </div>
                          <p className="text-xs text-purple-700">Confidence</p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        Uses HoughCircles to find actual bubble positions
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Student ID - primary + both methods */}
            {selectedExam?.student_info?.student_id && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Student ID</h3>
                {scanResult.studentId ? (
                  <div className="text-2xl font-mono font-bold text-yellow-900 bg-white px-3 py-2 rounded border inline-block">
                    {scanResult.studentId}
                  </div>
                ) : (
                  <div className="text-sm text-yellow-700">
                    Not detected. Try a clearer photo or fill the digits darker.
                  </div>
                )}
                {(scanResult.recognizedNumbersBySegments != null || scanResult.recognizedNumbersByTemplate != null) && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-yellow-800">Method comparison</p>
                    {scanResult.recognizedNumbersBySegments != null && (
                      <div className="text-sm">
                        <span className="text-yellow-700 font-medium">Segments:</span>{' '}
                        <span className="font-mono">
                          {scanResult.recognizedNumbersBySegments.map((n, i) => (n.digit !== null ? n.digit : '—')).join(' ')}
                        </span>
                      </div>
                    )}
                    {scanResult.recognizedNumbersByTemplate != null && (
                      <div className="text-sm">
                        <span className="text-yellow-700 font-medium">Templates:</span>{' '}
                        <span className="font-mono">
                          {scanResult.recognizedNumbersByTemplate.map((n, i) => (n.digit !== null ? n.digit : '—')).join(' ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {scanResult.recognizedNumbers && (
                  <div className="mt-3">
                    <p className="text-sm text-yellow-700 mb-1">Digit Recognition Details (primary):</p>
                    <div className="flex space-x-2">
                      {scanResult.recognizedNumbers.map((num, index) => (
                        <div key={index} className="text-center">
                          <div className={`w-8 h-8 rounded border-2 flex items-center justify-center font-bold text-sm ${
                            num.digit !== null
                              ? 'bg-green-100 border-green-400 text-green-800'
                              : 'bg-red-100 border-red-400 text-red-800'
                          }`}>
                            {num.digit !== null ? num.digit : '?'}
                          </div>
                          <div className="text-xs text-yellow-600 mt-1">
                            {Math.round(num.confidence * 100)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {scanResult.studentIdDebugSegmentBoxes && scanResult.studentIdDebugSegmentBoxes.length > 0 && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-yellow-700 font-medium">Debug: segment boxes (pixel coords)</summary>
                    <pre className="mt-1 p-2 bg-white rounded border overflow-auto max-h-32 text-gray-700">
                      {JSON.stringify(scanResult.studentIdDebugSegmentBoxes.slice(0, 2), null, 2)}
                      {scanResult.studentIdDebugSegmentBoxes.length > 2 ? `\n... +${scanResult.studentIdDebugSegmentBoxes.length - 2} more` : ''}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Processing Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Processing Time:</span> {scanResult.processingTime}ms
              </div>
              <div>
                <span className="font-medium">Image Quality:</span> {Math.round(scanResult.imageQuality * 100)}%
              </div>
            </div>

            {/* Answer Details */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Detailed Results</h4>
              
              {/* Comparison Table if both methods available */}
              {(scanResult.templateMethod || scanResult.detectionMethod) && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Method Comparison</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Q#</th>
                          <th className="text-center p-2">Correct</th>
                          <th className="text-center p-2">Primary</th>
                          {scanResult.templateMethod && <th className="text-center p-2">Template</th>}
                          {scanResult.detectionMethod && <th className="text-center p-2">Detection</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: scanResult.totalQuestions }, (_, i) => i + 1).map((questionNumber) => {
                          const correctAnswer = selectedExam?.answer_key[questionNumber];
                          const primaryAnswer = scanResult.studentAnswers[questionNumber] || '';
                          const templateAnswer = scanResult.templateMethod?.answers[questionNumber] || '';
                          const detectionAnswer = scanResult.detectionMethod?.answers[questionNumber] || '';
                          
                          const primaryMatch = primaryAnswer === correctAnswer;
                          const templateMatch = templateAnswer === correctAnswer;
                          const detectionMatch = detectionAnswer === correctAnswer;
                          
                          return (
                            <tr key={questionNumber} className="border-b hover:bg-gray-100">
                              <td className="p-2 font-medium">{questionNumber}</td>
                              <td className="p-2 text-center font-bold">{correctAnswer}</td>
                              <td className={`p-2 text-center ${primaryMatch ? 'text-green-600' : primaryAnswer ? 'text-red-600' : 'text-gray-400'}`}>
                                {primaryAnswer || '—'}
                              </td>
                              {scanResult.templateMethod && (
                                <td className={`p-2 text-center ${templateMatch ? 'text-green-600' : templateAnswer ? 'text-red-600' : 'text-gray-400'}`}>
                                  {templateAnswer || '—'}
                                </td>
                              )}
                              {scanResult.detectionMethod && (
                                <td className={`p-2 text-center ${detectionMatch ? 'text-green-600' : detectionAnswer ? 'text-red-600' : 'text-gray-400'}`}>
                                  {detectionAnswer || '—'}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="max-h-60 overflow-y-auto space-y-2">
                {Array.from({ length: scanResult.totalQuestions }, (_, i) => i + 1).map((questionNumber) => {
                  const answer = scanResult.studentAnswers[questionNumber] || '';
                  const correctAnswer = selectedExam?.answer_key[questionNumber];
                  const isAnswered = Boolean(answer);
                  const isCorrect = isAnswered && answer === correctAnswer;
                  const badgeClass = !isAnswered
                    ? 'bg-gray-100 text-gray-700'
                    : isCorrect
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800';

                  return (
                    <div key={questionNumber} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-medium">Question {questionNumber}:</span>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-sm ${badgeClass}`}>
                          Your answer: {isAnswered ? answer : 'Not detected'}
                        </span>
                        <span className="text-gray-500">
                          Correct: {correctAnswer || 'N/A'}
                        </span>
                        {!isAnswered ? (
                          <AlertCircle className="text-gray-400" size={16} />
                        ) : isCorrect ? (
                          <CheckCircle className="text-green-500" size={16} />
                        ) : (
                          <AlertCircle className="text-red-500" size={16} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button variant="outline" onClick={() => setShowResultModal(false)}>
                Close
              </Button>
              <Button onClick={() => {
                setShowResultModal(false);
                setScanResult(null);
                setSelectedExam(null);
              }}>
                Scan Another Sheet
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AnswerSheetScanner;
