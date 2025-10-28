import pool from '../config/database';
import crypto from 'crypto';

export class SecurityService {
  
  // IP Access Control
  static async isIPAllowed(ip: string): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT access_type FROM ip_access_control 
         WHERE ip_address = $1 
         AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC LIMIT 1`,
        [ip]
      );
      
      if (result.rows.length === 0) return true; // Allow by default
      return result.rows[0].access_type === 'allow';
    } catch (error) {
      console.error('IP access control check failed:', error);
      return true; // Allow on error to prevent lockout
    }
  }
  
  // Block IP address
  static async blockIP(ip: string, reason: string, adminId: string, expiresAt?: Date): Promise<void> {
    await pool.query(
      'INSERT INTO ip_access_control (ip_address, access_type, reason, created_by, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [ip, 'deny', reason, adminId, expiresAt]
    );
  }
  
  // Detect suspicious behavior
  static async detectSuspiciousActivity(userId: string, ip: string): Promise<boolean> {
    try {
      // Check for rapid requests from same IP
      const recentRequests = await pool.query(
        `SELECT COUNT(*) as count FROM security_logs 
         WHERE ip_address = $1 AND timestamp > NOW() - INTERVAL '5 minutes'`,
        [ip]
      );
      
      if (parseInt(recentRequests.rows[0].count) > 100) {
        await this.logSecurityEvent('SUSPICIOUS_ACTIVITY', userId, ip, {
          type: 'rapid_requests',
          count: recentRequests.rows[0].count
        });
        return true;
      }
      
      // Check for failed login attempts
      const failedAttempts = await pool.query(
        `SELECT COUNT(*) as count FROM failed_login_attempts 
         WHERE ip_address = $1 AND attempt_time > NOW() - INTERVAL '1 hour'`,
        [ip]
      );
      
      if (parseInt(failedAttempts.rows[0].count) > 10) {
        await this.logSecurityEvent('SUSPICIOUS_ACTIVITY', userId, ip, {
          type: 'multiple_failed_logins',
          count: failedAttempts.rows[0].count
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Suspicious activity detection failed:', error);
      return false;
    }
  }
  
  // Log security events
  static async logSecurityEvent(eventType: string, userId: string, ip: string, details: any): Promise<void> {
    try {
      await pool.query(
        'INSERT INTO security_logs (event_type, user_id, ip_address, details, timestamp) VALUES ($1, $2, $3, $4, NOW())',
        [eventType, userId, ip, JSON.stringify(details)]
      );
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
  
  // Log content access
  static async logContentAccess(userId: string, contentType: string, contentId: string, accessType: string, ip: string, userAgent: string): Promise<void> {
    try {
      await pool.query(
        'INSERT INTO content_access_logs (user_id, content_type, content_id, access_type, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, contentType, contentId, accessType, ip, userAgent]
      );
    } catch (error) {
      console.error('Failed to log content access:', error);
    }
  }
  
  // Generate secure file tokens
  static generateSecureToken(userId: string, contentId: string): string {
    const timestamp = Date.now();
    const data = `${userId}:${contentId}:${timestamp}`;
    const secret = process.env.FILE_ACCESS_SECRET || 'fallback-secret';
    const hash = crypto.createHmac('sha256', secret).update(data).digest('hex');
    return Buffer.from(`${data}:${hash}`).toString('base64');
  }
  
  // Verify secure file token
  static verifySecureToken(token: string, userId: string, contentId: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const [decodedUserId, decodedContentId, timestamp, hash] = decoded.split(':');
      
      // Check if token is expired (1 hour)
      if (Date.now() - parseInt(timestamp) > 3600000) return false;
      
      // Verify user and content match
      if (decodedUserId !== userId || decodedContentId !== contentId) return false;
      
      // Verify hash
      const data = `${decodedUserId}:${decodedContentId}:${timestamp}`;
      const secret = process.env.FILE_ACCESS_SECRET || 'fallback-secret';
      const expectedHash = crypto.createHmac('sha256', secret).update(data).digest('hex');
      
      return hash === expectedHash;
    } catch (error) {
      return false;
    }
  }
  
  // Encrypt sensitive data
  static encrypt(text: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }
  
  // Decrypt sensitive data
  static decrypt(encryptedText: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
      const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed');
    }
  }
  
  // Clean up expired sessions
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      await pool.query(
        'DELETE FROM user_sessions WHERE expires_at < NOW() OR last_activity < NOW() - INTERVAL \'7 days\''
      );
    } catch (error) {
      console.error('Session cleanup failed:', error);
    }
  }
}