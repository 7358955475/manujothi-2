import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { MediaLanguage } from '../types';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }
  next();
};

// Enhanced security middleware
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  console.log(`[SECURITY] ${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')}`);
  next();
};

export const sanitizeInputs = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeObject = (obj: any) => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
               .replace(/javascript:/gi, '')
               .replace(/on\w+\s*=/gi, '');
    }
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        obj[key] = sanitizeObject(obj[key]);
      });
    }
    return obj;
  };
  
  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  next();
};

// Rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Rate limit exceeded, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth validation
export const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .blacklist('<>&"\''),
  body('password')
    .isLength({ min: 6, max: 128 }),
  handleValidationErrors
];

export const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .blacklist('<>&"\''),
  body('password')
    .isLength({ min: 6, max: 128 }),
  body('first_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name must contain only letters and spaces'),
  body('last_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name must contain only letters and spaces'),
  handleValidationErrors
];

// User validation
export const validateUserUpdate = [
  body('first_name').optional().trim().isLength({ min: 1, max: 100 }),
  body('last_name').optional().trim().isLength({ min: 1, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'user']),
  body('is_active').optional().isBoolean(),
  handleValidationErrors
];

// Book validation
export const validateBook = [
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('author').trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim(),
  body('cover_image_url').optional().isURL(),
  body('pdf_url').optional().isURL(),
  body('language').isIn(Object.values(MediaLanguage)),
  body('genre').optional().trim().isLength({ max: 100 }),
  body('published_year').optional().isInt({ min: 1000, max: new Date().getFullYear() }),
  handleValidationErrors
];

// Video validation
export const validateVideo = [
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('description').optional().trim(),
  body('youtube_url').optional({ checkFalsy: true }).isURL(),
  body('language').isIn(Object.values(MediaLanguage)),
  body('category').optional().trim().isLength({ max: 100 }),
  body('duration').optional().isInt({ min: 0 }),
  handleValidationErrors
];

// Audio book validation
export const validateAudioBook = [
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('author').trim().isLength({ min: 1, max: 255 }),
  body('narrator').optional().trim().isLength({ max: 255 }),
  body('description').optional().trim(),
  body('cover_image_url').optional().isURL(),
  body('language').isIn(Object.values(MediaLanguage)),
  body('genre').optional().trim().isLength({ max: 100 }),
  handleValidationErrors
];

// Common validation
export const validateUUID = [
  param('id').isUUID(),
  handleValidationErrors
];

export const validatePagination = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidationErrors
];

export const validateLanguageFilter = [
  query('language').optional().isIn(Object.values(MediaLanguage)),
  handleValidationErrors
];