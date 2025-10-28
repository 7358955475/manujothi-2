const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ogon_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

const checkUsers = async () => {
  try {
    console.log('📋 Checking existing users...');
    
    const result = await pool.query('SELECT id, email, first_name, last_name, role, is_active FROM users ORDER BY created_at');
    
    if (result.rows.length === 0) {
      console.log('❌ No users found in database');
    } else {
      console.log(`✅ Found ${result.rows.length} users:`);
      result.rows.forEach(user => {
        console.log(`  - ${user.email} (${user.role}) - Active: ${user.is_active}`);
      });
    }
  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await pool.end();
  }
};

checkUsers();