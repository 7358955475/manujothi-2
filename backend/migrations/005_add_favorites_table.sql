-- Create favorites table
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('book', 'audio', 'video')),
    media_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, media_type, media_id)
);

-- Create indexes for better performance
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_media_type ON favorites(media_type);
CREATE INDEX idx_favorites_media_id ON favorites(media_id);
CREATE INDEX idx_favorites_created_at ON favorites(created_at);

-- Add comment
COMMENT ON TABLE favorites IS 'User favorites for books, audio books, and videos';
COMMENT ON COLUMN favorites.media_type IS 'Type of media: book, audio, or video';
COMMENT ON COLUMN favorites.media_id IS 'ID of the favorited media item';