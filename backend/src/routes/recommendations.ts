/**
 * Recommendation API Routes
 *
 * Endpoints:
 * - GET /api/recommendations/content-based - Content-based recommendations
 * - GET /api/recommendations/personalized - Personalized user recommendations
 * - GET /api/recommendations/hybrid - Hybrid recommendations
 * - POST /api/recommendations/track-interaction - Track user interactions
 * - POST /api/recommendations/track-click - Track recommendation clicks
 * - GET /api/recommendations/metrics - Get performance metrics (admin only)
 */

import express from 'express';
import { RecommendationController } from '../controllers/recommendationController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * @route GET /api/recommendations/content-based
 * @desc Get content-based recommendations for a specific media item
 * @query media_id - ID of the media item
 * @query media_type - Type of media (book, audio, video)
 * @query limit - Number of recommendations to return (default: 10)
 * @query min_score - Minimum similarity score threshold (default: 0.1)
 * @access Public
 */
router.get(
  '/content-based',
  RecommendationController.getContentBasedRecommendations
);

/**
 * @route GET /api/recommendations/personalized
 * @desc Get personalized recommendations for authenticated user
 * @query limit - Number of recommendations to return (default: 10)
 * @query min_score - Minimum score threshold (default: 0.1)
 * @query exclude_viewed - Exclude already viewed items (default: true)
 * @access Private (requires authentication)
 */
router.get(
  '/personalized',
  authenticate,
  RecommendationController.getPersonalizedRecommendations
);

/**
 * @route GET /api/recommendations/hybrid
 * @desc Get hybrid recommendations (combines content-based and collaborative)
 * @query media_id - Optional: ID of related media item for content-based component
 * @query limit - Number of recommendations to return (default: 10)
 * @query min_score - Minimum score threshold (default: 0.1)
 * @query content_weight - Weight for content-based component (0-1, adaptive if not provided)
 * @query collaborative_weight - Weight for collaborative component (0-1, adaptive if not provided)
 * @query diversity_factor - Diversity enforcement factor (default: 0.15)
 * @query exploration_rate - Rate of exploration items (default: 0.1)
 * @access Private (requires authentication)
 */
router.get(
  '/hybrid',
  authenticate,
  RecommendationController.getHybridRecommendations
);

/**
 * @route POST /api/recommendations/track-interaction
 * @desc Track user interaction with media for improving recommendations
 * @body media_id - ID of the media item
 * @body media_type - Type of media (book, audio, video)
 * @body interaction_type - Type of interaction (view, like, share, complete, progress)
 * @body duration_seconds - Optional: Time spent on media
 * @body progress_percentage - Optional: Progress through media (0-100)
 * @body metadata - Optional: Additional context
 * @access Private (requires authentication)
 */
router.post(
  '/track-interaction',
  authenticate,
  RecommendationController.trackInteraction
);

/**
 * @route POST /api/recommendations/track-click
 * @desc Track when user clicks on a recommendation
 * @body recommendation_id - ID of the recommendation batch
 * @body media_id - ID of the clicked media
 * @body media_type - Type of media
 * @body position - Position in recommendation list
 * @access Private (requires authentication)
 */
router.post(
  '/track-click',
  authenticate,
  RecommendationController.trackRecommendationClick
);

/**
 * @route GET /api/recommendations/metrics
 * @desc Get recommendation performance metrics
 * @query days - Number of days to look back (default: 7)
 * @access Private (admin only)
 */
router.get(
  '/metrics',
  authenticate,
  RecommendationController.getMetrics
);

export default router;
