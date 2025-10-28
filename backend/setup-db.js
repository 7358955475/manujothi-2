const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  // First, connect to the default postgres database to create our database
  const defaultClient = new Client({
    host: 'localhost',
    port: 5433,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres'
  });

  try {
    console.log('Connecting to PostgreSQL...');
    await defaultClient.connect();
    
    // Check if database exists
    const dbCheckResult = await defaultClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'ogon_db'"
    );
    
    if (dbCheckResult.rows.length === 0) {
      console.log('Creating ogon_db database...');
      await defaultClient.query('CREATE DATABASE ogon_db');
      console.log('Database created successfully!');
    } else {
      console.log('Database ogon_db already exists.');
    }
    
    await defaultClient.end();
    
    // Now connect to our database and run the init script
    const ogonClient = new Client({
      host: 'localhost',
      port: 5433,
      user: 'postgres',
      password: 'postgres',
      database: 'ogon_db'
    });
    
    await ogonClient.connect();
    console.log('Connected to ogon_db database.');
    
    // Read and execute the init.sql file
    const initSQL = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
    console.log('Running database initialization script...');
    await ogonClient.query(initSQL);
    console.log('Database initialization completed successfully!');
    
    await ogonClient.end();
    console.log('Setup complete! Default admin user: admin@ogon.com / admin123');
    
  } catch (error) {
    if (error.code === '28P01') {
      console.log('Authentication failed. Trying with system user...');
      process.exit(1);
    } else if (error.code === '42P04') {
      console.log('Database already exists, continuing...');
    } else {
      console.error('Error setting up database:', error.message);
      process.exit(1);
    }
  }
}

setupDatabase();