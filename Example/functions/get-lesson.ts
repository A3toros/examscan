import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { validateJWT } from './auth-validate-jwt.js';
import { getHeaders } from './cors-headers';

const handler: Handler = async (event, context) => {
  // Get security headers (no credentials needed for GET endpoint, but we'll allow credentials for authenticated endpoints)
  const headers = getHeaders(event, false);

  // Only allow GET and OPTIONS requests
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'OPTIONS') {
    return {
      statusCode: 405,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    } as any;
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    } as any;
  }

  try {
    // Validate authentication
    const cookies = event.headers?.cookie || '';
    const token = cookies.split(';').find(c => c.trim().startsWith('access_token='))?.split('=')[1];

    if (!token) {
      return {
        statusCode: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Authentication required' })
      } as any;
    }

    const auth = await validateJWT(token);
    if (!auth.isValid || !auth.user) {
      return {
        statusCode: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Invalid authentication' })
      } as any;
    }

    const userId = auth.user.id;

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('NEON_DATABASE_URL not configured');
      return {
        statusCode: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Database configuration error' })
      } as any;
    }

    const sql = neon(databaseUrl);

    const url = new URL(event.rawUrl || `http://localhost${event.path}`);
    const lessonId = url.searchParams.get('lessonId');

    if (!lessonId) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Lesson ID is required' })
      } as any;
    }

    // Get lesson basic info
    const lessonResult = await sql`SELECT * FROM lessons WHERE id = ${lessonId}`;

    if (lessonResult.length === 0) {
      return {
        statusCode: 404,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: false, error: 'Lesson not found' })
      } as any;
    }

    const lessonData = lessonResult[0];

    // Get lesson activities with related data (including new metadata fields)
    const activitiesResult = await sql`
      SELECT
        la.id,
        la.lesson_id,
        la.activity_type,
        la.activity_order,
        la.title,
        la.description,
        la.estimated_time_seconds,
        la.content,
        la.created_at,
        la.updated_at,
        COALESCE(json_agg(DISTINCT vi.*) FILTER (WHERE vi.id IS NOT NULL), '[]') as vocabulary_items,
        COALESCE(json_agg(DISTINCT gs.*) FILTER (WHERE gs.id IS NOT NULL), '[]') as grammar_sentences
      FROM lesson_activities la
      LEFT JOIN vocabulary_items vi ON la.id = vi.activity_id
      LEFT JOIN grammar_sentences gs ON la.id = gs.activity_id
      WHERE la.lesson_id = ${lessonId} AND la.active = TRUE
      GROUP BY la.id, la.lesson_id, la.activity_type, la.activity_order, la.title, la.description, 
               la.estimated_time_seconds, la.content, la.created_at, la.updated_at
      ORDER BY la.activity_order
    `;

    // Get user progress if userId provided
    let userProgress = null;
    let activityResults = null;
    if (userId) {
      const progressResult = await sql`
        SELECT * FROM user_progress
        WHERE user_id = ${userId} AND lesson_id = ${lessonId}
      `;

      if (progressResult.length > 0) {
        // Calculate actual progress percentage based on completed activities / total activities
        const totalActivities = await sql`
          SELECT COUNT(*) as total_count
          FROM lesson_activities
          WHERE lesson_id = ${lessonId} AND active = TRUE
        `;
        
        const completedActivities = await sql`
          SELECT COUNT(DISTINCT activity_order) as completed_count
          FROM lesson_activity_results
          WHERE user_id = ${userId} AND lesson_id = ${lessonId}
        `;
        
        let progressPercentage = 0;
        const totalCount = totalActivities.length > 0 ? Number(totalActivities[0].total_count) || 0 : 0;
        const completedCount = completedActivities.length > 0 ? Number(completedActivities[0].completed_count) || 0 : 0;
        
        if (totalCount > 0) {
          progressPercentage = Math.round((completedCount / totalCount) * 100);
          // Cap at 100%
          progressPercentage = Math.min(100, progressPercentage);
        } else if (progressResult[0].completed) {
          // If lesson is completed but no activity data, use 100%
          progressPercentage = 100;
        }
        
        userProgress = {
          ...progressResult[0],
          score: progressPercentage // Replace cumulative score with actual percentage
        };
        
        // Always fetch activity results from database (even if lesson is not completed)
        const results = await sql`
          SELECT 
            activity_type,
            activity_order,
            score,
            max_score,
            attempts,
            time_spent,
            completed_at,
            answers,
            feedback
          FROM lesson_activity_results
          WHERE user_id = ${userId} AND lesson_id = ${lessonId}
          ORDER BY activity_order ASC
        `;
        
        activityResults = results.map((result: any) => ({
          activityType: result.activity_type,
          activityOrder: result.activity_order,
          score: result.score || 0,
          maxScore: result.max_score || 0,
          attempts: result.attempts || 1,
          timeSpent: result.time_spent || 0, // Keep in seconds (database stores seconds)
          completed: true,
          completedAt: result.completed_at ? new Date(result.completed_at).getTime() : Date.now(),
          answers: result.answers,
          feedback: result.feedback
        }));
      }
    }

    // Transform data to match frontend expectations
    const lesson = {
      id: lessonData.id,
      level: lessonData.level,
      topic: lessonData.topic,
      lesson_number: lessonData.lesson_number,
      created_at: lessonData.created_at,
      updated_at: lessonData.updated_at,
      steps: {
        warmup: {
          prompt: '',
          aiFeedbackEnabled: true
        },
        vocabulary: {
          words: [] as Array<{ en: string; th: string; audio?: string }>,
          exercises: {
            matching: [] as Array<{ word: string; translation: string }>,
            fillBlanks: [] as Array<{
              activityOrder?: number;
              sentence?: string;
              text?: string;
              options?: string[];
              correct?: number;
              blanks?: Array<{
                id: string;
                text: string;
                options: string[];
                correctAnswer: string | number;
              }>;
            }>
          }
        },
        grammar: {
          explanation: '',
          examples: [] as Array<string>,
          sentences: [] as Array<{ sentence: string; translation?: string }>
        },
        speaking: {
          prompts: [] as Array<{ id: string; text: string }>,
          feedbackCriteria: {
            grammar: true,
            vocabulary: true,
            pronunciation: true
          }
        },
        improvement: {
          type: 'speaking_improvement' as 'speaking_improvement' | 'reading_improvement',
          prompt: '',
          improvedText: '',
          targetText: '',
          similarityThreshold: 70,
          audioUrl: '' as string | undefined
        }
      }
    };

    // Process activities and populate lesson steps
    activitiesResult.forEach((activity: any) => {
      const activityContent: any = activity.content || {};

      switch (activity.activity_type) {
        case 'warm_up_speaking':
          lesson.steps.warmup = {
            prompt: activityContent.prompt || '',
            aiFeedbackEnabled: activityContent.ai_feedback_enabled || true
          };
          break;

        case 'vocabulary_intro':
          // Vocabulary items are already included in the activity data
          if (activity.vocabulary_items && Array.isArray(activity.vocabulary_items) && activity.vocabulary_items.length > 0) {
            lesson.steps.vocabulary.words = activity.vocabulary_items.map((item: any) => ({
              en: item.english_word,
              th: item.thai_translation,
              audioUrl: item.audio_url
            }));
          } else {
            // Initialize empty array if no items
            lesson.steps.vocabulary.words = [];
          }
          break;

        case 'vocabulary_matching_drag':
        case 'vocab_match_drag': // Support old name for backward compatibility
          if (activity.vocabulary_items && Array.isArray(activity.vocabulary_items) && activity.vocabulary_items.length > 0) {
            // Append matching exercise as a new array to support multiple matching activities
            const matchingExercise = activity.vocabulary_items.map((item: any, index: number) => ({
              word: item.english_word,
              meaning: item.thai_translation
            }));
            lesson.steps.vocabulary.exercises.matching.push(matchingExercise);
          }
          break;

        case 'vocabulary_fill_blanks':
        case 'vocab_fill_dropdown': // Support old name for backward compatibility
          // Support both formats: with blanks array (proper format) or simple sentence+options
          if (activityContent.blanks && Array.isArray(activityContent.blanks) && activityContent.blanks.length > 0) {
            // Proper format: text + blanks array
            lesson.steps.vocabulary.exercises.fillBlanks.push({
              activityOrder: activity.activity_order, // Store actual activity_order from database
              text: activityContent.text || activityContent.sentence || '',
              blanks: activityContent.blanks.map((blank: any, index: number) => ({
                id: blank.id || `blank-${index}`,
                text: blank.text || '',
                options: blank.options || [],
                correctAnswer: blank.correctAnswer !== undefined ? blank.correctAnswer : (blank.options && blank.options[0] ? blank.options[0] : '')
              }))
            });
          } else {
            // Simple format: sentence + options (fallback for old data)
            lesson.steps.vocabulary.exercises.fillBlanks.push({
              activityOrder: activity.activity_order, // Store actual activity_order from database
              sentence: activityContent.sentence || activityContent.text || 'My name is _____. I am from _____. ____ you!',
              options: activityContent.options || [],
              correct: activityContent.correct || 0
            });
          }
          break;

        case 'grammar_explanation':
          // Grammar explanation content (rules + examples)
          if (activityContent && (activityContent.rules || activityContent.explanation)) {
            // Support both 'rules' (new) and 'explanation' (backward compatibility)
            lesson.steps.grammar.explanation = activityContent.rules || activityContent.explanation || '';
            lesson.steps.grammar.examples = activityContent.examples || [];
          }
          break;

        case 'grammar_sentences':
        case 'grammar_drag_sentence': // Support old name for backward compatibility
          if (activity.grammar_sentences && Array.isArray(activity.grammar_sentences) && activity.grammar_sentences.length > 0) {
            // Append sentences from this activity to the existing array (support multiple grammar_sentences activities)
            const newSentences = activity.grammar_sentences.map((sentence: any) => ({
              id: sentence.id,
              words: sentence.words_array || [],
              correct: sentence.correct_sentence
            }));
            // Initialize array if it doesn't exist, then append
            if (!lesson.steps.grammar.sentences) {
              lesson.steps.grammar.sentences = [];
            }
            lesson.steps.grammar.sentences.push(...newSentences);
          }
          break;

        case 'speaking_practice':
        case 'speaking_with_feedback': // Support old name for backward compatibility
          // Handle both 'prompt' (string) and 'prompts' (array) formats
          // Transform to format expected by SpeakingWithFeedback: { id: string, text: string }[]
          if (activityContent.prompts && Array.isArray(activityContent.prompts)) {
            // If prompts is already an array, transform to { id, text } format
            lesson.steps.speaking.prompts = activityContent.prompts.map((p: any, index: number) => {
              if (typeof p === 'string') {
                return { id: `prompt-${index}`, text: p };
              } else if (p.id && p.text) {
                return { id: p.id, text: p.text };
              } else if (p.prompt) {
                return { id: p.id || `prompt-${index}`, text: p.prompt };
              } else {
                return { id: `prompt-${index}`, text: String(p) };
              }
            });
          } else if (activityContent.prompt) {
            // Convert single prompt string to array with id and text
            const promptText = typeof activityContent.prompt === 'string' 
              ? activityContent.prompt 
              : activityContent.prompt.text || activityContent.prompt.prompt || String(activityContent.prompt);
            lesson.steps.speaking.prompts = [
              { id: 'prompt-0', text: promptText }
            ];
          } else {
            // Fallback: no prompts found in database
            console.warn(`No prompts found for speaking activity in lesson ${lessonData.id}`);
            lesson.steps.speaking.prompts = [{ id: 'prompt-0', text: 'Introduce yourself.' }];
          }
          lesson.steps.speaking.feedbackCriteria = activityContent.feedback_criteria || {
            grammar: true,
            vocabulary: true,
            pronunciation: true
          };
          break;

        case 'speaking_improvement':
          // Speaking improvement activity - shows improved version of student's transcript
          lesson.steps.improvement = {
            ...lesson.steps.improvement,
            type: 'speaking_improvement',
            prompt: activityContent.prompt || '',
            improvedText: activityContent.improvedText || activityContent.improved_text || '',
            targetText: activityContent.improvedText || activityContent.improved_text || '',
            similarityThreshold: activityContent.similarity_threshold || 70
          };
          break;

        case 'listening_practice':
        case 'language_improvement_reading': // Support old name for backward compatibility
          lesson.steps.improvement.targetText = activityContent.target_text || activityContent.transcript || 'My name is Anna. I am from Thailand.';
          lesson.steps.improvement.similarityThreshold = activityContent.similarity_threshold || 70;
          if (activityContent.audio_url) {
            lesson.steps.improvement.audioUrl = activityContent.audio_url;
          }
          break;
      }
    });

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        lesson,
        userProgress,
        activityResults, // Always include activity results if they exist (for both completed and incomplete lessons)
        activities: activitiesResult // Include raw activities array with activity_order from database
      })
    } as any;

  } catch (error) {
    console.error('Get lesson error:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } as any;
  }
};

export { handler };
