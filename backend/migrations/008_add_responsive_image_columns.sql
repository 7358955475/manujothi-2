-- Migration: Add responsive image size columns for Smart Thumbnail System
-- Created: 2025-11-08
-- Purpose: Support multiple image sizes (thumbnail, small, medium, large) for optimized loading

-- Add responsive image columns to books table
ALTER TABLE books
ADD COLUMN IF NOT EXISTS cover_image_thumbnail VARCHAR(500),
ADD COLUMN IF NOT EXISTS cover_image_small VARCHAR(500),
ADD COLUMN IF NOT EXISTS cover_image_medium VARCHAR(500),
ADD COLUMN IF NOT EXISTS cover_image_large VARCHAR(500);

-- Add responsive image columns to audio_books table
ALTER TABLE audio_books
ADD COLUMN IF NOT EXISTS cover_image_thumbnail VARCHAR(500),
ADD COLUMN IF NOT EXISTS cover_image_small VARCHAR(500),
ADD COLUMN IF NOT EXISTS cover_image_medium VARCHAR(500),
ADD COLUMN IF NOT EXISTS cover_image_large VARCHAR(500);

-- Add responsive image columns to videos table
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS thumbnail_small VARCHAR(500),
ADD COLUMN IF NOT EXISTS thumbnail_medium VARCHAR(500),
ADD COLUMN IF NOT EXISTS thumbnail_large VARCHAR(500),
ADD COLUMN IF NOT EXISTS thumbnail_thumbnail VARCHAR(500);

-- Add comments to document the purpose of each column
COMMENT ON COLUMN books.cover_image_url IS 'Original uploaded cover image';
COMMENT ON COLUMN books.cover_image_thumbnail IS 'Thumbnail size: 150x200px (3:4 aspect ratio)';
COMMENT ON COLUMN books.cover_image_small IS 'Small size: 300x400px (3:4 aspect ratio)';
COMMENT ON COLUMN books.cover_image_medium IS 'Medium size: 600x800px (3:4 aspect ratio)';
COMMENT ON COLUMN books.cover_image_large IS 'Large size: 900x1200px (3:4 aspect ratio)';

COMMENT ON COLUMN audio_books.cover_image_url IS 'Original uploaded cover image';
COMMENT ON COLUMN audio_books.cover_image_thumbnail IS 'Thumbnail size: 150x200px (3:4 aspect ratio)';
COMMENT ON COLUMN audio_books.cover_image_small IS 'Small size: 300x400px (3:4 aspect ratio)';
COMMENT ON COLUMN audio_books.cover_image_medium IS 'Medium size: 600x800px (3:4 aspect ratio)';
COMMENT ON COLUMN audio_books.cover_image_large IS 'Large size: 900x1200px (3:4 aspect ratio)';

COMMENT ON COLUMN videos.thumbnail_url IS 'Original uploaded thumbnail or YouTube thumbnail URL';
COMMENT ON COLUMN videos.thumbnail_thumbnail IS 'Thumbnail size: 267x150px (16:9 aspect ratio)';
COMMENT ON COLUMN videos.thumbnail_small IS 'Small size: 533x300px (16:9 aspect ratio)';
COMMENT ON COLUMN videos.thumbnail_medium IS 'Medium size: 1067x600px (16:9 aspect ratio)';
COMMENT ON COLUMN videos.thumbnail_large IS 'Large size: 1600x900px (16:9 aspect ratio)';

-- Create indexes for the new columns (helps with queries filtering by image availability)
CREATE INDEX IF NOT EXISTS idx_books_cover_thumbnail ON books(cover_image_thumbnail) WHERE cover_image_thumbnail IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audio_books_cover_thumbnail ON audio_books(cover_image_thumbnail) WHERE cover_image_thumbnail IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_videos_thumbnail_small ON videos(thumbnail_small) WHERE thumbnail_small IS NOT NULL;

-- Migration success message
DO $$
BEGIN
    RAISE NOTICE 'Migration 008_add_responsive_image_columns completed successfully';
    RAISE NOTICE 'Added responsive image columns to books, audio_books, and videos tables';
END $$;
