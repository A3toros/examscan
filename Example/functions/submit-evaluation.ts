import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { validateJWT } from './auth-validate-jwt.js';

interface EvaluationSubmission {
  results: any;
  calculatedLevel: string;
  completedAt: string;
}

interface TestResult {
  test_type: string;
  score: number;
  max_score: number;
  percentage: number;
  details: any;
}

// Input sanitization utilities
function sanitizeString(value: string, maxLength: number = 1000): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFKC')
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim()
    .slice(0, maxLength);
}

function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return sanitizeString(email.toLowerCase().trim(), 254);
}

function sanitizeUserId(userId: string): string {
  if (!userId || typeof userId !== 'string') return '';
  return sanitizeString(userId, 100);
}

function sanitizeLevel(level: string): string {
  const allowedLevels = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const sanitized = sanitizeString(level, 10);
  return allowedLevels.includes(sanitized) ? sanitized : '';
}

function sanitizeForDatabase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return sanitizeString(obj, 10000);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForDatabase(item));
  }
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
      sanitized[sanitizedKey] = sanitizeForDatabase(value);
    }
    return sanitized;
  }
  return obj;
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
    // Validate authentication
    const cookies = event.headers?.cookie || '';
    const token = cookies.split(';').find(c => c.trim().startsWith('access_token='))?.split('=')[1];

    if (!token) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Authentication required' })
      } as any;
    }

    const auth = await validateJWT(token);
    if (!auth.isValid || !auth.user) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Database configuration error' })
      } as any;
    }

    const sql = neon(databaseUrl);

    let rawSubmission: any;
    try {
      rawSubmission = JSON.parse(event.body || '{}');
    } catch (error) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
      } as any;
    }

    // Sanitize input data
    const submission: EvaluationSubmission = {
      results: sanitizeForDatabase(rawSubmission.results),
      calculatedLevel: sanitizeLevel(rawSubmission.calculatedLevel),
      completedAt: sanitizeString(rawSubmission.completedAt, 50)
    };

    // Validate required fields after sanitization
    if (!submission.results || !submission.calculatedLevel) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Missing required fields: results, calculatedLevel' })
      } as any;
    }

    // Calculate overall score and percentage
    let totalScore = 0;
    let maxScore = 0;
    let timeSpent = 0;

    // Extract evaluation results
    const evaluationResult = submission.results.evaluation || submission.results;
    if (evaluationResult) {
      totalScore = evaluationResult.score || 0;
      maxScore = evaluationResult.maxScore || 0;
      timeSpent = evaluationResult.timeSpent || 0;
    }

    // Debug: Log what we're about to write to DB
    console.log('📊 Evaluation submission data:', {
      userId,
      totalScore,
      maxScore,
      timeSpent,
      calculatedLevel: submission.calculatedLevel,
      evaluationResult: JSON.stringify(evaluationResult, null, 2).substring(0, 500)
    });

    const overallPercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const passed = overallPercentage >= 60; // Default passing score is 60%

    // Prepare question_results - store the full evaluation results
    const questionResults = {
      evaluation: evaluationResult,
      answers: evaluationResult?.answers || {}
    };

    console.log('💾 Writing to evaluation_results table:', {
      user_id: userId,
      test_id: 'EVAL-1',
      overall_score: totalScore,
      max_score: maxScore,
      overall_percentage: overallPercentage,
      passed,
      time_spent: timeSpent || null,
      calculated_level: submission.calculatedLevel,
      question_results_keys: Object.keys(questionResults),
      completed_at: submission.completedAt
    });

    // Insert evaluation result - match database schema exactly
    const insertedResult = await sql`
      INSERT INTO evaluation_results (
        user_id, 
        test_id, 
        overall_score, 
        max_score, 
        overall_percentage, 
        passed,
        time_spent,
        calculated_level, 
        question_results, 
        completed_at
      )
      VALUES (
        ${userId}, 
        'EVAL-1', 
        ${totalScore}, 
        ${maxScore}, 
        ${overallPercentage}, 
        ${passed},
        ${timeSpent || null},
        ${submission.calculatedLevel}, 
        ${JSON.stringify(questionResults)}, 
        ${submission.completedAt}
      )
      RETURNING id
    `;

    if (insertedResult.length === 0) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Failed to save evaluation results' })
      } as any;
    }

    // Update user level and evaluation test result in users table
    const evalTestResult = {
      evaluationId: insertedResult[0].id,
      calculatedLevel: submission.calculatedLevel,
      overallScore: totalScore,
      maxScore: maxScore,
      overallPercentage,
      completedAt: submission.completedAt,
      questionResults: questionResults
    };

    try {
      await sql`
        UPDATE users
        SET level = ${submission.calculatedLevel},
            eval_test_result = ${JSON.stringify(evalTestResult)}
        WHERE id = ${userId}
      `;
    } catch (userUpdateError) {
      console.error('User level update error:', userUpdateError);
      // Don't fail the whole request if user update fails
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        evaluationId: insertedResult[0].id,
        calculatedLevel: submission.calculatedLevel,
        overallScore: totalScore,
        maxScore: maxScore,
        overallPercentage
      })
    } as any;

  } catch (error) {
    console.error('Submit evaluation error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } as any;
  }
};

export { handler };
