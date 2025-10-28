const pool = require('./src/config/database.ts').default;

async function checkTables() {
  try {
    // Check books table
    const booksQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'books'
      ORDER BY ordinal_position
    `;

    // Check audio_books table
    const audioBooksQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'audio_books'
      ORDER BY ordinal_position
    `;

    // Check videos table
    const videosQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'videos'
      ORDER BY ordinal_position
    `;

    const [booksResult, audioBooksResult, videosResult] = await Promise.all([
      pool.query(booksQuery),
      pool.query(audioBooksQuery),
      pool.query(videosQuery)
    ]);

    console.log('BOOKS TABLE COLUMNS:');
    console.table(booksResult.rows);

    console.log('\nAUDIO_BOOKS TABLE COLUMNS:');
    console.table(audioBooksResult.rows);

    console.log('\nVIDEOS TABLE COLUMNS:');
    console.table(videosResult.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTables();