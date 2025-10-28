import fs from 'fs';
import path from 'path';
import pool from './src/config/database.js';

async function runBookMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations/004_add_book_formats.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration: 004_add_book_formats.sql');

    // Execute the migration
    await pool.query(migrationSQL);

    console.log('Migration completed successfully!');

    // Test the new columns exist
    const testQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'books'
      AND column_name IN ('file_format', 'file_url', 'mime_type')
      ORDER BY column_name
    `;

    const result = await pool.query(testQuery);
    console.log('New columns added/verified:', result.rows);

    await pool.end();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runBookMigration();