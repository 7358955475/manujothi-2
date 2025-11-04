-- Create dashboard-related tables
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('book', 'audio', 'video')),
  media_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  time_spent INTEGER DEFAULT 0, -- in seconds
  last_position TEXT, -- JSON data for last position
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, media_type, media_id)
);

CREATE TABLE IF NOT EXISTS user_activity (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('book', 'audio', 'video')),
  media_id UUID NOT NULL,
  activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('viewed', 'completed', 'in_progress', 'paused')),
  session_duration INTEGER DEFAULT 0, -- in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB -- Additional metadata like page number, timestamp, etc.
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_media ON user_progress(media_type, media_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_status ON user_progress(status);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_media ON user_activity(media_type, media_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at);

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create sample progress data for testing
INSERT INTO user_progress (user_id, media_type, media_id, status, progress_percentage, time_spent)
SELECT
    u.id,
    CASE s.n
        WHEN 1 THEN 'book'
        WHEN 2 THEN 'audio'
        WHEN 3 THEN 'video'
    END as media_type,
    CASE s.n
        WHEN 1 THEN (SELECT id FROM books LIMIT 1)
        WHEN 2 THEN (SELECT id FROM audio_books LIMIT 1)
        WHEN 3 THEN (SELECT id FROM videos LIMIT 1)
    END as media_id,
    CASE s.n
        WHEN 1 THEN 'completed'
        WHEN 2 THEN 'in_progress'
        WHEN 3 THEN 'not_started'
    END as status,
    CASE s.n
        WHEN 1 THEN 100
        WHEN 2 THEN 45
        WHEN 3 THEN 0
    END as progress_percentage,
    CASE s.n
        WHEN 1 THEN 3600
        WHEN 2 THEN 1620
        WHEN 3 THEN 0
    END as time_spent
FROM users u
CROSS JOIN (SELECT generate_series(1,3) as n) s
WHERE u.email = 'admin@ogon.com'
ON CONFLICT (user_id, media_type, media_id) DO NOTHING;

-- Create sample activity data
INSERT INTO user_activity (user_id, media_type, media_id, activity_type, session_duration, created_at)
SELECT
    u.id,
    CASE s.n
        WHEN 1 THEN 'book'
        WHEN 2 THEN 'audio'
        WHEN 3 THEN 'video'
        WHEN 4 THEN 'book'
        WHEN 5 THEN 'audio'
    END as media_type,
    CASE s.n
        WHEN 1 THEN (SELECT id FROM books ORDER BY created_at DESC LIMIT 1)
        WHEN 2 THEN (SELECT id FROM audio_books ORDER BY created_at DESC LIMIT 1)
        WHEN 3 THEN (SELECT id FROM videos ORDER BY created_at DESC LIMIT 1)
        WHEN 4 THEN (SELECT id FROM books ORDER BY created_at ASC LIMIT 1)
        WHEN 5 THEN (SELECT id FROM audio_books ORDER BY created_at ASC LIMIT 1)
    END as media_id,
    CASE s.n
        WHEN 1 THEN 'completed'
        WHEN 2 THEN 'in_progress'
        WHEN 3 THEN 'viewed'
        WHEN 4 THEN 'viewed'
        WHEN 5 THEN 'paused'
    END as activity_type,
    CASE s.n
        WHEN 1 THEN 3600
        WHEN 2 THEN 1620
        WHEN 3 THEN 300
        WHEN 4 THEN 600
        WHEN 5 THEN 900
    END as session_duration,
    CURRENT_TIMESTAMP - (s.n || ' hours')::INTERVAL
FROM users u
CROSS JOIN (SELECT generate_series(1,5) as n) s
WHERE u.email = 'admin@ogon.com';