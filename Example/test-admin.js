// Test script to check admin user and role
const { neon } = require('@neondatabase/serverless');

async function testAdmin() {
  const databaseUrl = process.env.NEON_DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ NEON_DATABASE_URL not set');
    return;
  }

  const sql = neon(databaseUrl);

  try {
    console.log('🔍 Checking admin user...');

    // Check if admin user exists
    const adminUsers = await sql`
      SELECT id, username, email, role, level
      FROM users
      WHERE username = 'admin'
    `;

    if (adminUsers.length === 0) {
      console.error('❌ Admin user not found');
      return;
    }

    const admin = adminUsers[0];
    console.log('✅ Admin user found:', {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      level: admin.level
    });

    // Check if role is 'admin'
    if (admin.role !== 'admin') {
      console.error('❌ Admin user does not have role = "admin"');
      console.log('🔧 Run migration: UPDATE users SET role = \'admin\' WHERE username = \'admin\';');
      return;
    }

    console.log('✅ Admin user has correct role');

    // Test password hash (optional)
    console.log('🔐 Password hash exists:', !!admin.password_hash);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAdmin();
