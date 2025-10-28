import { Router } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import pool from '../config/database';
import { SecurityService } from '../services/security';

const router = Router();

// Get security dashboard data
router.get('/dashboard', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Recent security events
    const recentEvents = await pool.query(`
      SELECT event_type, COUNT(*) as count, MAX(timestamp) as last_occurrence
      FROM security_logs 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY event_type
      ORDER BY count DESC
    `);

    // Failed login attempts by IP
    const failedLogins = await pool.query(`
      SELECT ip_address, COUNT(*) as attempts, MAX(attempt_time) as last_attempt
      FROM failed_login_attempts 
      WHERE attempt_time > NOW() - INTERVAL '24 hours'
      GROUP BY ip_address
      ORDER BY attempts DESC
      LIMIT 10
    `);

    // Active sessions
    const activeSessions = await pool.query(`
      SELECT COUNT(*) as total_sessions,
             COUNT(DISTINCT user_id) as unique_users
      FROM user_sessions 
      WHERE expires_at > NOW() AND is_active = true
    `);

    // Content access stats
    const contentAccess = await pool.query(`
      SELECT content_type, access_type, COUNT(*) as count
      FROM content_access_logs 
      WHERE timestamp > NOW() - INTERVAL '24 hours'
      GROUP BY content_type, access_type
      ORDER BY count DESC
    `);

    res.json({
      recentEvents: recentEvents.rows,
      failedLogins: failedLogins.rows,
      activeSessions: activeSessions.rows[0],
      contentAccess: contentAccess.rows
    });
  } catch (error) {
    console.error('Security dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch security data' });
  }
});

// Block IP address
router.post('/block-ip', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { ip, reason, expiresAt } = req.body;
    const adminId = req.user?.id || 'unknown';
    
    await SecurityService.blockIP(ip, reason, adminId, expiresAt ? new Date(expiresAt) : undefined);
    
    await SecurityService.logSecurityEvent('IP_BLOCKED_BY_ADMIN', adminId, req.ip || 'unknown', {
      blockedIP: ip,
      reason,
      expiresAt
    });
    
    res.json({ message: 'IP address blocked successfully' });
  } catch (error) {
    console.error('IP blocking error:', error);
    res.status(500).json({ error: 'Failed to block IP address' });
  }
});

// Get user sessions
router.get('/sessions', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const sessions = await pool.query(`
      SELECT s.*, u.email, u.first_name, u.last_name
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > NOW() AND s.is_active = true
      ORDER BY s.last_activity DESC
      LIMIT 50
    `);
    
    res.json(sessions.rows);
  } catch (error) {
    console.error('Sessions fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Revoke user session
router.post('/revoke-session/:sessionId', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const adminId = req.user?.id || 'unknown';
    
    await pool.query(
      'UPDATE user_sessions SET is_active = false WHERE id = $1',
      [sessionId]
    );
    
    await SecurityService.logSecurityEvent('SESSION_REVOKED_BY_ADMIN', adminId, req.ip || 'unknown', {
      revokedSessionId: sessionId
    });
    
    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error('Session revocation error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

export default router;