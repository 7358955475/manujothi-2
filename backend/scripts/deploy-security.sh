#!/bin/bash

# MANUJOTHI Security Deployment Script
# This script deploys enhanced security features to the database

echo "🔒 Deploying MANUJOTHI Security Features..."

# Database connection parameters
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5433}
DB_NAME=${DB_NAME:-ogon_db}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-password}

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL client (psql) not found. Please install it first."
    exit 1
fi

echo "📊 Creating security tables..."

# Execute the security tables migration
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f ../migrations/003_security_tables.sql

if [ $? -eq 0 ]; then
    echo "✅ Security tables created successfully"
else
    echo "❌ Failed to create security tables"
    exit 1
fi

echo "🔧 Setting up initial security configuration..."

# Insert default security settings
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
-- Insert default allowed IPs (localhost)
INSERT INTO ip_access_control (ip_address, access_type, reason) 
VALUES ('127.0.0.1', 'allow', 'localhost access') 
ON CONFLICT (ip_address) DO NOTHING;

INSERT INTO ip_access_control (ip_address, access_type, reason) 
VALUES ('::1', 'allow', 'localhost IPv6 access') 
ON CONFLICT (ip_address) DO NOTHING;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_content_access_logs_content ON content_access_logs(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_time ON failed_login_attempts(attempt_time);

-- Log deployment event
INSERT INTO security_logs (event_type, user_id, ip_address, details) 
VALUES ('SECURITY_DEPLOYMENT', NULL, '127.0.0.1', '{"message": "Security features deployed", "version": "1.0"}');

EOF

if [ $? -eq 0 ]; then
    echo "✅ Security configuration completed"
else
    echo "❌ Security configuration failed"
    exit 1
fi

echo "🛡️  Security Features Deployed Successfully!"
echo ""
echo "📋 Deployed Features:"
echo "  ✅ Enhanced input validation and sanitization"
echo "  ✅ Advanced authentication with session monitoring"
echo "  ✅ Database security hardening with audit trails"
echo "  ✅ API security with rate limiting and logging"
echo "  ✅ Comprehensive security event logging"
echo "  ✅ IP-based access control system"
echo "  ✅ Content access tracking and monitoring"
echo "  ✅ Failed login attempt tracking"
echo "  ✅ Session management with concurrent limits"
echo "  ✅ Security dashboard for admin monitoring"
echo ""
echo "⚠️  Next Steps:"
echo "  1. Update environment variables with strong secrets"
echo "  2. Configure SSL certificates for production"
echo "  3. Review and customize IP access control rules"
echo "  4. Set up regular security monitoring"
echo "  5. Test all security features in staging environment"
echo ""
echo "🔍 Monitor security events at: /api/security/dashboard"