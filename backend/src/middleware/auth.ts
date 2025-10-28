import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/auth';
import { User, UserRole } from '../types';
import pool from '../config/database';

interface UserSession {
  userId: string;
  token: string;
  ip: string;
  userAgent: string;
  lastActivity: Date;
}

const activeSessions = new Map<string, UserSession[]>();

export interface AuthRequest extends Request {
  user?: User;
}

const logSecurityEvent = async (event: string, userId: string, ip: string, details: any) => {
  try {
    await pool.query(
      'INSERT INTO security_logs (event_type, user_id, ip_address, details, timestamp) VALUES ($1, $2, $3, $4, NOW())',
      [event, userId, ip, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};

const trackUserSession = (userId: string, token: string, ip: string, userAgent: string) => {
  const sessions = activeSessions.get(userId) || [];
  const existingIndex = sessions.findIndex(s => s.token === token);
  
  const sessionInfo: UserSession = {
    userId,
    token,
    ip,
    userAgent,
    lastActivity: new Date()
  };
  
  if (existingIndex >= 0) {
    sessions[existingIndex] = sessionInfo;
  } else {
    sessions.push(sessionInfo);
    // Limit to 3 concurrent sessions per user
    if (sessions.length > 3) {
      sessions.shift(); // Remove oldest session
    }
  }
  
  activeSessions.set(userId, sessions);
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    
    if (!token) {
      await logSecurityEvent('AUTH_FAILED', 'anonymous', ip, { reason: 'No token provided', userAgent });
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const payload = verifyToken(token);
    
    // Get user from database
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [payload.userId]
    );

    if (result.rows.length === 0) {
      await logSecurityEvent('AUTH_FAILED', payload.userId, ip, { reason: 'User not found or inactive', userAgent });
      res.status(401).json({ error: 'Invalid token or user not found' });
      return;
    }

    const user = result.rows[0];
    req.user = user;
    
    // Track session
    trackUserSession(user.id, token, ip, userAgent);
    
    // Log successful authentication
    await logSecurityEvent('AUTH_SUCCESS', user.id, ip, { userAgent, email: user.email });
    
    next();
  } catch (error) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    await logSecurityEvent('AUTH_FAILED', 'unknown', ip, { reason: 'Invalid token', error: error instanceof Error ? error.message : 'Unknown error', userAgent });
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
};