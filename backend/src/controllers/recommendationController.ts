/**
 * Recommendation Controller
 *
 * Handles API requests for recommendations with caching and error handling.
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ContentBasedService } from '../services/recommendation/ContentBasedService';
import { CollaborativeService } from '../services/recommendation/CollaborativeService';
import { HybridService } from '../services/recommendation/HybridService';
import pool from '../config/database';

export class RecommendationController {
  /**
   * GET /api/recommendations/content-based
   * Get content-based recommendations for a specific media item
   */
  static async getContentBasedRecommendations(req: AuthRequest, res: Response) {
    try {
      const { media_id, media_type, limit = 10, min_score = 0.1 } = req.query;

      // Validation
      if (!media_id) {
        return res.status(400).json({
          error: 'Missing required parameter: media_id'
        });
      }

      if (!media_type || !['book', 'audio', 'video'].includes(media_type as string)) {
        return res.status(400).json({
          error: 'Invalid media_type. Must be: book, audio, or video'
        });
      }

      const limitNum = parseInt(limit as string);
      const minScoreNum = parseFloat(min_score as string);

      // Check cache first
      const cacheKey = `content_based:${media_type}:${media_id}:limit:${limitNum}`;
      const cached = await this.getCachedRecommendations(cacheKey);

      if (cached) {
        console.log('✅ Returning cached content-based recommendations');
        return res.json({
          recommendations: cached,
          source: 'cache',
          timestamp: new Date().toISOString()
        });
      }

      // Get fresh recommendations
      const recommendations = await ContentBasedService.getRecommendations(
        media_id as string,
        media_type as any,
        {
          limit: limitNum,
          minScore: minScoreNum
        }
      );

      // Cache results (TTL: 1 hour)
      await this.cacheRecommendations(cacheKey, recommendations, 'content_based', 3600);

      // Track metrics
      await this.trackRecommendationShown(
        req.user?.id,
        recommendations,
        'content_based'
      );

      res.json({
        recommendations,
        source: 'fresh',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error in getContentBasedRecommendations:', error);
      res.status(500).json({
        error: 'Failed to get content-based recommendations',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/recommendations/personalized
   * Get personalized recommendations for a user
   */
  static async getPersonalizedRecommendations(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const { limit = 10, min_score = 0.1, exclude_viewed = 'true' } = req.query;

      const limitNum = parseInt(limit as string);
      const minScoreNum = parseFloat(min_score as string);
      const excludeViewed = exclude_viewed === 'true';

      // Check cache
      const cacheKey = `personalized:user:${userId}:limit:${limitNum}`;
      const cached = await this.getCachedRecommendations(cacheKey);

      if (cached) {
        console.log('✅ Returning cached personalized recommendations');
        return res.json({
          recommendations: cached,
          source: 'cache',
          timestamp: new Date().toISOString()
        });
      }

      // Get fresh recommendations
      const recommendations = await CollaborativeService.getPersonalizedRecommendations(
        userId,
        {
          limit: limitNum,
          minScore: minScoreNum,
          excludeViewed
        }
      );

      // Cache results (TTL: 30 minutes for personalized)
      await this.cacheRecommendations(cacheKey, recommendations, 'personalized', 1800);

      // Track metrics
      await this.trackRecommendationShown(
        userId,
        recommendations,
        'personalized'
      );

      res.json({
        recommendations,
        source: 'fresh',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error in getPersonalizedRecommendations:', error);
      res.status(500).json({
        error: 'Failed to get personalized recommendations',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/recommendations/hybrid
   * Get hybrid recommendations (combines content-based and collaborative filtering)
   */
  static async getHybridRecommendations(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const {
        media_id,
        limit = 10,
        min_score = 0.1,
        content_weight,
        collaborative_weight,
        diversity_factor = 0.15,
        exploration_rate = 0.1
      } = req.query;

      const limitNum = parseInt(limit as string);
      const minScoreNum = parseFloat(min_score as string);
      const diversityFactorNum = parseFloat(diversity_factor as string);
      const explorationRateNum = parseFloat(exploration_rate as string);

      // Check cache
      const cacheKey = `hybrid:user:${userId}:media:${media_id || 'none'}:limit:${limitNum}`;
      const cached = await this.getCachedRecommendations(cacheKey);

      if (cached) {
        console.log('✅ Returning cached hybrid recommendations');
        return res.json({
          recommendations: cached,
          source: 'cache',
          timestamp: new Date().toISOString()
        });
      }

      // Determine weights (adaptive if not provided)
      let contentWeightNum: number;
      let collaborativeWeightNum: number;

      if (content_weight && collaborative_weight) {
        contentWeightNum = parseFloat(content_weight as string);
        collaborativeWeightNum = parseFloat(collaborative_weight as string);
      } else {
        const adaptiveWeights = await HybridService.getAdaptiveWeights(userId);
        contentWeightNum = adaptiveWeights.contentWeight;
        collaborativeWeightNum = adaptiveWeights.collaborativeWeight;
      }

      // Get fresh recommendations
      const recommendations = await HybridService.getHybridRecommendations(
        userId,
        media_id as string | undefined,
        {
          limit: limitNum,
          contentWeight: contentWeightNum,
          collaborativeWeight: collaborativeWeightNum,
          diversityFactor: diversityFactorNum,
          explorationRate: explorationRateNum,
          minScore: minScoreNum
        }
      );

      // Cache results (TTL: 20 minutes for hybrid)
      await this.cacheRecommendations(cacheKey, recommendations, 'hybrid', 1200);

      // Track metrics
      await this.trackRecommendationShown(
        userId,
        recommendations,
        'hybrid'
      );

      res.json({
        recommendations,
        weights: {
          content: contentWeightNum,
          collaborative: collaborativeWeightNum
        },
        source: 'fresh',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error in getHybridRecommendations:', error);
      res.status(500).json({
        error: 'Failed to get hybrid recommendations',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * POST /api/recommendations/track-interaction
   * Track user interaction for improving recommendations
   */
  static async trackInteraction(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const {
        media_id,
        media_type,
        interaction_type,
        duration_seconds,
        progress_percentage,
        metadata
      } = req.body;

      // Validation
      if (!media_id || !media_type || !interaction_type) {
        return res.status(400).json({
          error: 'Missing required fields: media_id, media_type, interaction_type'
        });
      }

      if (!['book', 'audio', 'video'].includes(media_type)) {
        return res.status(400).json({
          error: 'Invalid media_type. Must be: book, audio, or video'
        });
      }

      if (!['view', 'like', 'share', 'complete', 'progress'].includes(interaction_type)) {
        return res.status(400).json({
          error: 'Invalid interaction_type. Must be: view, like, share, complete, or progress'
        });
      }

      // Track interaction
      await CollaborativeService.trackInteraction(
        userId,
        media_id,
        media_type,
        interaction_type,
        {
          durationSeconds: duration_seconds ? parseInt(duration_seconds) : undefined,
          progressPercentage: progress_percentage ? parseInt(progress_percentage) : undefined,
          metadata
        }
      );

      // Invalidate user's cached recommendations
      await this.invalidateUserCache(userId);

      res.json({
        success: true,
        message: 'Interaction tracked successfully'
      });
    } catch (error: any) {
      console.error('❌ Error in trackInteraction:', error);
      res.status(500).json({
        error: 'Failed to track interaction',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * POST /api/recommendations/track-click
   * Track when user clicks on a recommendation
   */
  static async trackRecommendationClick(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const { recommendation_id, media_id, media_type, position } = req.body;

      // Update metrics
      await pool.query(`
        UPDATE recommendation_metrics
        SET was_clicked = true,
            clicked_at = CURRENT_TIMESTAMP,
            time_to_click_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - shown_at))
        WHERE recommendation_id = $1
          AND user_id = $2
          AND media_id = $3
      `, [recommendation_id, userId, media_id]);

      // Also track as interaction
      await CollaborativeService.trackInteraction(
        userId,
        media_id,
        media_type,
        'view'
      );

      res.json({
        success: true,
        message: 'Click tracked successfully'
      });
    } catch (error: any) {
      console.error('❌ Error in trackRecommendationClick:', error);
      res.status(500).json({
        error: 'Failed to track click',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/recommendations/metrics
   * Get recommendation performance metrics (admin only)
   */
  static async getMetrics(req: AuthRequest, res: Response) {
    try {
      // Check admin access
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          error: 'Admin access required'
        });
      }

      const { days = 7 } = req.query;
      const daysNum = parseInt(days as string);

      // Get metrics
      const result = await pool.query(`
        WITH metrics_summary AS (
          SELECT
            recommendation_type,
            COUNT(*) as shown_count,
            COUNT(*) FILTER (WHERE was_clicked) as clicked_count,
            AVG(CASE WHEN was_clicked THEN time_to_click_seconds END) as avg_time_to_click,
            COUNT(*) FILTER (WHERE was_completed) as completed_count,
            AVG(position) as avg_position
          FROM recommendation_metrics
          WHERE shown_at > CURRENT_TIMESTAMP - INTERVAL '${daysNum} days'
          GROUP BY recommendation_type
        )
        SELECT
          recommendation_type,
          shown_count,
          clicked_count,
          ROUND((clicked_count::DECIMAL / NULLIF(shown_count, 0)) * 100, 2) as click_through_rate,
          ROUND(avg_time_to_click::NUMERIC, 2) as avg_time_to_click_seconds,
          completed_count,
          ROUND((completed_count::DECIMAL / NULLIF(clicked_count, 0)) * 100, 2) as completion_rate,
          ROUND(avg_position::NUMERIC, 2) as avg_position
        FROM metrics_summary
      `);

      res.json({
        metrics: result.rows,
        period_days: daysNum,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Error in getMetrics:', error);
      res.status(500).json({
        error: 'Failed to get metrics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Helper: Get cached recommendations
   */
  private static async getCachedRecommendations(cacheKey: string): Promise<any[] | null> {
    try {
      const result = await pool.query(`
        SELECT recommendations
        FROM recommendation_cache
        WHERE cache_key = $1
          AND expires_at > CURRENT_TIMESTAMP
      `, [cacheKey]);

      if (result.rows.length > 0) {
        return result.rows[0].recommendations;
      }

      return null;
    } catch (error) {
      console.error('Error getting cached recommendations:', error);
      return null;
    }
  }

  /**
   * Helper: Cache recommendations
   */
  private static async cacheRecommendations(
    cacheKey: string,
    recommendations: any[],
    type: string,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      await pool.query(`
        INSERT INTO recommendation_cache (
          cache_key, recommendation_type, recommendations, ttl_seconds, expires_at
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (cache_key)
        DO UPDATE SET
          recommendations = EXCLUDED.recommendations,
          expires_at = EXCLUDED.expires_at,
          created_at = CURRENT_TIMESTAMP
      `, [cacheKey, type, JSON.stringify(recommendations), ttlSeconds, expiresAt]);
    } catch (error) {
      console.error('Error caching recommendations:', error);
    }
  }

  /**
   * Helper: Invalidate user's cached recommendations
   */
  private static async invalidateUserCache(userId: string): Promise<void> {
    try {
      await pool.query(`
        DELETE FROM recommendation_cache
        WHERE cache_key LIKE $1
      `, [`%user:${userId}%`]);
    } catch (error) {
      console.error('Error invalidating user cache:', error);
    }
  }

  /**
   * Helper: Track that recommendations were shown
   */
  private static async trackRecommendationShown(
    userId: string | undefined,
    recommendations: any[],
    type: string
  ): Promise<void> {
    if (!userId) return;

    try {
      const recommendationId = `${type}_${Date.now()}_${userId}`;

      for (let i = 0; i < recommendations.length; i++) {
        const rec = recommendations[i];
        await pool.query(`
          INSERT INTO recommendation_metrics (
            recommendation_id, user_id, media_id, media_type,
            recommendation_type, position, score, shown_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        `, [
          recommendationId,
          userId,
          rec.media_id,
          rec.media_type,
          type,
          i + 1,
          rec.score
        ]);
      }
    } catch (error) {
      console.error('Error tracking recommendation shown:', error);
    }
  }
}
