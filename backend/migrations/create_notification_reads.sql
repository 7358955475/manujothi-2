-- Create user notification reads table
CREATE TABLE IF NOT EXISTS user_notification_reads (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  content_id VARCHAR(255) NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, content_id, content_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_notification_reads_user_content
ON user_notification_reads(user_id, content_id, content_type);

-- Create index for user-specific queries
CREATE INDEX IF NOT EXISTS idx_user_notification_reads_user
ON user_notification_reads(user_id, read_at);