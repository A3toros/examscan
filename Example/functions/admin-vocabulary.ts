import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

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

const handler: Handler = async (event, context) => {
  try {
    // Check admin authentication
    const isAdmin = await authenticateAdmin(event);
    if (!isAdmin) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Admin authentication required' })
      } as any;
    }

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

    if (event.httpMethod === 'GET') {
      // Check if requesting a specific vocabulary item
      const url = new URL(event.rawUrl || `http://localhost${event.path}`);
      const vocabId = url.searchParams.get('id');

      if (vocabId) {
        // Get single vocabulary item
        const vocabResult = await sql`
          SELECT
            vi.*,
            la.activity_type,
            l.topic as lesson_topic,
            l.level
          FROM vocabulary_items vi
          LEFT JOIN lesson_activities la ON vi.activity_id = la.id
          LEFT JOIN lessons l ON la.lesson_id = l.id
          WHERE vi.id = ${vocabId}
        `;

        if (vocabResult.length === 0) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: 'Vocabulary item not found' })
          } as any;
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            vocabularyItem: vocabResult[0]
          })
        } as any;
      }

      // Get vocabulary items with pagination and search
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const search = url.searchParams.get('search') || '';
      const activityId = url.searchParams.get('activityId');

      const offset = (page - 1) * limit;

      const query = `
        SELECT
          vi.*,
          la.activity_type,
          l.topic as lesson_topic,
          l.level
        FROM vocabulary_items vi
        LEFT JOIN lesson_activities la ON vi.activity_id = la.id
        LEFT JOIN lessons l ON la.lesson_id = l.id
      `;

      const countQuery = 'SELECT COUNT(*) as total FROM vocabulary_items vi';
      const params: any[] = [];
      const countParams: any[] = [];

      // Build the WHERE condition for search and activity filter
      const whereParts = [];
      if (search) {
        whereParts.push(sql`(vi.english_word ILIKE ${`%${search}%`} OR vi.thai_translation ILIKE ${`%${search}%`})`);
      }
      if (activityId) {
        whereParts.push(sql`vi.activity_id = ${activityId}`);
      }

      const whereClause = whereParts.length > 0 ?
        sql`WHERE ${whereParts[0]}${whereParts.slice(1).map(part => sql` AND ${part}`).join('')}` :
        sql``;

      // Execute queries with template literals
      const [vocabularyResult, countResult] = await Promise.all([
        sql`
          SELECT
            vi.*,
            la.activity_type,
            l.topic as lesson_topic,
            l.level
          FROM vocabulary_items vi
          LEFT JOIN lesson_activities la ON vi.activity_id = la.id
          LEFT JOIN lessons l ON la.lesson_id = l.id
          ${whereClause}
          ORDER BY vi.english_word
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total FROM vocabulary_items vi
          ${whereClause}
        `
      ]);

      const totalItems = parseInt(countResult[0].total);
      const totalPages = Math.ceil(totalItems / limit);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          vocabulary: vocabularyResult,
          pagination: {
            page,
            limit,
            total: totalItems,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        })
      } as any;

    } else if (event.httpMethod === 'POST') {
      // Create new vocabulary item
      let vocabData;
      try {
        vocabData = JSON.parse(event.body || '{}');
      } catch (error) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
        } as any;
      }

      const { activity_id, english_word, thai_translation, audio_url, image_url } = vocabData;

      if (!activity_id || !english_word || !thai_translation) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Activity ID, English word, and Thai translation are required' })
        } as any;
      }

      const insertResult = await sql`
        INSERT INTO vocabulary_items (activity_id, english_word, thai_translation, audio_url, image_url)
        VALUES (${activity_id}, ${english_word}, ${thai_translation}, ${audio_url || null}, ${image_url || null})
        RETURNING *
      `;

      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          vocabulary: insertResult[0]
        })
      } as any;

    } else if (event.httpMethod === 'PUT') {
      // Update vocabulary item
      let updateData;
      try {
        updateData = JSON.parse(event.body || '{}');
      } catch (error) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Invalid JSON payload' })
        } as any;
      }

      const { id, activity_id, english_word, thai_translation, audio_url, image_url } = updateData;

      if (!id) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Vocabulary ID is required' })
        } as any;
      }

      const updateResult = await sql`
        UPDATE vocabulary_items
        SET activity_id = ${activity_id}, english_word = ${english_word},
            thai_translation = ${thai_translation}, audio_url = ${audio_url || null},
            image_url = ${image_url || null}
        WHERE id = ${id}
        RETURNING *
      `;

      if (updateResult.length === 0) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Vocabulary item not found' })
        } as any;
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          vocabulary: updateResult[0]
        })
      } as any;

    } else if (event.httpMethod === 'DELETE') {
      // Delete vocabulary item
      const url = new URL(event.rawUrl || `http://localhost${event.path}`);
      const vocabId = url.searchParams.get('id');

      if (!vocabId) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: false, error: 'Vocabulary ID is required' })
        } as any;
      }

      await sql`
        DELETE FROM vocabulary_items WHERE id = ${vocabId}
      `;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Vocabulary item deleted successfully'
        })
      } as any;

    } else {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Method not allowed' })
      } as any;
    }

  } catch (error) {
    console.error('Admin vocabulary error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Internal server error' })
    } as any;
  }
};

export { handler };
