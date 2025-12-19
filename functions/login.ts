import { neon } from '@neondatabase/serverless';

interface Env {
  NEON_DATABASE_URL: string;
  JWT_SECRET: string;
}

interface LoginData {
  email: string;
  otp: string;
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  try {
    const data: LoginData = await request.json();
    const { email, otp } = data;

    if (!email || !otp) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email and OTP are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sql = neon(env.NEON_DATABASE_URL);

    // Find valid OTP for this email
    const [otpRecord] = await sql`
      SELECT * FROM email_otps
      WHERE email = ${email}
        AND otp_code = ${otp}
        AND is_used = false
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!otpRecord) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired OTP'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Find user by email
    const [user] = await sql`
      SELECT * FROM users
      WHERE email = ${email} AND is_active = true
    `;

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Account not found or inactive'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate JWT token (simple implementation - in production use proper JWT library)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      user_id: user.id,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    }));

    // Simple signature (in production, use crypto.subtle.sign)
    const message = `${header}.${payload}`;
    const hashBuffer = await crypto.subtle.digest('SHA-256',
      new TextEncoder().encode(message + env.JWT_SECRET)
    );
    const hashArray = new Uint8Array(hashBuffer);
    const signature = btoa(String.fromCharCode.apply(null, Array.from(hashArray)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const token = `${header}.${payload}.${signature}`;

    // Mark OTP as used
    await sql`
      UPDATE email_otps
      SET is_used = true, used_at = CURRENT_TIMESTAMP
      WHERE id = ${otpRecord.id}
    `;

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      },
      token,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Login failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
