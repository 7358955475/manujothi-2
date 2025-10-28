-- Add support for multiple book formats
-- First, add new columns to books table
ALTER TABLE books
ADD COLUMN IF NOT EXISTS file_format VARCHAR(10) DEFAULT 'pdf',
ADD COLUMN IF NOT EXISTS file_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

-- Create enum for book formats
CREATE TYPE book_format AS ENUM ('pdf', 'epub', 'txt', 'docx', 'mobi', 'azw', 'azw3', 'djvu', 'fb2', 'rtf', 'html', 'odt');

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

-- Add check constraint for file format
ALTER TABLE books
ADD CONSTRAINT IF NOT EXISTS valid_book_format
CHECK (file_format IN ('pdf', 'epub', 'txt', 'docx', 'mobi', 'azw', 'azw3', 'djvu', 'fb2', 'rtf', 'html', 'odt'));