import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Upload, Zap, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import ocrService, { OCRResult } from '../../services/ocrService';
import { getCurrentToken } from '../../utils/auth';

interface Exam {
  id: number;
  name: string;
  total_questions: number;
  question_types: { question_number: number; type: 'mc' | 'tf' }[];
  answer_key: Record<number, string>;
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
}

function AnswerSheetScanner() {
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load exams from API
  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      const token = getCurrentToken();
      if (!token) {
        alert('Please log in first');
        return;
      }

      const response = await fetch('/.netlify/functions/exams', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Transform API data to component format
        const transformedExams = data.exams?.map((exam: any) => ({
          id: exam.id,
          name: exam.exam_name,
          total_questions: exam.questions?.length || exam.total_questions || 0,
          question_types: exam.questions?.map((q: any, index: number) => ({
            question_number: index + 1,
            type: q.type === 'mc' ? 'mc' : 'tf'
          })) || [],
          answer_key: exam.answer_key || {},
          student_info: exam.student_info || undefined
        })) || [];

        setExams(transformedExams);
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

  const startCamera = async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera access failed:', error);
      setCameraError('Camera access denied. Please allow camera permissions and try again.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current || !selectedExam) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to image data for OCR processing
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    setIsScanning(true);

    try {
      // Process the image with enhanced OCR
      const ocrResult: OCRResult = await ocrService.processAnswerSheet(
        imageData,
        selectedExam.question_types
      );

      // Calculate score based on answer key
      const studentAnswers: Record<number, string> = {};
      let correctAnswers = 0;

      ocrResult.detectedBubbles.forEach(bubble => {
        studentAnswers[bubble.questionNumber] = bubble.answer || '';
        if (bubble.answer === selectedExam.answer_key[bubble.questionNumber]) {
          correctAnswers++;
        }
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
        recognizedNumbers
      };

      setScanResult(result);
      setShowResultModal(true);

      // Stop camera after successful scan
      stopCamera();

    } catch (error) {
      console.error('OCR processing failed:', error);
      setCameraError('Failed to process the image. Please try again with better lighting and alignment.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedExam) return;

    setIsScanning(true);

    try {
      const imageData = await fileToImageData(file);

      // Use appropriate OCR method based on student ID settings
      const ocrResult = selectedExam.student_info?.student_id
        ? await ocrService.processAnswerSheetWithStudentID(
            imageData,
            selectedExam.question_types,
            selectedExam.student_info.student_id_digits || 6
          )
        : await ocrService.processAnswerSheet(imageData, selectedExam.question_types);

      // Calculate score
      const studentAnswers: Record<number, string> = {};
      let correctAnswers = 0;

      ocrResult.detectedBubbles.forEach(bubble => {
        studentAnswers[bubble.questionNumber] = bubble.answer || '';
        if (bubble.answer === selectedExam.answer_key[bubble.questionNumber]) {
          correctAnswers++;
        }
      });

      const result: ScanResult = {
        examId: selectedExam.id,
        examName: selectedExam.name,
        studentAnswers,
        score: correctAnswers,
        totalQuestions: selectedExam.total_questions,
        confidence: ocrResult.confidence,
        processingTime: ocrResult.processingTime,
        imageQuality: ocrResult.imageQuality
      };

      setScanResult(result);
      setShowResultModal(true);

    } catch (error) {
      console.error('File processing failed:', error);
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Answer Sheet Scanner</h1>
        <p className="text-gray-600">Use computer vision technology to automatically grade completed exams</p>
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
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              Scanning: {selectedExam.name}
            </h2>
            <div className="flex space-x-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={isScanning}
              >
                <Upload size={20} className="mr-2" />
                Upload Image
              </Button>
              <Button
                onClick={startCamera}
                disabled={isScanning || !!stream}
                className="bg-green-600 hover:bg-green-700"
              >
                <Camera size={20} className="mr-2" />
                Start Camera
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

          {/* Camera View */}
          {stream && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6"
            >
              <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-96 object-contain"
                />
                <canvas ref={canvasRef} className="hidden" />

                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                  <Button
                    onClick={captureImage}
                    disabled={isScanning}
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
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Scanning Tips:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Ensure good lighting and avoid shadows</li>
                  <li>• Keep the answer sheet flat and centered</li>
                  <li>• Make sure bubbles are clearly filled</li>
                  <li>• Avoid camera shake when capturing</li>
                </ul>
              </div>
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
                <p className="text-sm text-blue-700">Correct Answers</p>
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

            {/* Student ID */}
            {scanResult.studentId && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Student ID Detected</h3>
                <div className="text-2xl font-mono font-bold text-yellow-900 bg-white px-3 py-2 rounded border inline-block">
                  {scanResult.studentId}
                </div>
                {scanResult.recognizedNumbers && (
                  <div className="mt-3">
                    <p className="text-sm text-yellow-700 mb-1">Digit Recognition Details:</p>
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
              <div className="max-h-60 overflow-y-auto space-y-2">
                {Object.entries(scanResult.studentAnswers).map(([questionNum, answer]) => {
                  const questionNumber = parseInt(questionNum);
                  const correctAnswer = selectedExam?.answer_key[questionNumber];
                  const isCorrect = answer === correctAnswer;

                  return (
                    <div key={questionNum} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-medium">Question {questionNum}:</span>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-sm ${
                          isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          Your answer: {answer || 'Not detected'}
                        </span>
                        <span className="text-gray-500">
                          Correct: {correctAnswer}
                        </span>
                        {isCorrect ? (
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
