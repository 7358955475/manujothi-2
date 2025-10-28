const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'ogon_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function runMigration() {
  try {
    console.log('Running migration: add_local_video_support.sql');

    // Read the migration file
    const fs = require('fs');
    const path = require('path');
    const migrationFile = path.join(__dirname, 'add_local_video_support.sql');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();