import { Handler } from '@netlify/functions';

interface RequestBody {
  targetText: string
  userText: string
  threshold?: number
}

const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
      } as any;
    }

    // Validate and sanitize input
    const targetText = (body.targetText || '').trim();
    const userText = (body.userText || '').trim();

    if (!targetText || !userText) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing target text or user text',
          details: {
            hasTargetText: !!targetText,
            hasUserText: !!userText
          }
        })
      } as any;
    }

    if (targetText.length === 0 || userText.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: 'Target text or user text cannot be empty' 
        })
      } as any;
    }

    // Get OpenRouter API key
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const threshold = body.threshold || 0.7;

    if (!openRouterApiKey) {
      console.warn('OpenRouter API key not configured, using fallback similarity');
      // Fallback to simple similarity calculation
      const similarity = calculateSimpleSimilarity(targetText, userText);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          similarity: similarity,
          passed: similarity >= threshold,
          feedback: similarity >= threshold
            ? "Good effort! Your reading shows understanding of the text."
            : `Try to match the target text more closely. Similarity: ${(similarity * 100).toFixed(1)}%`,
          suggestions: [
            "Pay attention to word stress and intonation",
            "Practice difficult sounds and word combinations",
            "Read at a natural pace"
          ],
          note: "Using basic similarity analysis - AI feedback not available"
        })
      } as any;
    }

    try {
      const systemPrompt = `You are an expert English language tutor evaluating a student's reading performance. Compare the student's spoken text to the target text and provide detailed feedback.

Analyze:
1. Semantic similarity (meaning accuracy)
2. Lexical similarity (word choice and usage)
3. Structural similarity (sentence structure)
4. Pronunciation considerations (based on transcription accuracy)

Return ONLY a valid JSON object with this exact structure:
{
  "similarity": number (0.0-1.0),
  "passed": boolean,
  "feedback": "string with encouraging, specific feedback",
  "suggestions": ["array of specific improvement suggestions"],
  "analysis": {
    "semantic_match": number (0-100),
    "lexical_accuracy": number (0-100),
    "structural_similarity": number (0-100)
  }
}`;

      console.log('Sending similarity analysis to OpenRouter...');

      const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'TutorCat Language Learning'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Target Text: "${targetText}"\n\nStudent's Reading: "${userText}"\n\nPlease analyze the similarity and provide detailed feedback.`
            }
          ],
          temperature: 0.7,
          max_tokens: 600
        }),
      });

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();
        throw new Error(`OpenRouter API error: ${openRouterResponse.status} - ${errorText}`);
      }

      const result = await openRouterResponse.json();
      console.log('OpenRouter similarity response received');

      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        throw new Error('Invalid response from OpenRouter');
      }

      const aiResponse = result.choices[0].message.content;
      console.log('AI similarity response:', aiResponse);

      // Parse the JSON response
      let analysis;
      try {
        analysis = JSON.parse(aiResponse);
      } catch (parseError) {
        console.error('Failed to parse AI similarity response as JSON:', aiResponse);
        throw new Error('AI returned invalid JSON response');
      }

      // Validate the response structure
      if (typeof analysis.similarity !== 'number' ||
          typeof analysis.passed !== 'boolean' ||
          typeof analysis.feedback !== 'string' ||
          !Array.isArray(analysis.suggestions)) {
        throw new Error('AI response missing required fields');
      }

      // Ensure similarity is within bounds
      analysis.similarity = Math.max(0, Math.min(1, analysis.similarity));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          ...analysis
        })
      } as any;

    } catch (aiError) {
      console.error('OpenRouter similarity analysis error:', aiError);

      // Fallback to simple similarity
      const similarity = calculateSimpleSimilarity(targetText, userText);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          similarity: similarity,
          passed: similarity >= threshold,
          feedback: similarity >= threshold
            ? "Good effort! Your reading shows understanding of the text."
            : `Try to match the target text more closely. Similarity: ${(similarity * 100).toFixed(1)}%`,
          suggestions: [
            "Pay attention to word stress and intonation",
            "Practice difficult sounds and word combinations",
            "Read at a natural pace"
          ],
          note: "AI analysis failed - using basic similarity check"
        })
      } as any;
    }

  } catch (error) {
    console.error('Similarity check handler error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    } as any;
  }
};

export { handler };

function calculateSimpleSimilarity(text1: string, text2: string): number {
  // Simple word overlap similarity (not production-ready)
  const words1 = text1.toLowerCase().split(/\s+/).filter(word => word.length > 0)
  const words2 = text2.toLowerCase().split(/\s+/).filter(word => word.length > 0)

  const set1 = new Set(words1)
  const set2 = new Set(words2)

  const intersection = new Set(Array.from(set1).filter(word => set2.has(word)))
  const union = new Set([...Array.from(set1), ...Array.from(set2)])

  return intersection.size / union.size
}
