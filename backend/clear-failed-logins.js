const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ogon_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

const clearFailedLogins = async () => {
  try {
    console.log('🧹 Clearing failed login attempts...');
    
    const result = await pool.query('DELETE FROM failed_login_attempts');
    console.log(`✅ Cleared ${result.rowCount} failed login attempts`);
  } catch (error) {
    console.error('❌ Error clearing failed logins:', error);
  } finally {
    await pool.end();
  }
};

clearFailedLogins();