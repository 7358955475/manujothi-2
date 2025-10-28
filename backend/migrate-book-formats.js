const pool = require('./src/config/database');

const migrationSQL = `
-- Add support for multiple book formats
-- First, add new columns to books table
ALTER TABLE books
ADD COLUMN IF NOT EXISTS file_format VARCHAR(10) DEFAULT 'pdf',
ADD COLUMN IF NOT EXISTS file_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

-- Create enum for book formats
DO $$ BEGIN
    CREATE TYPE book_format AS ENUM ('pdf', 'epub', 'txt', 'docx', 'mobi', 'azw', 'azw3', 'djvu', 'fb2', 'rtf', 'html', 'odt');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update existing books to have pdf format
UPDATE books SET file_format = 'pdf' WHERE file_format IS NULL OR file_format = '';

-- Set file_url from pdf_url for existing books
UPDATE books SET file_url = pdf_url WHERE file_url IS NULL AND pdf_url IS NOT NULL;

-- Set mime_type based on file_format
UPDATE books SET mime_type =
  CASE file_format
    WHEN 'pdf' THEN 'application/pdf'
    WHEN 'epub' THEN 'application/epub+zip'
    WHEN 'txt' THEN 'text/plain'
    WHEN 'docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    WHEN 'mobi' THEN 'application/x-mobipocket-ebook'
    WHEN 'azw' THEN 'application/vnd.amazon.ebook'
    WHEN 'azw3' THEN 'application/vnd.amazon.ebook'
    WHEN 'djvu' THEN 'image/vnd.djvu'
    WHEN 'fb2' THEN 'application/xml'
    WHEN 'rtf' THEN 'application/rtf'
    WHEN 'html' THEN 'text/html'
    WHEN 'odt' THEN 'application/vnd.oasis.opendocument.text'
    ELSE 'application/octet-stream'
  END
WHERE mime_type IS NULL;

-- Add index for file format
CREATE INDEX IF NOT EXISTS idx_books_file_format ON books(file_format);

-- Note: Check constraint will be added manually if needed due to compatibility issues
`;

async function runMigration() {
  try {
    console.log('🔄 Running book format migration...');

    await pool.query(migrationSQL);

    console.log('✅ Book format migration completed successfully!');

    // Test the migration
    const result = await pool.query('SELECT file_format, file_url, mime_type FROM books LIMIT 5');
    console.log('📚 Sample books with new format columns:');
    result.rows.forEach(book => {
      console.log(`- ${book.file_format || 'N/A'}: ${book.file_url || 'N/A'} (${book.mime_type || 'N/A'})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();