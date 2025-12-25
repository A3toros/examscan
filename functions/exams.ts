import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

interface Question {
  id: string;
  number: number;
  type: 'mc' | 'tf';
  text?: string;
}

interface ExamData {
  name: string;
  description: string;
  testStructure: { type: string; count: number }[];
  answerKey: Record<number, string>;
  studentInfo?: {
    name: boolean;
    last_name: boolean;
    nickname: boolean;
    class: boolean;
    student_id?: boolean;
    student_id_digits?: number;
  };
}

import { NetlifyEvent } from './types.js';

export async function handler(event: NetlifyEvent) {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Get teacher ID from JWT token
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    if (!process.env.NEON_DATABASE_URL || !process.env.JWT_SECRET) {
      throw new Error('Missing required environment variables');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const teacherId = decoded.user_id;

    const sql = neon(process.env.NEON_DATABASE_URL);

    if (event.httpMethod === 'GET') {
      // Fetch exams
      const exams = await sql`
        SELECT
          id,
          title as exam_name,
          description,
          total_questions,
          test_structure as questions,
          created_at,
          status,
          (SELECT COUNT(*) FROM answers WHERE answers.exam_id = exams.id) as total_scans
        FROM exams
        WHERE user_id = ${teacherId}
        ORDER BY created_at DESC
      `;

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ exams: exams || [] })
      };

    } else if (event.httpMethod === 'POST') {
      // Create new exam
      const examData: ExamData = JSON.parse(event.body || '{}');

      // Calculate total questions from test structure
      const totalQuestions = examData.testStructure.reduce((total, section) => total + section.count, 0);

      // Insert into Neon
      const [exam] = await sql`
        INSERT INTO exams (
          user_id,
          title,
          description,
          total_questions,
          test_structure,
          answer_key,
          student_info
        ) VALUES (
          ${teacherId},
          ${examData.name},
          ${examData.description},
          ${totalQuestions},
          ${JSON.stringify(examData.testStructure)},
          ${JSON.stringify(examData.answerKey)},
          ${examData.studentInfo ? JSON.stringify(examData.studentInfo) : null}
        )
        RETURNING *
      `;

      return {
        statusCode: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          exam: {
            id: exam.id,
            exam_name: exam.title,
            description: exam.description,
            questions: JSON.parse(exam.test_structure || '[]'),
            created_at: exam.created_at,
            status: exam.status || 'draft',
            total_scans: 0
          }
        })
      };

    } else {
      return {
        statusCode: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

  } catch (error) {
    console.error('Error in exams function:', error);

    if (error instanceof jwt.JsonWebTokenError) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}
