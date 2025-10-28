import pool from '../src/config/database';

// Setup test database connection
beforeAll(async () => {
  // You might want to use a separate test database here
  await pool.query('SELECT 1');
});

// Clean up after all tests
afterAll(async () => {
  await pool.end();
});

// Clean up after each test
afterEach(async () => {
  // Clean up test data if needed
  // await pool.query('DELETE FROM users WHERE email LIKE %test%');
});