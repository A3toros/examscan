import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

// Initialize OpenAI client
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

interface RequestBody {
  audio_blob: string      // Base64 encoded audio (REQUIRED)
  audio_mime_type?: string
  prompt: string
  criteria?: {
    grammar?: boolean
    vocabulary?: boolean
    pronunciation?: boolean
    topic_validation?: boolean
  }
}

const handler: Handler = async (event, context) => {
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
    } as any;
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    } as any;
  }

  try {
    let body: RequestBody;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
      } as any;
    }

    if (!body.prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing prompt' })
      } as any;
    }

    if (!body.audio_blob) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing audio_blob' })
      } as any;
    }

    // Check OpenAI API key
    if (!OPENAI_API_KEY || OPENAI_API_KEY.trim() === '') {
      console.error('❌ CRITICAL: OpenAI API key is missing or empty!');
      throw new Error('OpenAI API key is required but not configured. Please set OPENAI_API_KEY in your environment.');
    }

    // TRANSCRIBE AUDIO - Copy exact logic from ai-speech-to-text.ts
    let transcription: string;
    try {
      console.log('🎤 Transcribing audio with OpenAI Whisper...');
      
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(body.audio_blob, 'base64');
      const bufferSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
      console.log(`🎤 Starting streaming transcription: ${bufferSizeMB}MB audio`);

      // Determine file extension (prioritize M4A/AAC for better performance)
      let fileExtension = 'm4a'; // Default to M4A (AAC) - better compression & speed
      if (body.audio_mime_type) {
        const normalizedMime = body.audio_mime_type.toLowerCase().split(';')[0].trim();
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
      const audioFile = new File([audioBuffer], `audio.${fileExtension}`, { 
        type: body.audio_mime_type || 'audio/webm' 
      });

      console.time('🎤 Transcription Time');
      console.log('🎤 Transcribing with OpenAI Whisper...');

      // Transcribe with OpenAI Whisper
      const transcriptionResult = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1', // Correct for offline uploads/batch transcription
        language: 'en',
        response_format: 'json',
        temperature: 0
      });

      transcription = transcriptionResult.text || '';
      transcription = transcription.trim();

      console.timeEnd('🎤 Transcription Time');
      console.log(`✅ Transcription completed: "${transcription.substring(0, 50)}..."`);

      if (!transcription || transcription.length === 0) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Your speech was not recognized, please speak louder',
            transcript: ''
          })
        } as any;
      }

      // Check for very short responses (skip feedback for meaningless audio)
      const wordCount = transcription.split(/\s+/).filter(word => word.length > 0).length;
      if (wordCount < 3) {
        console.log('⚡ Response too short, returning basic result');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            transcript: transcription,
            overall_score: 10,
            is_off_topic: true,
            feedback: "Your response is too short. Please introduce yourself with your name, where you're from, and what you like to do.",
            grammar_corrections: [],
            vocabulary_corrections: []
          })
        } as any;
      }

    } catch (transcribeError: any) {
      console.error('❌ Transcription failed:', transcribeError);

      if (transcribeError.message?.includes('invalid api key')) {
        throw new Error('OpenAI API key is invalid or expired');
      } else if (transcribeError.message?.includes('insufficient_quota')) {
        throw new Error('OpenAI API quota exceeded');
      } else if (transcribeError.message?.includes('audio too long')) {
        throw new Error('Audio file is too long for transcription');
      } else if (transcribeError.message?.includes('unsupported file format')) {
        throw new Error('Audio format not supported by OpenAI');
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Transcription failed',
          message: transcribeError.message || 'Failed to transcribe audio'
        })
      } as any;
    }

    // Now provide feedback on the transcription
    try {
      // Build criteria string for the prompt (if criteria provided)
      const activeCriteria = body.criteria 
        ? Object.entries(body.criteria)
            .filter(([_, enabled]) => enabled)
            .map(([criterion, _]) => criterion)
            .join(', ')
        : 'grammar, vocabulary, pronunciation, topic_validation';

      const systemPrompt = `Analyze speech for language learning. Return concise JSON:
{
  "overall_score": number (0-100),
  "is_off_topic": boolean (only if completely irrelevant),
  "feedback": "brief summary",
  "grammar_corrections": [{"mistake": "text", "correction": "text"}],
  "vocabulary_corrections": [{"mistake": "text", "correction": "text"}],
  "improved_transcript": "corrected and improved version of the student's transcript with all grammar and vocabulary mistakes fixed. If multiple sentences are provided, combine them into one coherent, well-structured paragraph that flows naturally. Use appropriate transitions and connectors to create a unified text.",
  "assessed_level": "Pre-A1" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "word_count": number,
  "grammar_constructions_count": number (count of distinct grammar structures used: simple past, present perfect, conditionals, passive voice, relative clauses, etc.),
  "vocabulary_quality": number (0-100),
  "fluency_score": number (0-100)
}

CRITICAL CONTEXT: This is a 1-minute (60 second) speaking evaluation. Word count expectations:
- 50 words in 1 minute = GOOD (average student performance)
- 75 words in 1 minute = VERY GOOD (above average)
- 100 words in 1 minute = EXCELLENT (fantastic performance, most students struggle to reach this)
- 120+ words in 1 minute = OUTSTANDING (exceptional fluency)

Be FAIR and GENEROUS in your assessment. Most students can barely say 50 words in 1 minute, so 100 words is truly excellent performance.

CRITICAL: Assess the student's CEFR level accurately based on these specific criteria:

C1 Level Indicators (Advanced):
- Uses sophisticated, precise vocabulary (academic, abstract, nuanced terms)
- Complex grammatical structures (subordinate clauses, conditionals, passive voice, advanced tenses)
- Coherent, well-structured arguments with clear logical flow
- Expresses nuanced opinions and abstract concepts
- Natural, fluent speech with minimal hesitation
- 100+ words with meaningful content (not just length)
- Minor errors don't significantly impact communication

B2 Level Indicators (Upper-Intermediate):
- Good range of vocabulary with some sophisticated words
- Generally accurate grammar with occasional errors
- Can discuss familiar and unfamiliar topics
- Clear expression of ideas, though may lack nuance
- Some hesitation but generally fluent

B1 Level Indicators (Intermediate):
- Basic to intermediate vocabulary
- Simple to moderate grammatical structures
- Can express opinions on familiar topics
- Noticeable errors but meaning is clear
- Some hesitation and self-correction

A1/A2 Level Indicators (Beginner/Elementary):
- Limited vocabulary, basic words
- Simple sentence structures
- Frequent errors that may affect meaning
- Difficulty expressing complex ideas

Assessment Guidelines:
- DO NOT penalize minor errors (typos, capitalization, small grammar mistakes) for C1/C2 candidates
- Focus on OVERALL language ability: vocabulary sophistication, grammatical complexity, coherence, and fluency
- A C1 speaker can have occasional minor errors but demonstrates advanced language control overall
- If the student uses advanced vocabulary, complex structures, and coherent arguments, assess as C1 even with minor corrections
- Word count expectations for 1-minute recording:
  * 30-50 words: Basic/Adequate (A1-A2 level)
  * 50-75 words: Good (B1 level)
  * 75-100 words: Very Good (B2 level)
  * 100+ words: Excellent (C1-C2 level)
- Grammar constructions count: Count distinct grammar structures (simple past, present perfect, conditionals, passive voice, relative clauses, subjunctive, etc.)
- Be GENEROUS with fluency_score: 100 words in 1 minute deserves 80-90+ fluency score
- Be GENEROUS with vocabulary_quality: If student uses varied vocabulary appropriate to their level, score 70-90+
- Quality and sophistication matter more than perfect grammar

Scoring Fairness:
- For 100 words in 1 minute: fluency_score should be 80-95 (not 70)
- For varied grammar constructions: grammar_constructions_count should reflect actual structures used
- Overall score should reward effort, fluency, and communication effectiveness

Return assessed_level as one of: Pre-A1, A1, A2, B1, B2, C1, C2`;

      console.log('🤖 Starting feedback analysis...');
      console.time('🤖 Feedback Analysis Time');

      const feedbackResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 800,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Recording Duration: 1 minute (60 seconds)\nPrompt: "${body.prompt}"\n\nStudent's spoken response: "${transcription}"\n\nPlease analyze their speaking performance fairly. Remember: 100 words in 1 minute is EXCELLENT performance. Count grammar constructions (simple past, present perfect, conditionals, passive voice, relative clauses, etc.) and be generous with fluency and vocabulary scores.\n\nIMPORTANT: For the improved_transcript, if the student provided multiple sentences or responses, combine them into one coherent, well-structured paragraph. Use appropriate transitions (e.g., "and", "but", "so", "because", "however", "furthermore") and connectors to create a unified text that flows naturally. The improved transcript should read as a single, cohesive paragraph rather than separate sentences.`
          }
        ]
      });

      if (!feedbackResponse.choices || !feedbackResponse.choices[0] || !feedbackResponse.choices[0].message || !feedbackResponse.choices[0].message.content) {
        throw new Error('Invalid response from OpenAI');
      }

      const aiResponse = feedbackResponse.choices[0].message.content;
      console.log('🤖 Raw feedback response:', aiResponse?.substring(0, 100) + '...');

      // Parse the JSON response
      let feedback;
      try {
        feedback = JSON.parse(aiResponse);
        console.timeEnd('🤖 Feedback Analysis Time');
        console.log(`✅ Feedback analysis completed - Score: ${feedback.overall_score}/100`);
      } catch (parseError) {
        console.error('❌ Failed to parse feedback JSON:', aiResponse);
        throw new Error('AI returned invalid JSON response');
      }

      // Validate the response structure (simplified)
      if (typeof feedback.overall_score !== 'number' || typeof feedback.feedback !== 'string') {
        console.error('AI response validation failed. Missing required fields:', {
          hasOverallScore: typeof feedback.overall_score === 'number',
          feedbackType: typeof feedback.feedback,
          actualResponse: feedback
        });
        throw new Error('AI response missing required fields');
      }

      // Validate correction arrays (optional but should be arrays if present)
      const correctionFields = ['grammar_corrections', 'vocabulary_corrections'];
      for (const field of correctionFields) {
        if (feedback[field] && !Array.isArray(feedback[field])) {
          console.warn(`AI response: ${field} should be an array but got ${typeof feedback[field]}`);
        }
      }

      // Validate assessed_level if present
      const validLevels = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      if (feedback.assessed_level && !validLevels.includes(feedback.assessed_level)) {
        console.warn('Invalid assessed_level from AI:', feedback.assessed_level);
        // Don't fail, just remove invalid level
        delete feedback.assessed_level;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          transcript: transcription, // Include transcript in response (like ai-speech-to-text.ts)
          ...feedback
        })
      } as any;

    } catch (error) {
      console.error('❌ OpenAI API call failed:', error);

      // Return error instead of mock fallback
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'AI feedback service unavailable',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          api_status: 'error'
        })
      } as any;
    }

  } catch (error) {
    console.error('AI feedback handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    } as any;
  }
};

export { handler };
