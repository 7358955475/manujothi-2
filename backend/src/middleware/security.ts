import { Request, Response, NextFunction } from 'express';
import { SecurityService } from '../services/security';
import rateLimit from 'express-rate-limit';

// IP Access Control Middleware
export const ipAccessControl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    const isAllowed = await SecurityService.isIPAllowed(ip);
    
    if (!isAllowed) {
      await SecurityService.logSecurityEvent('IP_BLOCKED', 'anonymous', ip, {
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      res.status(403).json({ error: 'Access denied from this IP address' });
      return;
    }
    
    next();
  } catch (error) {
    console.error('IP access control failed:', error);
    next(); // Allow on error to prevent denial of service
  }
};

// Suspicious activity detection middleware
export const suspiciousActivityDetection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    
    const isSuspicious = await SecurityService.detectSuspiciousActivity(userId, ip);
    
    if (isSuspicious) {
      // Log but don't block - just monitor
      await SecurityService.logSecurityEvent('SUSPICIOUS_DETECTED', userId, ip, {
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      });
    }
    
    next();
  } catch (error) {
    console.error('Suspicious activity detection failed:', error);
    next();
  }
};

// Content access logging middleware
export const logContentAccess = (contentType: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const contentId = req.params.id;
      
      if (user && contentId) {
        await SecurityService.logContentAccess(
          user.id, 
          contentType, 
          contentId, 
          'view', 
          ip, 
          userAgent
        );
      }
      
      next();
    } catch (error) {
      console.error('Content access logging failed:', error);
      next();
    }
  };
};

// Enhanced rate limiting with progressive delays
export const adaptiveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // Different limits based on user role
    const user = (req as any).user;
    if (user?.role === 'admin') return 500; // Higher limit for admins
    return 200; // Standard limit for users
  },
  message: 'Rate limit exceeded. Please slow down your requests.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    
    await SecurityService.logSecurityEvent('RATE_LIMIT_EXCEEDED', userId, ip, {
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    res.status(429).json({ 
      error: 'Rate limit exceeded', 
      message: 'Please slow down your requests' 
    });
  }
});

// Secure headers middleware
export const secureHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Additional security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), fullscreen=(), web-share=(), picture-in-picture=()');

  // Anti-download and offline prevention headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Enhanced Content Security Policy to prevent downloads and offline usage
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "connect-src 'self'",
    "font-src 'self'",
    "worker-src 'none'",
    "manifest-src 'none'",
    "prefetch-src 'none'",
    "child-src 'none'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);

  next();
};

// Input sanitization for file uploads
export const sanitizeFileInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.file) {
    // Validate file type more strictly
    const allowedMimeTypes = [
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg',
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp'
    ];
    
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'Invalid file type' });
      return;
    }
    
    // Check file size (10MB limit)
    if (req.file.size > 10 * 1024 * 1024) {
      res.status(400).json({ error: 'File too large' });
      return;
    }
  }
  
  next();
};