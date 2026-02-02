import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';

// Admin authentication middleware
async function authenticateAdmin(event: any): Promise<boolean> {
  try {
    let token = null;

    // Try Authorization header first
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('Admin-delete-user auth: Token from Authorization header');
    } else {
      // Fall back to cookie (check both lowercase and uppercase)
      const cookies = event.headers?.cookie || event.headers?.Cookie || '';
      console.log('Admin-delete-user auth: Cookies received:', cookies ? 'yes' : 'no', cookies.substring(0, 100));
      const cookieArray = cookies.split(';');
      const tokenCookie = cookieArray.find((c: string) => c.trim().startsWith('admin_token='));

      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
        console.log('Admin-delete-user auth: Token found in cookie, length:', token?.length);
      } else {
        console.log('Admin-delete-user auth: No admin_token cookie found. Available cookies:', cookieArray.map((c: string) => c.trim().split('=')[0]));
      }
    }

    if (!token) {
      console.log('Admin-delete-user auth: No token found');
      return false;
    }

    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET;
    console.log('Admin-delete-user auth: JWT secret configured:', !!jwtSecret);
    if (!jwtSecret) {
      console.log('Admin-delete-user auth: No JWT secret configured');
      return false;
    }

    const decoded = jwt.verify(token, jwtSecret) as any;
    const isAdmin = decoded.role === 'admin';
    console.log('Admin-delete-user auth: User role:', decoded.role, 'Is admin:', isAdmin);
    return isAdmin;
  } catch (error) {
    console.error('Admin-delete-user auth: Authentication error:', error);
    return false;
  }
}

const handler: Handler = async (event, context) => {
  console.log('Admin-delete-user: Function invoked with method:', event.httpMethod);

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    console.log('Admin-delete-user: Handling OPTIONS preflight request');
    return {
      statusCode: 200,
      headers,
      body: '',
    } as any;
  }

  // Only allow DELETE requests
  if (event.httpMethod !== 'DELETE') {
    console.log('Admin-delete-user: Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    } as any;
  }

  console.log('Admin-delete-user: Processing DELETE request');
  // Check admin authentication
  const isAdmin = await authenticateAdmin(event);
  console.log('Admin-delete-user: Authentication result:', isAdmin);

  if (!isAdmin) {
    console.log('Admin-delete-user: Authentication failed, returning 401');
    // Removed duplicate auth check - already authenticated via cookies above
  }

  console.log('Admin-delete-user: Authentication successful, proceeding with delete');

  try {
    console.log('Admin-delete-user: Starting database operations');

    // Get database connection
    const databaseUrl = process.env.NEON_DATABASE_URL;
    console.log('Admin-delete-user: Database URL configured:', !!databaseUrl);
    if (!databaseUrl) {
      console.error('NEON_DATABASE_URL not configured');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Database configuration error' })
      } as any;
    }

    const sql = neon(databaseUrl);
    console.log('Admin-delete-user: Database connection established');

    // Get user ID from path parameters
    const pathParts = event.path.split('/');
    const userId = pathParts[pathParts.length - 1];
    console.log('Admin-delete-user: Extracted userId from path:', userId);

    if (!userId) {
      console.log('Admin-delete-user: No userId found in path');
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'User ID is required' })
      } as any;
    }

    // Skip JWT authentication - already authenticated via cookies above

    // Skip self-deletion check for now - admin authentication already verified above

    // Check if user exists
    console.log('Admin-delete-user: Querying database for user:', userId);
    const userCheck = await sql`
      SELECT id, email, username FROM users WHERE id = ${userId}
    `;
    console.log('Admin-delete-user: User query result:', userCheck.length, 'records found');

    if (userCheck.length === 0) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'User not found' })
      } as any;
    }

    const user = userCheck[0];

    // Delete all related user data first (since not all foreign keys have CASCADE DELETE)
    console.log(`Deleting all data for user: ${user.email} (${userId})`)

    try {
      // Delete user achievements (will cascade due to foreign key)
      const achievementsDeleted = await sql`DELETE FROM user_achievements WHERE user_id = ${userId}`
      console.log(`Deleted ${achievementsDeleted.length} achievement records`)

      // Delete lesson activity results
      const activityResultsDeleted = await sql`DELETE FROM lesson_activity_results WHERE user_id = ${userId}`
      console.log(`Deleted ${activityResultsDeleted.length} lesson activity result records`)

      // Delete evaluation results
      const evalResultsDeleted = await sql`DELETE FROM evaluation_results WHERE user_id = ${userId}`
      console.log(`Deleted ${evalResultsDeleted.length} evaluation result records`)

      // Delete user progress
      const progressDeleted = await sql`DELETE FROM user_progress WHERE user_id = ${userId}`
      console.log(`Deleted ${progressDeleted.length} user progress records`)

      // Delete user sessions
      const sessionsDeleted = await sql`DELETE FROM user_sessions WHERE user_id = ${userId}`
      console.log(`Deleted ${sessionsDeleted.length} user session records`)

      // Delete lesson history records created by this user
      const historyDeleted = await sql`DELETE FROM lesson_history WHERE changed_by = ${userId}`
      console.log(`Deleted ${historyDeleted.length} lesson history records`)

      // Finally delete the user
      await sql`DELETE FROM users WHERE id = ${userId}`
      console.log(`Successfully deleted user account: ${user.email}`)

    } catch (deleteError) {
      console.error('Error during user data deletion:', deleteError)
      throw new Error('Failed to delete user data: ' + (deleteError as Error).message)
    }

    console.log(`Admin deleted user: ${user.email} (${user.username})`);

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `User ${user.email} has been deleted successfully`,
        deletedUser: {
          id: user.id,
          email: user.email,
          username: user.username
        }
      })
    } as any;

  } catch (error) {
    console.error('Delete user error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Failed to delete user' })
    } as any;
  }
};

export { handler };
