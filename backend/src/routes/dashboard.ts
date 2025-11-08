import express from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { authenticate } from '../middleware/auth';
import { body, param } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/dashboard/overview - Get dashboard overview stats
router.get('/overview', DashboardController.getDashboardOverview);

// GET /api/dashboard/recently-viewed - Get recently viewed items
router.get('/recently-viewed', DashboardController.getRecentlyViewed);

// GET /api/dashboard/recommendations - Get personalized recommendations
router.get('/recommendations', DashboardController.getRecommendations);

// GET /api/dashboard/progress - Get user's media progress
router.get('/progress', DashboardController.getUserProgress);

// POST /api/dashboard/track-activity - Track user activity
router.post('/track-activity', [
  body('media_type')
    .trim()
    .isIn(['book', 'audio', 'video'])
    .withMessage('Media type must be book, audio, or video'),
  body('media_id')
    .trim()
    .isUUID()
    .withMessage('Media ID must be a valid UUID'),
  body('activity_type')
    .trim()
    .isIn(['viewed', 'completed', 'in_progress'])
    .withMessage('Activity type must be viewed, completed, or in_progress')
], handleValidationErrors, DashboardController.trackActivity);

export default router;