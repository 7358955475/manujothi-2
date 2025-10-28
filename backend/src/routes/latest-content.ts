import express, { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { body, query, validationResult } from 'express-validator';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/latest-content - Get latest content/notifications for user
router.get('/', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  query('user_id')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID')
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const userId = req.query.user_id as string || (req as any).user?.id;

    // For now, return empty notifications since this is a simplified implementation
    // In a real app, this would fetch from a notifications table
    res.json({
      notifications: [],
      count: 0,
      message: 'No new notifications'
    });
  } catch (error) {
    console.error('Error fetching latest content:', error);
    res.status(500).json({
      error: 'Failed to fetch latest content',
      message: 'Internal server error'
    });
  }
});

// POST /api/latest-content/mark-read - Mark notifications as read
router.post('/mark-read', [
  body('content_id')
    .optional()
    .isUUID()
    .withMessage('Content ID must be a valid UUID'),
  body('content_type')
    .optional()
    .isIn(['book', 'audio', 'video'])
    .withMessage('Content type must be book, audio, or video'),
  body('user_id')
    .optional()
    .isUUID()
    .withMessage('User ID must be a valid UUID')
], handleValidationErrors, async (req: Request, res: Response) => {
  try {
    const { content_id, content_type, user_id } = req.body;
    const userId = user_id || (req as any).user?.id;

    // For now, just return success since this is a simplified implementation
    // In a real app, this would update a notifications table
    res.json({
      message: 'Notifications marked as read',
      success: true
    });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({
      error: 'Failed to mark notifications as read',
      message: 'Internal server error'
    });
  }
});

export default router;