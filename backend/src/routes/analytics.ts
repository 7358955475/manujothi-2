import express from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all analytics routes
router.use(authenticate);

// Content Performance
router.get('/content-performance', AnalyticsController.getContentPerformance);

// User Engagement
router.get('/user-engagement', AnalyticsController.getUserEngagement);

// Activity Trends
router.get('/activity-trends', AnalyticsController.getActivityTrends);

// Peak Usage Times
router.get('/peak-usage', AnalyticsController.getPeakUsageTimes);

// Comparative Stats
router.get('/comparative-stats', AnalyticsController.getComparativeStats);

// Real-time Activity
router.get('/real-time', AnalyticsController.getRealTimeActivity);

export default router;
