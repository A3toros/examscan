import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, message: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      test_id,
      user_id,
      overall_score,
      max_score,
      overall_percentage,
      time_spent,
      question_results,
    } = body;

    if (!test_id || !user_id || overall_score === undefined || max_score === undefined) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'Missing required fields' }),
      };
    }

    // Get test passing score
    const { data: testData, error: testError } = await supabase
      .from('evaluation_tests')
      .select('passing_score')
      .eq('id', test_id)
      .single();

    if (testError) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, message: 'Test not found' }),
      };
    }

    const passed = overall_percentage >= (testData.passing_score || 60);

    // Insert evaluation result
    const { data: resultData, error: insertError } = await supabase
      .from('evaluation_results')
      .insert({
        user_id,
        test_id,
        overall_score,
        max_score,
        overall_percentage,
        passed,
        time_spent,
        completed_at: new Date().toISOString(),
        question_results,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, message: 'Failed to save results' }),
      };
    }

    // Update user's evaluation results if this is a placement test
    if (body.update_user_level) {
      const calculatedLevel = calculateLevelFromScore(overall_percentage);

      const { error: updateError } = await supabase
        .from('users')
        .update({
          eval_test_result: {
            score: overall_score,
            max_score: max_score,
            percentage: overall_percentage,
            level: calculatedLevel,
            completed_at: new Date().toISOString(),
          },
          level: calculatedLevel,
        })
        .eq('id', user_id);

      if (updateError) {
        console.error('User update error:', updateError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: resultData,
        passed,
        message: passed ? 'Test passed!' : 'Test completed',
      }),
    };
  } catch (error) {
    console.error('Error in submit-evaluation-test:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, message: 'Internal server error' }),
    };
  }
};

// Helper function to calculate level from score
function calculateLevelFromScore(percentage: number): string {
  if (percentage >= 90) return 'B2';
  if (percentage >= 80) return 'B1';
  if (percentage >= 70) return 'A2';
  if (percentage >= 60) return 'A1';
  return 'A1'; // Default to beginner
}
