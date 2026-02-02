import { neon } from '@neondatabase/serverless';
import { getHeaders } from './utils/cors-headers.js';
import { validateJWT, extractTokenFromRequest } from './auth-validate-jwt.js';
import { NetlifyEvent } from './types.js';

interface Question {
  id: string;
  number: number;
  type: 'mc' | 'tf';
  text?: string;
}

interface ExamData {
  name: string;
  description: string;
  testStructure: { type: string; count: number; options?: number }[];
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

export async function handler(event: NetlifyEvent) {
  // Get secure headers
  const headers = getHeaders(event, true);

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Extract and validate JWT token
    const token = extractTokenFromRequest(event);

    if (!token) {
      return {
        statusCode: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Unauthorized' })
      };
    }

    const validation = await validateJWT(token);

    if (!validation.isValid || !validation.user) {
      return {
        statusCode: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: validation.error || 'Invalid token' })
      };
    }

    const teacherId = validation.user.id;

    if (!process.env.NEON_DATABASE_URL) {
      throw new Error('Missing required environment variables');
    }

    const sql = neon(process.env.NEON_DATABASE_URL);

    if (event.httpMethod === 'GET') {
      // Check if requesting a specific exam by ID
      const examId = event.queryStringParameters?.id;
      
      if (examId) {
        // Fetch single exam by ID
        const examResult = await sql`
          SELECT
            id,
            title as exam_name,
            description,
            total_questions,
            test_structure,
            answer_key,
            student_info,
            created_at,
            status,
            (SELECT COUNT(*) FROM answers WHERE answers.exam_id = exams.id) as total_scans
          FROM exams
          WHERE id = ${parseInt(examId)} AND user_id = ${teacherId}
          LIMIT 1
        `;

        if (examResult.length === 0) {
          return {
            statusCode: 404,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Exam not found' })
          };
        }

        const exam = examResult[0];
        
        // Log the exam data to debug
        console.log('Fetched exam from database:', {
          id: exam.id,
          exam_name: exam.exam_name,
          test_structure_type: typeof exam.test_structure,
          test_structure: exam.test_structure,
          answer_key_type: typeof exam.answer_key,
          student_info_type: typeof exam.student_info,
          student_info: exam.student_info
        });
        
        // Ensure JSONB fields are properly serialized
        // Neon returns JSONB as JavaScript objects, so JSON.stringify should handle them correctly
        const examResponse = {
          success: true,
          exam: {
            id: exam.id,
            exam_name: exam.exam_name,
            description: exam.description,
            total_questions: exam.total_questions,
            test_structure: exam.test_structure || [],
            answer_key: exam.answer_key || {},
            student_info: exam.student_info || null,
            created_at: exam.created_at,
            status: exam.status,
            total_scans: exam.total_scans || 0
          }
        };
        
        console.log('Sending exam response:', JSON.stringify(examResponse, null, 2));
        
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(examResponse)
        };
      }

      // Fetch all exams
      const exams = await sql`
        SELECT
          id,
          title as exam_name,
          description,
          total_questions,
          test_structure as questions,
          answer_key,
          student_info,
          created_at,
          status,
          (SELECT COUNT(*) FROM answers WHERE answers.exam_id = exams.id) as total_scans
        FROM exams
        WHERE user_id = ${teacherId}
        ORDER BY created_at DESC
      `;

      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ exams: exams || [] })
      };

    } else if (event.httpMethod === 'POST') {
      // Create new exam
      let examData: ExamData;
      try {
        examData = JSON.parse(event.body || '{}');
      } catch (parseError) {
        console.error('Failed to parse request body:', parseError);
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Invalid JSON in request body' })
        };
      }

      // Validate required fields
      if (!examData.name || !examData.name.trim()) {
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Exam name is required' })
        };
      }

      if (!examData.testStructure || examData.testStructure.length === 0) {
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Test structure must have at least one section' })
        };
      }

      // Validate MC option counts (allow 2-4 only)
      for (const section of examData.testStructure) {
        if (section.type === 'mc' && section.options !== undefined) {
          const options = Number(section.options);
          if (!Number.isFinite(options) || options < 2 || options > 4) {
            return {
              statusCode: 400,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ success: false, error: 'MC options must be between 2 and 4' })
            };
          }
        }
      }

      // Calculate total questions from test structure
      const totalQuestions = examData.testStructure.reduce((total, section) => total + section.count, 0);

      if (totalQuestions === 0) {
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Total questions must be greater than 0' })
        };
      }

      // Insert into Neon
      try {
        // Stringify JSONB values explicitly for Neon serverless driver
        const testStructureJson = JSON.stringify(examData.testStructure);
        const answerKeyJson = JSON.stringify(examData.answerKey);
        const studentInfoJson = examData.studentInfo ? JSON.stringify(examData.studentInfo) : null;

        console.log('Inserting exam with data:', {
          name: examData.name,
          testStructureLength: testStructureJson.length,
          answerKeyLength: answerKeyJson.length,
          hasStudentInfo: !!studentInfoJson
        });

        // Use ::jsonb casting like Example project does
        // Handle student_info conditionally - if null, use NULL, otherwise cast to jsonb
        const [exam] = studentInfoJson
          ? await sql`
              INSERT INTO exams (
                user_id,
                title,
                description,
                total_questions,
                status,
                test_structure,
                answer_key,
                student_info
              ) VALUES (
                ${teacherId},
                ${examData.name.trim()},
                ${examData.description || null},
                ${totalQuestions},
                'active',
                ${testStructureJson}::jsonb,
                ${answerKeyJson}::jsonb,
                ${studentInfoJson}::jsonb
              )
              RETURNING *
            `
          : await sql`
              INSERT INTO exams (
                user_id,
                title,
                description,
                total_questions,
                status,
                test_structure,
                answer_key,
                student_info
              ) VALUES (
                ${teacherId},
                ${examData.name.trim()},
                ${examData.description || null},
                ${totalQuestions},
                'active',
                ${testStructureJson}::jsonb,
                ${answerKeyJson}::jsonb,
                NULL
              )
              RETURNING *
            `;

        return {
          statusCode: 201,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            exam: {
              id: exam.id,
              exam_name: exam.title,
              description: exam.description,
              questions: exam.test_structure || [],
              created_at: exam.created_at,
              status: exam.status || 'draft',
              total_scans: 0
            }
          })
        };
      } catch (dbError: any) {
        console.error('Database error inserting exam:', dbError);
        console.error('Exam data:', {
          name: examData.name,
          testStructure: examData.testStructure,
          totalQuestions,
          teacherId
        });
        
        // Return more specific error message
        const errorMessage = dbError?.message || 'Database error';
        return {
          statusCode: 500,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Failed to save exam',
            details: errorMessage
          })
        };
      }

    } else if (event.httpMethod === 'PUT') {
      // Update existing exam
      let updateData: ExamData & { id: number };
      try {
        updateData = JSON.parse(event.body || '{}');
      } catch (parseError) {
        console.error('Failed to parse request body for update:', parseError);
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Invalid JSON in request body' })
        };
      }

      if (!updateData.id || typeof updateData.id !== 'number') {
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Exam ID is required for update' })
        };
      }

      // Basic validation (same as create)
      if (!updateData.name || !updateData.name.trim()) {
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Exam name is required' })
        };
      }

      if (!updateData.testStructure || updateData.testStructure.length === 0) {
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Test structure must have at least one section' })
        };
      }

      // Validate MC option counts (allow 2-4 only)
      for (const section of updateData.testStructure) {
        if (section.type === 'mc' && section.options !== undefined) {
          const options = Number(section.options);
          if (!Number.isFinite(options) || options < 2 || options > 4) {
            return {
              statusCode: 400,
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ success: false, error: 'MC options must be between 2 and 4' })
            };
          }
        }
      }

      const totalQuestions = updateData.testStructure.reduce((total, section) => total + section.count, 0);

      if (totalQuestions === 0) {
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Total questions must be greater than 0' })
        };
      }

      try {
        // Ensure exam belongs to the current user
        const existingExam = await sql`
          SELECT id FROM exams WHERE id = ${updateData.id} AND user_id = ${teacherId}
        `;

        if (existingExam.length === 0) {
          return {
            statusCode: 404,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Exam not found or you do not have permission to edit it' })
          };
        }

        // Prepare JSONB fields
        const testStructureJson = JSON.stringify(updateData.testStructure);
        const answerKeyJson = JSON.stringify(updateData.answerKey || {});
        const studentInfoJson = updateData.studentInfo ? JSON.stringify(updateData.studentInfo) : null;

        console.log('Updating exam with data:', {
          id: updateData.id,
          name: updateData.name,
          totalQuestions,
          hasStudentInfo: !!studentInfoJson
        });

        // Perform update
        const [updatedExam] = studentInfoJson
          ? await sql`
              UPDATE exams
              SET
                title = ${updateData.name.trim()},
                description = ${updateData.description || null},
                total_questions = ${totalQuestions},
                test_structure = ${testStructureJson}::jsonb,
                answer_key = ${answerKeyJson}::jsonb,
                student_info = ${studentInfoJson}::jsonb,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ${updateData.id} AND user_id = ${teacherId}
              RETURNING *
            `
          : await sql`
              UPDATE exams
              SET
                title = ${updateData.name.trim()},
                description = ${updateData.description || null},
                total_questions = ${totalQuestions},
                test_structure = ${testStructureJson}::jsonb,
                answer_key = ${answerKeyJson}::jsonb,
                student_info = NULL,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ${updateData.id} AND user_id = ${teacherId}
              RETURNING *
            `;

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            exam: {
              id: updatedExam.id,
              exam_name: updatedExam.title,
              description: updatedExam.description,
              questions: updatedExam.test_structure || [],
              created_at: updatedExam.created_at,
              status: updatedExam.status || 'draft',
              total_scans: 0
            }
          })
        };
      } catch (dbError: any) {
        console.error('Database error updating exam:', dbError);
        const errorMessage = dbError?.message || 'Database error';
        return {
          statusCode: 500,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Failed to update exam',
            details: errorMessage
          })
        };
      }

    } else if (event.httpMethod === 'DELETE') {
      // Delete exam
      let deleteData: { id: number };
      try {
        deleteData = JSON.parse(event.body || '{}');
      } catch (parseError) {
        console.error('Failed to parse request body:', parseError);
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Invalid JSON in request body' })
        };
      }

      if (!deleteData.id) {
        return {
          statusCode: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Exam ID is required' })
        };
      }

      try {
        // Verify exam belongs to user before deleting
        const examCheck = await sql`
          SELECT id FROM exams WHERE id = ${deleteData.id} AND user_id = ${teacherId}
        `;

        if (examCheck.length === 0) {
          return {
            statusCode: 404,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Exam not found or you do not have permission to delete it' })
          };
        }

        // Delete exam (CASCADE will handle related answers)
        await sql`
          DELETE FROM exams WHERE id = ${deleteData.id} AND user_id = ${teacherId}
        `;

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, message: 'Exam deleted successfully' })
        };
      } catch (dbError: any) {
        console.error('Database error deleting exam:', dbError);
        const errorMessage = dbError?.message || 'Database error';
        return {
          statusCode: 500,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Failed to delete exam',
            details: errorMessage
          })
        };
      }

    } else {
      return {
        statusCode: 405,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Method not allowed' })
      };
    }

  } catch (error) {
    console.error('Error in exams function:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}
