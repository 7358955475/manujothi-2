import { Request, Response } from 'express';
import pool from '../config/database';
import { hashPassword, comparePassword, generateToken } from '../utils/auth';
import { UserRole } from '../types';
import { SecurityService } from '../services/security';
import crypto from 'crypto';

const logFailedLogin = async (email: string, ip: string, userAgent: string, reason: string) => {
  try {
    await pool.query(
      'INSERT INTO failed_login_attempts (email, ip_address, user_agent, failure_reason) VALUES ($1, $2, $3, $4)',
      [email, ip, userAgent, reason]
    );
  } catch (error) {
    console.error('Failed to log failed login attempt:', error);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  try {
    const { email, password } = req.body;

    // Check for too many recent failed attempts from this IP
    const recentFailures = await pool.query(
      'SELECT COUNT(*) as count FROM failed_login_attempts WHERE ip_address = $1 AND attempt_time > NOW() - INTERVAL \'1 hour\'',
      [ip]
    );
    
    if (parseInt(recentFailures.rows[0].count) >= 1000) { // Temporarily disabled
      await logFailedLogin(email, ip, userAgent, 'IP temporarily blocked due to too many failed attempts');
      res.status(429).json({ error: 'Too many failed attempts. Please try again later.' });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      await logFailedLogin(email, ip, userAgent, 'User not found');
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      await logFailedLogin(email, ip, userAgent, 'Invalid password');
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });
    
    // Create session record
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await pool.query(
      'INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [user.id, tokenHash, ip, userAgent, expiresAt]
    );
    
    // Log successful login
    await SecurityService.logSecurityEvent('LOGIN_SUCCESS', user.id, ip, {
      email: user.email,
      userAgent,
      sessionCreated: true
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    await SecurityService.logSecurityEvent('LOGIN_ERROR', 'unknown', ip, {
      error: error instanceof Error ? error.message : 'Unknown error',
      userAgent
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, first_name, last_name } = req.body;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, role',
      [email, hashedPassword, first_name, last_name]
    );

    const user = result.rows[0];

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};