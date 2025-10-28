const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ogon_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

const createTables = async () => {
  try {
    console.log('🔒 Creating security tables...');
    
    await pool.query(`
      -- Security logs table for audit trails
      CREATE TABLE IF NOT EXISTS security_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(50) NOT NULL,
          user_id VARCHAR(255),
          ip_address VARCHAR(45) NOT NULL,
          details JSONB,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- IP access control table
      CREATE TABLE IF NOT EXISTS ip_access_control (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ip_address VARCHAR(45) NOT NULL UNIQUE,
          access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('allow', 'deny')),
          reason TEXT,
          created_by VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE
      );

      -- User sessions table
      CREATE TABLE IF NOT EXISTS user_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          token_hash VARCHAR(255) NOT NULL,
          ip_address VARCHAR(45) NOT NULL,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          is_active BOOLEAN DEFAULT TRUE
      );

      -- Content access logs
      CREATE TABLE IF NOT EXISTS content_access_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255),
          content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('book', 'audio', 'video')),
          content_id VARCHAR(255) NOT NULL,
          access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('view', 'download', 'stream')),
          ip_address VARCHAR(45) NOT NULL,
          user_agent TEXT,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Failed login attempts table
      CREATE TABLE IF NOT EXISTS failed_login_attempts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255),
          ip_address VARCHAR(45) NOT NULL,
          user_agent TEXT,
          attempt_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          failure_reason TEXT
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_content_access_logs_user_id ON content_access_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_content_access_logs_timestamp ON content_access_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_ip ON failed_login_attempts(ip_address);
      CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email ON failed_login_attempts(email);
    `);
    
    console.log('✅ Security tables created successfully');
    
    // Insert default allowed IPs
    await pool.query(`
      INSERT INTO ip_access_control (ip_address, access_type, reason) 
      VALUES ('127.0.0.1', 'allow', 'localhost access') 
      ON CONFLICT (ip_address) DO NOTHING;
      
      INSERT INTO ip_access_control (ip_address, access_type, reason) 
      VALUES ('::1', 'allow', 'localhost IPv6 access') 
      ON CONFLICT (ip_address) DO NOTHING;
    `);
    
    console.log('✅ Default security configuration applied');
    console.log('🛡️ Security features are now ready!');
    
  } catch (error) {
    console.error('❌ Error creating security tables:', error);
  } finally {
    await pool.end();
  }
};

createTables();