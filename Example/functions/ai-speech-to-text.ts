import { Handler } from '@netlify/functions';
import * as crypto from 'crypto';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Environment variables
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_BASE_URL = process.env.ASSEMBLYAI_BASE_URL || 'https://api.assemblyai.com';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Simple in-memory cache (for serverless, consider external cache in production)
const transcriptionCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Global store for chunked uploads (in production, use Redis/external storage)
declare const global: any;
if (!global.audioChunksStore) {
  global.audioChunksStore = new Map();
}

function getCacheKey(testId: string, questionId: string, audioHash: string) {
  return `speaking_transcription_${testId}_${questionId}_${audioHash}`;
}

function getCachedTranscription(cacheKey: string) {
  const cached = transcriptionCache.get(cacheKey);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    transcriptionCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

function setCachedTranscription(cacheKey: string, data: any) {
  transcriptionCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

function generateAudioHash(audioBlob: string) {
  // Generate a simple hash from the first 1000 characters of base64
  // For production, consider using full hash with crypto.createHash
  const sample = audioBlob.slice(0, 1000);
  return crypto.createHash('md5').update(sample).digest('hex');
}

async function transcribeAudioWithAssemblyAI(audioBlob: string, audioMimeType: string, context: any = null) {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('AssemblyAI API key not configured');
  }

  try {
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBlob, 'base64');
    const bufferSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`Uploading audio to AssemblyAI: ${bufferSizeMB}MB (${audioBuffer.length} bytes), mime type: ${audioMimeType || 'auto-detect'}`);

    // Determine Content-Type for upload
    // AssemblyAI can auto-detect, but providing the correct type helps with metadata parsing
    let contentType = 'application/octet-stream';
    if (audioMimeType) {
      // Normalize mime type
      const normalizedMime = audioMimeType.toLowerCase().split(';')[0].trim();
      if (normalizedMime === 'audio/webm' || normalizedMime.includes('webm')) {
        contentType = 'audio/webm';
      } else if (normalizedMime === 'audio/wav' || normalizedMime === 'audio/wave' || normalizedMime === 'audio/x-wav') {
        contentType = 'audio/wav';
      } else if (normalizedMime === 'audio/mp3' || normalizedMime === 'audio/mpeg') {
        contentType = 'audio/mpeg';
      }
    }

    // Upload audio to AssemblyAI
    const uploadResponse = await fetch(`${ASSEMBLYAI_BASE_URL}/v2/upload`, {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY!,
        'Content-Type': contentType
      } as any,
      body: audioBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    const audioUrl = uploadResult.upload_url;
    console.log('Audio uploaded to AssemblyAI:', audioUrl);

    // Disable language_detection for WebM to avoid metadata issues
    // WebM files can have incomplete metadata causing "no spoken audio" errors
    // Always use English for all transcriptions
    const isWebM = audioMimeType && (audioMimeType.toLowerCase().includes('webm') || contentType === 'audio/webm');

    // Start transcription
    const transcriptionResponse = await fetch(`${ASSEMBLYAI_BASE_URL}/v2/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_API_KEY!,
        'Content-Type': 'application/json'
      } as any,
      body: JSON.stringify({
        audio_url: audioUrl,
        // Disable language_detection to avoid metadata issues (especially for WebM)
        language_detection: false, // Always disabled to prevent issues
        language_code: 'en', // Always use English
        punctuate: true,
        format_text: true
      })
    });

    if (!transcriptionResponse.ok) {
      throw new Error(`Transcription request failed: ${transcriptionResponse.status}`);
    }

    const transcriptResult = await transcriptionResponse.json();
    const transcriptId = transcriptResult.id;
    console.log('Transcription started, ID:', transcriptId);

    // Poll for completion with adaptive polling intervals
    // Use longer intervals when queued, shorter when processing
    let attempts = 0;
    const minRemainingTime = 2000; // Leave 2 seconds buffer for response
    const queuedPollInterval = 4000; // 4 seconds when queued (wait patiently for queue, no need to poll frequently)
    const processingPollInterval = 1000; // 1 second when processing (check more often once it starts)
    let currentStatus = 'queued';
    let pollInterval = queuedPollInterval;

    // Calculate max attempts based on remaining time (if available)
    let maxAttempts = 20; // Default fallback
    if (typeof context !== 'undefined' && context.getRemainingTimeInMillis) {
      const initialTime = context.getRemainingTimeInMillis();
      // Calculate max attempts: (remaining time - buffer) / average poll interval
      // Use average of queued and processing intervals for calculation
      const avgInterval = (queuedPollInterval + processingPollInterval) / 2;
      maxAttempts = Math.floor((initialTime - minRemainingTime) / avgInterval);
      maxAttempts = Math.max(10, Math.min(maxAttempts, 30)); // Between 10 and 30 attempts
      console.log(`Calculated max attempts: ${maxAttempts} based on ${initialTime}ms remaining time`);
    }

    while (attempts < maxAttempts) {
      // Check remaining time if context is available
      let remainingTime = null;
      if (typeof context !== 'undefined' && context.getRemainingTimeInMillis) {
        remainingTime = context.getRemainingTimeInMillis();
        if (remainingTime < minRemainingTime) {
          console.log(`Insufficient time remaining: ${remainingTime}ms, need at least ${minRemainingTime}ms`);
          throw new Error(`Transcription timeout: Insufficient time remaining (${remainingTime}ms)`);
        }
      }

      const statusResponse = await fetch(`${ASSEMBLYAI_BASE_URL}/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY!
        } as any
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.status}`);
      }

      const statusResult = await statusResponse.json();
      const status = statusResult.status;
      console.log(`Transcription status: ${status} (attempt ${attempts + 1})${remainingTime ? `, remaining: ${remainingTime}ms` : ''}`);

      // Adapt polling interval based on status
      if (status !== currentStatus) {
        currentStatus = status;
        if (status === 'queued') {
          pollInterval = queuedPollInterval; // Longer interval when queued - wait for queue
          console.log(`Status changed to queued, using ${pollInterval}ms polling interval (waiting for queue)`);
        } else if (status === 'processing') {
          pollInterval = processingPollInterval; // Shorter interval when processing - check more often
          console.log(`Status changed to processing, using ${pollInterval}ms polling interval (actively processing)`);
        }
      } else if (status === 'queued' && pollInterval !== queuedPollInterval) {
        // Ensure we're using the correct interval if still queued
        pollInterval = queuedPollInterval;
      } else if (status === 'processing' && pollInterval !== processingPollInterval) {
        // Ensure we're using the correct interval if processing
        pollInterval = processingPollInterval;
      }

      if (status === 'completed') {
        return {
          text: statusResult.text,
          transcript_id: transcriptId
        };
      } else if (status === 'error') {
        const errorMessage = statusResult.error || 'Unknown error';
        // Check for the specific "no spoken audio" error related to language_detection
        if (errorMessage.includes('language_detection') || errorMessage.includes('no spoken audio')) {
          console.warn('Language detection error detected, this may be due to WebM metadata issues:', errorMessage);
        }
        throw new Error(`Transcription failed: ${errorMessage}`);
      }

      // Wait before next poll (use current adaptive interval)
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error('Transcription timeout');

  } catch (error: any) {
    console.error('AssemblyAI error:', error);

    // Since we always disable language_detection now, these errors shouldn't occur
    // But if they do, log them for debugging
    const isLanguageDetectionError = error.message && (
      error.message.includes('language_detection') ||
      error.message.includes('no spoken audio')
    );

    if (isLanguageDetectionError) {
      console.warn('Language detection error occurred despite being disabled:', error.message);
      console.warn('This suggests a configuration or API issue. Check AssemblyAI settings.');
    }

    throw new Error(`Transcription failed: ${error.message}`);
  }
}

// Handler for streaming transcription
const streamHandler: Handler = async (event, context) => {
  console.log('=== STREAMING SPEECH ANALYSIS ===');

  // Enable CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    let { audio_blob, audio_mime_type, test_id, question_id } = body;

    if (!audio_blob) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing audio_blob parameter'
        })
      };
    }

    console.log(`🎬 Starting streaming analysis for ${test_id || 'unknown'}...`);

    // Use streaming function
    const result = await streamTranscribeAndAnalyze(audio_blob, audio_mime_type);

    console.log(`✅ Streaming analysis complete in ${result.timing}ms`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        transcript: result.transcript,
        transcript_id: result.transcript_id,
        feedback: result.feedback,
        timing: result.timing,
        cached: result.cached
      })
    };

  } catch (error: any) {
    console.error('Streaming handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Streaming analysis failed'
      })
    };
  }
};

// Legacy handler (keep for backward compatibility)
const handler: Handler = async (event, context) => {
  console.log('=== LEGACY TRANSCRIBE SPEAKING AUDIO ===');

  // Enable CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    let { audio_blob, audio_mime_type, test_id, question_id, audio_hash, chunk_index, total_chunks, is_chunked } = body;

    // FETCH THE ACTUAL PROMPT FROM DATABASE (at handler level)
    var questionPrompt = "Please respond to the speaking question."; // Default fallback

    if (test_id && question_id) {
      try {
        console.log('🔍 Fetching prompt from database for test:', test_id, 'question:', question_id);
        const { data: testData, error: testError } = await supabase
          .from('evaluation_test')
          .select('questions')
          .eq('id', test_id)
          .single();

        if (!testError && testData?.questions) {
          const question = testData.questions.find((q: any) => q.id === question_id);
          if (question?.prompt) {
            questionPrompt = question.prompt;
            (global as any).questionPrompt = questionPrompt; // Store globally for access in feedbackPromise
            console.log('✅ Found prompt:', questionPrompt);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching prompt:', error);
      }
    }


    // Handle chunked uploads - store chunks in memory (for serverless, consider external storage in production)
    if (is_chunked && typeof chunk_index !== 'undefined' && typeof total_chunks !== 'undefined') {
      // Validate chunk index
      if (chunk_index < 0 || chunk_index >= total_chunks) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Invalid chunk_index: ${chunk_index}. Must be between 0 and ${total_chunks - 1}`
          })
        };
      }

      // Validate chunk size (each chunk should be <= 3MB base64)
      const CHUNK_MAX_SIZE = 3 * 1024 * 1024; // 3MB base64
      if (audio_blob && audio_blob.length > CHUNK_MAX_SIZE) {
        return {
          statusCode: 413,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Chunk ${chunk_index + 1} is too large (${(audio_blob.length / 1024 / 1024).toFixed(2)}MB). Maximum chunk size is ${(CHUNK_MAX_SIZE / 1024 / 1024).toFixed(2)}MB`
          })
        };
      }

      const chunkKey = `audio_chunk_${test_id}_${question_id}_${audio_hash}_${chunk_index}`;

      // Store chunk (in production, use Redis, S3, or similar)
      global.audioChunksStore.set(chunkKey, {
        chunk: audio_blob,
        chunk_index,
        total_chunks,
        timestamp: Date.now()
      });

      console.log(`Received chunk ${chunk_index + 1}/${total_chunks} for ${test_id}/${question_id} (${(audio_blob?.length || 0) / 1024}KB)`);

      // If this is the last chunk, reassemble and process
      if (chunk_index === total_chunks - 1) {
        console.log('All chunks received, reassembling...');

        // Collect all chunks in order
        const chunks = [];
        const missingChunks = [];
        for (let i = 0; i < total_chunks; i++) {
          const key = `audio_chunk_${test_id}_${question_id}_${audio_hash}_${i}`;
          const chunkData = global.audioChunksStore.get(key);
          if (!chunkData) {
            missingChunks.push(i + 1);
          } else {
            chunks.push(chunkData.chunk);
          }
        }

        // Check for missing chunks
        if (missingChunks.length > 0) {
          // Clean up any existing chunks
          for (let i = 0; i < total_chunks; i++) {
            const key = `audio_chunk_${test_id}_${question_id}_${audio_hash}_${i}`;
            global.audioChunksStore.delete(key);
          }
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: `Missing chunks: ${missingChunks.join(', ')} of ${total_chunks}. Please retry the upload.`
            })
          };
        }

        // Reassemble base64
        const reassembledAudio = chunks.join('');

        // Validate reassembled audio
        if (!reassembledAudio || reassembledAudio.length < 100) {
          // Clean up chunks
          for (let i = 0; i < total_chunks; i++) {
            const key = `audio_chunk_${test_id}_${question_id}_${audio_hash}_${i}`;
            global.audioChunksStore.delete(key);
          }
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Reassembled audio is invalid or too small'
            })
          };
        }

        // Clean up chunks
        for (let i = 0; i < total_chunks; i++) {
          const key = `audio_chunk_${test_id}_${question_id}_${audio_hash}_${i}`;
          global.audioChunksStore.delete(key);
        }

        // Use reassembled audio for processing
        audio_blob = reassembledAudio;
        console.log(`Reassembled audio: ${reassembledAudio.length} base64 chars (${(reassembledAudio.length * 3 / 4 / 1024 / 1024).toFixed(2)}MB binary)`);
      } else {
        // Not the last chunk, just acknowledge receipt
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            chunk_received: true,
            chunk_index,
            total_chunks,
            message: `Chunk ${chunk_index + 1}/${total_chunks} received`
          })
        };
      }
    }

    // Calculate and log audio size information
    const base64Length = audio_blob ? audio_blob.length : 0;
    const estimatedBinarySizeMB = base64Length > 0 ? (base64Length * 3 / 4) / (1024 * 1024) : 0;
    const estimatedDurationSeconds = estimatedBinarySizeMB > 0 ? Math.floor(estimatedBinarySizeMB * 1024 * 1024 / (16 * 1000 * 2)) : 0; // 16kHz * 2 bytes

    console.log('Transcription request data:', {
      test_id,
      question_id,
      audio_mime_type: audio_mime_type || 'not provided (defaulting to WAV)',
      has_audio_blob: !!audio_blob,
      base64_length: base64Length,
      base64_size_kb: (base64Length / 1024).toFixed(2),
      estimated_binary_size_mb: estimatedBinarySizeMB.toFixed(2),
      estimated_duration_seconds: estimatedDurationSeconds,
      audio_hash: audio_hash || 'not provided'
    });

    // Validate payload size (only for non-chunked requests)
    // Chunked requests are validated per chunk (3MB max per chunk)
    if (!is_chunked) {
      const MAX_BASE64_SIZE = 4 * 1024 * 1024; // 4MB (conservative limit)
      if (base64Length > MAX_BASE64_SIZE) {
        console.error('Audio file too large (non-chunked):', {
          base64_length: base64Length,
          max_allowed: MAX_BASE64_SIZE,
          estimated_size_mb: estimatedBinarySizeMB.toFixed(2),
          estimated_duration_seconds: estimatedDurationSeconds
        });
        return {
          statusCode: 413, // Payload Too Large
          headers,
          body: JSON.stringify({
            success: false,
            error: `Audio file is too large (${estimatedBinarySizeMB.toFixed(1)}MB, ~${estimatedDurationSeconds}s). The system will automatically chunk large files. Please try again.`
          })
        };
      }
    }

    // Log remaining time if available
    if (context && context.getRemainingTimeInMillis) {
      const remainingTime = context.getRemainingTimeInMillis();
      console.log(`Function remaining time: ${remainingTime}ms (${(remainingTime / 1000).toFixed(1)}s)`);
    }

    // Validate input
    if (!audio_blob || !test_id || !question_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: audio_blob, test_id, question_id'
        })
      };
    }

    // Generate audio hash if not provided
    const finalAudioHash = audio_hash || generateAudioHash(audio_blob);
    const cacheKey = getCacheKey(test_id, question_id, finalAudioHash);

    // Check cache first
    const cachedResult = getCachedTranscription(cacheKey);
    if (cachedResult) {
      console.log('Cache hit for transcription:', cacheKey);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          transcript: cachedResult.transcript,
          transcript_id: cachedResult.transcript_id,
          cached: true
        })
      };
    }

    // Process audio with AssemblyAI for transcription
    console.log('Processing audio with AssemblyAI...');
    const transcriptionResult = await transcribeAudioWithAssemblyAI(audio_blob, audio_mime_type, context);
    console.log('Transcription result:', transcriptionResult);

    if (!transcriptionResult.text || transcriptionResult.text.trim().length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Your speech was not recognized, please speak louder'
        })
      };
    }

    // Cache the result
    setCachedTranscription(cacheKey, {
      transcript: transcriptionResult.text,
      transcript_id: transcriptionResult.transcript_id
    });
    console.log('Transcription cached:', cacheKey);

    // Check for very short responses (skip feedback for meaningless audio)
    const wordCount = transcriptionResult.text.trim().split(/\s+/).length;
    if (wordCount < 3) {
      console.log('⚡ Response too short, returning basic result');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          transcript: transcriptionResult.text,
          transcript_id: transcriptionResult.transcript_id,
          overall_score: 10,
          is_off_topic: true,
          feedback: "Your response is too short. Please introduce yourself with your name, where you're from, and what you like to do.",
          grammar_corrections: [],
          vocabulary_corrections: [],
          cached: false
        })
      };
    }

    // Generate feedback analysis with GPT-4o-mini
    console.log('🤖 Starting feedback analysis...');
    const feedbackStartTime = Date.now();

    try {
      const feedbackResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `Analyze speech for language learning. Return concise JSON:
{
  "overall_score": number (0-100),
  "is_off_topic": boolean (only if completely irrelevant),
  "feedback": "brief summary",
  "grammar_corrections": [{"mistake": "text", "correction": "text"}],
  "vocabulary_corrections": [{"mistake": "text", "correction": "text"}]
}

Keep it brief. Only flag as off-topic if completely irrelevant to speaking practice.`
          },
          {
            role: 'user',
            content: `Analyze: "${transcriptionResult.text}"

Provide scores and list specific grammar mistakes with corrections, plus vocabulary suggestions. Keep it brief and actionable.`
          }
        ]
      });

      const feedbackText = feedbackResponse.choices[0].message.content;
      console.log('🤖 Feedback response:', feedbackText?.substring(0, 100) + '...');

      const feedbackResult = JSON.parse(feedbackText || '{}');
      const feedbackTime = Date.now() - feedbackStartTime;

      console.log(`✅ Feedback analysis complete in ${feedbackTime}ms - Score: ${feedbackResult.overall_score}/100`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          transcript: transcriptionResult.text,
          transcript_id: transcriptionResult.transcript_id,
          overall_score: feedbackResult.overall_score,
          is_off_topic: feedbackResult.is_off_topic || false,
          feedback: feedbackResult.feedback,
          grammar_corrections: feedbackResult.grammar_corrections || [],
          vocabulary_corrections: feedbackResult.vocabulary_corrections || [],
          cached: false
        })
      };

    } catch (feedbackError: any) {
      console.error('Feedback analysis failed:', feedbackError);

      // Return transcription result without feedback if analysis fails
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          transcript: transcriptionResult.text,
          transcript_id: transcriptionResult.transcript_id,
          overall_score: 50, // Default score
          is_off_topic: false,
          feedback: "Analysis temporarily unavailable",
          grammar_corrections: [],
          vocabulary_corrections: [],
          cached: false
        })
      };
    }

  } catch (error: any) {
    console.error('Transcription processing error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Transcription failed'
      })
    };
  }
};

// NEW: Streaming transcription with progressive feedback
async function streamTranscribeAndAnalyze(audioBlob: string, audioMimeType: string, onProgress?: (progress: any) => void) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const startTime = Date.now();
  let transcriptionCompleted = false;
  let feedbackCompleted = false;
  let partialTranscript = '';
  let finalTranscript = '';
  let feedbackResult = null;

  try {
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBlob, 'base64');
    const bufferSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`🎤 Starting streaming transcription: ${bufferSizeMB}MB audio`);

    // Determine file extension (prioritize M4A/AAC for better performance)
    let fileExtension = 'm4a'; // Default to M4A (AAC) - better compression & speed
    if (audioMimeType) {
      const normalizedMime = audioMimeType.toLowerCase().split(';')[0].trim();
      if (normalizedMime === 'audio/mp4' || normalizedMime.includes('mp4') || normalizedMime.includes('m4a')) {
        fileExtension = 'm4a'; // M4A/AAC format (optimized)
      } else if (normalizedMime === 'audio/webm' || normalizedMime.includes('webm')) {
        fileExtension = 'webm'; // fallback
      } else if (normalizedMime === 'audio/wav' || normalizedMime === 'audio/wave' || normalizedMime === 'audio/x-wav') {
        fileExtension = 'wav';
      } else if (normalizedMime === 'audio/mp3' || normalizedMime === 'audio/mpeg') {
        fileExtension = 'mp3';
      }
    }

    // Create audio file for OpenAI
    const audioFile = new File([audioBuffer], `audio.${fileExtension}`, { type: audioMimeType || 'audio/webm' });

    // Progress callback: Starting transcription
    if (onProgress) {
      onProgress({
        stage: 'transcribing',
        progress: 0,
        message: 'Starting transcription...',
        transcript: '',
        feedback: null,
        timing: Date.now() - startTime
      });
    }

    // START TRANSCRIPTION (in background)
    const transcriptionPromise = (async () => {
      console.time('🎤 Transcription Time');
      console.log('🎤 Transcribing with OpenAI Whisper...');

      // Use correct model based on context - whisper-1 for offline/batch
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1', // Correct for offline uploads/batch transcription
        language: 'en',
        response_format: 'json',
        temperature: 0
      });

      finalTranscript = transcription.text || '';
      transcriptionCompleted = true;

      console.timeEnd('🎤 Transcription Time');
      console.log(`✅ Transcription completed: "${finalTranscript.substring(0, 50)}..."`);

      return finalTranscript;
    })();

    // SIMULATE PROGRESSIVE TRANSCRIPTION (since OpenAI doesn't stream)
    // In a real streaming implementation, we'd get partial transcripts here
    const progressInterval = setInterval(() => {
      if (transcriptionCompleted) {
        clearInterval(progressInterval);
        return;
      }

      // Simulate progressive transcription (would come from WebSocket in real streaming)
      const simulatedProgress = Math.min(40, (Date.now() - startTime) / 100); // Up to 40% during transcription

      if (onProgress) {
        onProgress({
          stage: 'transcribing',
          progress: simulatedProgress,
          message: `Transcribing... ${simulatedProgress.toFixed(0)}%`,
          transcript: partialTranscript,
          feedback: null,
          timing: Date.now() - startTime
        });
      }
    }, 500);

    // WAIT FOR TRANSCRIPTION TO COMPLETE
    await transcriptionPromise;
    clearInterval(progressInterval);

    // START FEEDBACK ANALYSIS IMMEDIATELY
    console.time('🤖 Feedback Analysis Time');
    console.log('🤖 Starting feedback analysis...');

    const feedbackPromise = (async () => {
      // Use dynamic prompt if available, otherwise fallback
      const currentPrompt = (global as any).questionPrompt || "Please respond to the speaking question.";

      // FAST LOCAL ANALYSIS for obvious cases (skip AI for very short responses)
      const wordCount = finalTranscript.split(/\s+/).filter(word => word.length > 0).length;

      if (wordCount < 3) {
        console.log('⚡ Using instant feedback for short response');
        return {
          overall_score: 10,
          is_off_topic: true,
          feedback: `Your response is too short. Please ${currentPrompt.toLowerCase()}`,
          grammar_corrections: [],
          vocabulary_corrections: []
        };
      }

      // FASTER FEEDBACK: Use streaming and simplified analysis
      const feedbackResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Correct model for live feedback
        temperature: 0,
        max_tokens: 500, // Even smaller for speed
        stream: false, // Keep simple for now
        messages: [
          {
            role: 'system',
            content: `Analyze speech for language learning. Return concise JSON:
{
  "overall_score": number (0-100),
  "is_off_topic": boolean (only if completely irrelevant),
  "feedback": "brief summary",
  "grammar_corrections": [{"mistake": "text", "correction": "text"}],
  "vocabulary_corrections": [{"mistake": "text", "correction": "text"}]
}

Keep it brief. Only flag as off-topic if completely irrelevant to speaking practice.`
          },
          {
            role: 'user',
            content: `Prompt: "${currentPrompt}"

Student's spoken response: "${finalTranscript}"

Please analyze their speaking performance. Focus on how well they addressed the prompt, their grammar accuracy, vocabulary usage, and fluency.`
          }
        ]
      });

      const feedbackText = feedbackResponse.choices[0].message.content;
      console.log('🤖 Raw feedback response:', feedbackText?.substring(0, 100) + '...');

      // Parse feedback JSON
      try {
        feedbackResult = JSON.parse(feedbackText || '{}');
        feedbackCompleted = true;

        console.timeEnd('🤖 Feedback Analysis Time');
        console.log(`✅ Feedback analysis completed - Score: ${feedbackResult.overall_score}/100`);

        // Final progress callback
        if (onProgress) {
          onProgress({
            stage: 'complete',
            progress: 100,
            message: 'Analysis complete!',
            transcript: finalTranscript,
            feedback: feedbackResult,
            timing: Date.now() - startTime
          });
        }

      } catch (parseError) {
        console.error('❌ Failed to parse feedback JSON:', feedbackText);
        throw new Error('Feedback parsing failed');
      }

      return feedbackResult;
    })();

    // PROGRESS UPDATES DURING FEEDBACK
    const feedbackProgressInterval = setInterval(() => {
      if (feedbackCompleted) {
        clearInterval(feedbackProgressInterval);
        return;
      }

      const feedbackProgress = 50 + Math.min(45, (Date.now() - startTime - 2000) / 50); // 50-95% during feedback

      if (onProgress) {
        onProgress({
          stage: 'analyzing',
          progress: feedbackProgress,
          message: `Analyzing speech... ${feedbackProgress.toFixed(0)}%`,
          transcript: finalTranscript,
          feedback: null,
          timing: Date.now() - startTime
        });
      }
    }, 300);

    // WAIT FOR FEEDBACK TO COMPLETE
    await feedbackPromise;
    clearInterval(feedbackProgressInterval);

    const totalTime = Date.now() - startTime;
    console.log(`🎉 Streaming analysis complete in ${totalTime}ms`);

    return {
      transcript: finalTranscript,
      transcript_id: `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      feedback: feedbackResult,
      timing: totalTime,
      cached: false
    };

  } catch (error: any) {
    console.error('🎤 Streaming transcription error:', error);

    if (error.message?.includes('invalid api key')) {
      throw new Error('OpenAI API key is invalid or expired');
    } else if (error.message?.includes('insufficient_quota')) {
      throw new Error('OpenAI API quota exceeded');
    } else if (error.message?.includes('audio too long')) {
      throw new Error('Audio file is too long for transcription');
    } else if (error.message?.includes('unsupported file format')) {
      throw new Error('Audio format not supported by OpenAI');
    }

    throw error;
  }
}

export { handler, streamHandler, streamTranscribeAndAnalyze };
