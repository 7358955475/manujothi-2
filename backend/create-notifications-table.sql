-- Create notifications table for tracking new uploads and updates
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(10) NOT NULL CHECK (content_type IN ('book', 'audio', 'video')),
  content_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT fk_books FOREIGN KEY (content_id) REFERENCES books(id) ON DELETE CASCADE,
  CONSTRAINT fk_audio_books FOREIGN KEY (content_id) REFERENCES audio_books(id) ON DELETE CASCADE,
  CONSTRAINT fk_videos FOREIGN KEY (content_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Create an index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Create an index on content_type and content_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_content ON notifications(content_type, content_id);

-- Create an index on is_active for faster filtering
CREATE INDEX IF NOT EXISTS idx_notifications_is_active ON notifications(is_active);

-- Create user_notifications table to track which users have read which notifications
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, notification_id)
);

-- Create indexes for user_notifications
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON user_notifications(user_id, read);
