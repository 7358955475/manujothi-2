-- Add support for local video uploads
ALTER TABLE videos
ADD COLUMN video_source VARCHAR(20) DEFAULT 'youtube' CHECK (video_source IN ('youtube', 'local')),
ADD COLUMN video_file_path VARCHAR(500),
ADD COLUMN file_size BIGINT,
ADD COLUMN mime_type VARCHAR(100);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_source ON videos(video_source);
CREATE INDEX IF NOT EXISTS idx_videos_file_path ON videos(video_file_path) WHERE video_file_path IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN videos.video_source IS 'Source of the video: youtube or local upload';
COMMENT ON COLUMN videos.video_file_path IS 'Path to local video file when source is local';
COMMENT ON COLUMN videos.file_size IS 'File size in bytes for local videos';
COMMENT ON COLUMN videos.mime_type IS 'MIME type of the video file';