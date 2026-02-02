import { Handler } from '@netlify/functions';
import { neon } from '@neondatabase/serverless';
import { getHeaders, getSecurityHeaders } from './cors-headers';

const handler: Handler = async (event, context) => {
  // Get security headers (health endpoint doesn't need CORS with credentials)
  const headers = {
    ...getSecurityHeaders(),
    'Content-Type': 'application/json'
  };

  // Only allow GET and OPTIONS requests
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'OPTIONS') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    } as any;
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    } as any;
  }

  try {
    const healthCheck: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Check database connection if configured
    if (process.env.NEON_DATABASE_URL) {
      try {
        const sql = neon(process.env.NEON_DATABASE_URL);
        await sql`SELECT 1 as health_check`;
        healthCheck.database = 'connected';
      } catch (dbError) {
        console.error('Database health check failed:', dbError);
        healthCheck.database = 'disconnected';
        healthCheck.status = 'degraded';
      }
    } else {
      healthCheck.database = 'not configured';
    }

    // Check AI services
    healthCheck.services = {
      openrouter: !!process.env.OPENROUTER_API_KEY,
      assemblyai: !!process.env.ASSEMBLYAI_API_KEY,
      resend: !!process.env.RESEND_API_KEY,
      jwt: !!process.env.JWT_SECRET
    };

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: true,
        ...healthCheck
      })
    } as any;

  } catch (error) {
    console.error('Health check error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      })
    } as any;
  }
};

export { handler };
