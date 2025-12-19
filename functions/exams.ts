import { neon } from '@neondatabase/serverless';

interface Env {
  NEON_DATABASE_URL: string;
  JWT_SECRET: string;
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  try {
    // Get teacher ID from JWT token (implement token verification)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    const teacherId = await verifyToken(token, env);

    // Fetch from Neon
    const sql = neon(env.NEON_DATABASE_URL);
    const exams = await sql`
      SELECT * FROM exams
      WHERE user_id = ${teacherId}
      ORDER BY created_at DESC
    `;

    return new Response(JSON.stringify({ exams: exams || [] }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching exams:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

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
  studentInfo?: { name: boolean; last_name: boolean; nickname: boolean; class: boolean };
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7);
    const teacherId = await verifyToken(token, env);

    const examData: ExamData = await request.json();

    // Calculate total questions from test structure
    const totalQuestions = examData.testStructure.reduce((total, section) => total + section.count, 0);

    // Insert into Neon
    const sql = neon(env.NEON_DATABASE_URL);
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
        ${JSON.stringify(examData.studentInfo || { name: true, last_name: true, nickname: false, class: true })}
      )
      RETURNING *
    `;

    return new Response(JSON.stringify({ exam }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating exam:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Helper function to verify JWT token
async function verifyToken(token: string, env: Env): Promise<string> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode payload
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    // Verify signature (simple implementation)
    const message = `${headerB64}.${payloadB64}`;
    const hashBuffer = await crypto.subtle.digest('SHA-256',
      new TextEncoder().encode(message + env.JWT_SECRET)
    );
    const hashArray = new Uint8Array(hashBuffer);
    const expectedSignature = btoa(String.fromCharCode.apply(null, Array.from(hashArray)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    if (signatureB64 !== expectedSignature) {
      throw new Error('Invalid token signature');
    }

    return payload.user_id;
  } catch {
    throw new Error('Token verification failed');
  }
}
