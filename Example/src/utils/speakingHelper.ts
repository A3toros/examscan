import { makeAuthenticatedRequest } from './api';

export interface SpeechRecognitionConfig {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface SpeechResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
}

export interface AudioRecordingConfig {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioRecordingResult {
  blob: Blob;
  duration: number;
  sampleRate: number;
}

export class SpeakingHelper {
  private recognition: SpeechRecognition | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isListening = false;
  private isRecording = false;

  constructor() {
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition() {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'en-US';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
    }
  }

  // Start speech recognition
  async startListening(
    config: SpeechRecognitionConfig = {},
    onResult: (result: SpeechResult) => void,
    onError: (error: string) => void,
    onEnd: () => void
  ): Promise<boolean> {
    if (!this.recognition) {
      onError('Speech recognition not supported in this browser');
      return false;
    }

    if (this.isListening) {
      onError('Already listening');
      return false;
    }

    try {
      // Apply configuration
      if (config.lang) this.recognition.lang = config.lang;
      if (config.continuous !== undefined) this.recognition.continuous = config.continuous;
      if (config.interimResults !== undefined) this.recognition.interimResults = config.interimResults;
      if (config.maxAlternatives !== undefined) this.recognition.maxAlternatives = config.maxAlternatives;

      this.recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        onResult({
          transcript,
          confidence,
          isFinal: result.isFinal,
          timestamp: Date.now()
        });
      };

      this.recognition.onerror = (event) => {
        onError(`Speech recognition error: ${event.error}`);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        onEnd();
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (error) {
      onError(`Failed to start speech recognition: ${error}`);
      return false;
    }
  }

  // Stop speech recognition
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  // Start audio recording
  async startRecording(
    config: AudioRecordingConfig = {},
    onDataAvailable?: (data: Blob) => void
  ): Promise<boolean> {
    if (this.isRecording) {
      console.warn('Already recording');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: config.sampleRate || 44100,
          channelCount: config.channelCount || 1,
          echoCancellation: config.echoCancellation !== false,
          noiseSuppression: config.noiseSuppression !== false,
          autoGainControl: config.autoGainControl !== false
        }
      });

      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          onDataAvailable?.(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  // Stop audio recording
  async stopRecording(): Promise<AudioRecordingResult | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;

        if (this.audioChunks.length > 0) {
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.audioChunks, { type: mimeType });

          // Calculate duration (rough estimate)
          const duration = this.audioChunks.reduce((total, chunk) => total + chunk.size, 0) / 16000; // Rough calculation

          resolve({
            blob,
            duration,
            sampleRate: 44100 // Default sample rate
          });
        } else {
          resolve(null);
        }

        // Stop all tracks to release microphone
        if (this.mediaRecorder?.stream) {
          this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
      };

      this.mediaRecorder.stop();
    });
  }

  // Check if speech recognition is supported
  isSpeechRecognitionSupported(): boolean {
    return !!this.recognition;
  }

  // Check if recording is supported
  isRecordingSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // Get current listening status
  getIsListening(): boolean {
    return this.isListening;
  }

  // Get current recording status
  getIsRecording(): boolean {
    return this.isRecording;
  }

  // Cleanup
  destroy(): void {
    this.stopListening();
    if (this.isRecording) {
      this.stopRecording();
    }
  }
}

// Singleton instance
let speakingHelperInstance: SpeakingHelper | null = null;

export const getSpeakingHelper = (): SpeakingHelper => {
  if (!speakingHelperInstance) {
    speakingHelperInstance = new SpeakingHelper();
  }
  return speakingHelperInstance;
};
