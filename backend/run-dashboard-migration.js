const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { default: pool } = require('./src/config/database');

async function runMigration() {
  try {
    console.log('Starting dashboard migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '006_create_dashboard_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration SQL...');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('✅ Dashboard migration completed successfully!');

    // Close the connection pool
    await pool.end();

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();