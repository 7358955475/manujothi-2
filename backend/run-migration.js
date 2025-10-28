import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  user: 'postgres',
  password: 'password',
  database: 'ogon_db'
});

async function runMigration() {
  try {
    console.log('Running migration: 005_add_favorites_table.sql');

    const migrationPath = path.join(process.cwd(), 'migrations', '005_add_favorites_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
    console.log('Favorites table has been created.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();