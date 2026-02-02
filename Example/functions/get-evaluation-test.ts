import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, message: 'Method not allowed' }),
    };
  }

  try {
    // Get test ID from query parameter (support both 'id' and 'test_id' for compatibility)
    const testId = event.queryStringParameters?.id || event.queryStringParameters?.test_id || 'EVAL-1';

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('NEON_DATABASE_URL not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, message: 'Database configuration error' }),
      };
    }

    const sql = neon(databaseUrl);

    // Get the single evaluation test with all questions
    const testResult = await sql`
      SELECT * FROM evaluation_test 
      WHERE id = ${testId} AND is_active = true
    `;

    if (testResult.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, message: 'Test not found' }),
      };
    }

    const testData = testResult[0];

    // Return in format expected by frontend (result.test for admin editor, result.data for student view)
    const result = {
      success: true,
      test: {
        id: testData.id,
        test_name: testData.test_name,
        test_type: testData.test_type,
        description: testData.description,
        passing_score: testData.passing_score,
        allowed_time: testData.allowed_time,
        is_active: testData.is_active,
        questions: testData.questions, // Questions are already stored as JSONB array
        created_at: testData.created_at,
        updated_at: testData.updated_at,
      },
      // Also include 'data' for backward compatibility with student evaluation page
      data: {
        id: testData.id,
        test_name: testData.test_name,
        test_type: testData.test_type,
        description: testData.description,
        passing_score: testData.passing_score,
        allowed_time: testData.allowed_time,
        questions: testData.questions,
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Error in get-evaluation-test:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: 'Internal server error' }),
    };
  }
};
