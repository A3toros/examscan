import { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'

// Admin authentication middleware
async function authenticateAdmin(event: any): Promise<boolean> {
  try {
    const cookies = event.headers?.cookie || '';
    const cookieArray = cookies.split(';');
    const tokenCookie = cookieArray.find((c: string) => c.trim().startsWith('admin_token='));

    if (!tokenCookie) return false;

    const token = tokenCookie.split('=')[1];

    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return false;

    const decoded = jwt.verify(token, jwtSecret) as any;
    return decoded.role === 'admin';
  } catch (error) {
    return false;
  }
}

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }

  try {
    // Check admin authentication
    const isAdmin = await authenticateAdmin(event);
    if (!isAdmin) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Admin authentication required'
        }),
      }
    }

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    if (!databaseUrl) {
      console.error('NEON_DATABASE_URL not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Database configuration error'
        }),
      }
    }

    const sql = neon(databaseUrl);

    // Only allow GET and POST methods
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Method not allowed'
        }),
      }
    }

    if (event.httpMethod === 'GET') {
      // Check if specific test ID is requested
      const testId = event.queryStringParameters?.id

      if (testId) {
        // Get specific evaluation test
        const testResult = await sql`
          SELECT * FROM evaluation_test WHERE id = ${testId}
        `;

        if (testResult.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Evaluation test not found'
            }),
          }
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            test: testResult[0]
          }),
        }
      } else {
        // Get all evaluation tests
        const testsResult = await sql`
          SELECT * FROM evaluation_test ORDER BY created_at DESC
        `;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            tests: testsResult
          }),
        }
      }
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { test } = body

      if (!test) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Test data is required'
          }),
        }
      }

      const { id, test_name, test_type, description, passing_score, allowed_time, is_active, questions } = test

      if (!test_name || !questions) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Missing required fields: test_name and questions'
          }),
        }
      }

      let result

      if (id) {
        // Update existing test
        const updateResult = await sql`
          UPDATE evaluation_test SET
            test_name = ${test_name},
            test_type = ${test_type || 'comprehensive'},
            description = ${description},
            passing_score = ${passing_score || 60},
            allowed_time = ${allowed_time || 45},
            is_active = ${is_active !== undefined ? is_active : true},
            questions = ${JSON.stringify(questions)},
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;

        if (updateResult.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Evaluation test not found'
            }),
          }
        }

        result = updateResult
      } else {
        // Create new test - use the default ID from schema
        const insertResult = await sql`
          INSERT INTO evaluation_test (
            id,
            test_name,
            test_type,
            description,
            passing_score,
            allowed_time,
            is_active,
            questions
          ) VALUES (
            'EVAL-1',
            ${test_name},
            ${test_type || 'comprehensive'},
            ${description},
            ${passing_score || 60},
            ${allowed_time || 45},
            ${is_active !== undefined ? is_active : true},
            ${JSON.stringify(questions)}
          )
          ON CONFLICT (id) DO UPDATE SET
            test_name = EXCLUDED.test_name,
            test_type = EXCLUDED.test_type,
            description = EXCLUDED.description,
            passing_score = EXCLUDED.passing_score,
            allowed_time = EXCLUDED.allowed_time,
            is_active = EXCLUDED.is_active,
            questions = EXCLUDED.questions,
            updated_at = NOW()
          RETURNING *
        `;

        result = insertResult
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          test: result?.[0] || result
        }),
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      }),
    }

  } catch (error) {
    console.error('Function error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
    }
  }
}
