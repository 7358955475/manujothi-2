import { Request, Response } from 'express';
import pool from '../config/database';
import { logger } from '../utils/logger';
import { HybridService } from '../services/recommendation/HybridService';

export class DashboardController {
  // Get recently viewed items for a user
  static async getRecentlyViewed(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const limit = parseInt(req.query.limit as string) || 10;

      // Get recent activity with media details - ONLY VALID (EXISTING & ACTIVE) MEDIA
      const query = `
        SELECT DISTINCT ON (ua.media_type, ua.media_id)
          ua.media_type,
          ua.media_id,
          ua.created_at as last_viewed,
          CASE
            WHEN ua.media_type = 'book' THEN b.id
            WHEN ua.media_type = 'audio' THEN ab.id
            WHEN ua.media_type = 'video' THEN v.id
          END as id,
          CASE
            WHEN ua.media_type = 'book' THEN b.title
            WHEN ua.media_type = 'audio' THEN ab.title
            WHEN ua.media_type = 'video' THEN v.title
          END as title,
          CASE
            WHEN ua.media_type = 'book' THEN b.author
            WHEN ua.media_type = 'audio' THEN ab.author
            WHEN ua.media_type = 'video' THEN NULL
          END as author,
          CASE
            WHEN ua.media_type = 'audio' THEN ab.narrator
            ELSE NULL
          END as narrator,
          CASE
            WHEN ua.media_type = 'book' THEN b.cover_image_url
            WHEN ua.media_type = 'audio' THEN ab.cover_image_url
            WHEN ua.media_type = 'video' THEN v.thumbnail_url
          END as cover_image_url,
          CASE
            WHEN ua.media_type = 'book' THEN b.cover_image_url
            WHEN ua.media_type = 'audio' THEN ab.cover_image_url
            WHEN ua.media_type = 'video' THEN v.thumbnail_url
          END as thumbnail_url,
          CASE
            WHEN ua.media_type = 'book' THEN b.language
            WHEN ua.media_type = 'audio' THEN ab.language
            WHEN ua.media_type = 'video' THEN v.language
          END as language,
          CASE
            WHEN ua.media_type = 'book' THEN b.genre
            WHEN ua.media_type = 'audio' THEN ab.genre
            WHEN ua.media_type = 'video' THEN v.category
          END as genre_or_category,
          CASE
            WHEN ua.media_type = 'book' THEN b.pdf_url
            WHEN ua.media_type = 'audio' THEN ab.audio_file_path
            WHEN ua.media_type = 'video' THEN COALESCE(v.video_file_path, v.youtube_url)
          END as file_url,
          CASE
            WHEN ua.media_type = 'book' THEN b.pdf_url
            WHEN ua.media_type = 'audio' THEN ab.audio_file_path
            WHEN ua.media_type = 'video' THEN COALESCE(v.video_file_path, v.youtube_url)
          END as content_url,
          CASE
            WHEN ua.media_type = 'book' THEN b.pdf_url
            ELSE NULL
          END as pdf_file_path,
          CASE
            WHEN ua.media_type = 'audio' THEN ab.audio_file_path
            ELSE NULL
          END as audio_file_path,
          CASE
            WHEN ua.media_type = 'video' THEN v.video_file_path
            ELSE NULL
          END as video_file_path,
          CASE
            WHEN ua.media_type = 'video' THEN v.youtube_url
            ELSE NULL
          END as youtube_url,
          CASE
            WHEN ua.media_type = 'video' THEN v.youtube_id
            ELSE NULL
          END as youtube_id,
          'pdf' as file_format,
          'application/pdf' as mime_type,
          up.progress_percentage,
          up.status,
          up.time_spent
        FROM user_activity ua
        LEFT JOIN user_progress up ON ua.user_id = up.user_id AND ua.media_type = up.media_type AND ua.media_id = up.media_id
        LEFT JOIN books b ON ua.media_id = b.id AND ua.media_type = 'book' AND b.is_active = true
        LEFT JOIN audio_books ab ON ua.media_id = ab.id AND ua.media_type = 'audio' AND ab.is_active = true
        LEFT JOIN videos v ON ua.media_id = v.id AND ua.media_type = 'video' AND v.is_active = true
        WHERE ua.user_id = $1
          AND ua.activity_type = 'viewed'
          AND (
            (ua.media_type = 'book' AND b.id IS NOT NULL) OR
            (ua.media_type = 'audio' AND ab.id IS NOT NULL) OR
            (ua.media_type = 'video' AND v.id IS NOT NULL)
          )
        ORDER BY ua.media_type, ua.media_id, ua.created_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);

      res.json({
        recentlyViewed: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      logger.error('Error getting recently viewed items:', error);
      res.status(500).json({ error: 'Failed to fetch recently viewed items' });
    }
  }

  // Get recommendations for a user using Smart Recommendation Engine
  static async getRecommendations(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const limit = parseInt(req.query.limit as string) || 12;

      // Use Smart Recommendation Engine (TF-IDF + Collaborative Filtering + Hybrid)
      const recommendations = await HybridService.getHybridRecommendations(
        userId,
        {
          limit,
          minScore: 0.1,
          contentWeight: 0.5,
          collaborativeWeight: 0.5,
          diversityFactor: 0.3
        }
      );

      res.json({
        recommendations,
        count: recommendations.length
      });
    } catch (error) {
      logger.error('Error getting recommendations:', error);

      // Fallback to simple recommendations if ML engine fails
      try {
        const perMediaType = Math.ceil(limit / 3);
        const fallbackQuery = `
          (SELECT 'book' as media_type, id as media_id, id, title, author, NULL as narrator,
            cover_image_url, language, genre as category, description, pdf_url as content_url
            FROM books WHERE is_active = true ORDER BY created_at DESC LIMIT $1)
          UNION ALL
          (SELECT 'audio' as media_type, id as media_id, id, title, author, narrator,
            cover_image_url, language, genre as category, description, audio_file_path as content_url
            FROM audio_books WHERE is_active = true ORDER BY created_at DESC LIMIT $2)
          UNION ALL
          (SELECT 'video' as media_type, id as media_id, id, title, NULL as author, NULL as narrator,
            thumbnail_url as cover_image_url, language, category, description, COALESCE(video_file_path, youtube_url) as content_url
            FROM videos WHERE is_active = true ORDER BY created_at DESC LIMIT $3)
          ORDER BY media_type LIMIT $4
        `;
        const result = await pool.query(fallbackQuery, [perMediaType, perMediaType, perMediaType, limit]);

        res.json({
          recommendations: result.rows,
          count: result.rows.length,
          fallback: true
        });
      } catch (fallbackError) {
        logger.error('Fallback recommendations also failed:', fallbackError);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
      }
    }
  }

  // Get user's media progress
  static async getUserProgress(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const query = `
        SELECT
          up.media_type,
          up.media_id,
          up.progress_percentage,
          up.status,
          up.current_position,
          up.total_duration,
          up.time_spent,
          up.last_accessed,
          CASE
            WHEN up.media_type = 'book' THEN b.id
            WHEN up.media_type = 'audio' THEN ab.id
            WHEN up.media_type = 'video' THEN v.id
          END as id,
          CASE
            WHEN up.media_type = 'book' THEN b.title
            WHEN up.media_type = 'audio' THEN ab.title
            WHEN up.media_type = 'video' THEN v.title
          END as title,
          CASE
            WHEN up.media_type = 'book' THEN b.author
            WHEN up.media_type = 'audio' THEN ab.author
            WHEN up.media_type = 'video' THEN NULL
          END as author,
          CASE
            WHEN up.media_type = 'audio' THEN ab.narrator
            ELSE NULL
          END as narrator,
          CASE
            WHEN up.media_type = 'book' THEN b.cover_image_url
            WHEN up.media_type = 'audio' THEN ab.cover_image_url
            WHEN up.media_type = 'video' THEN v.thumbnail_url
          END as cover_image_url,
          CASE
            WHEN up.media_type = 'book' THEN b.cover_image_url
            WHEN up.media_type = 'audio' THEN ab.cover_image_url
            WHEN up.media_type = 'video' THEN v.thumbnail_url
          END as thumbnail_url,
          CASE
            WHEN up.media_type = 'book' THEN b.language
            WHEN up.media_type = 'audio' THEN ab.language
            WHEN up.media_type = 'video' THEN v.language
          END as language,
          CASE
            WHEN up.media_type = 'book' THEN b.genre
            WHEN up.media_type = 'audio' THEN ab.genre
            WHEN up.media_type = 'video' THEN v.category
          END as genre_or_category,
          CASE
            WHEN up.media_type = 'book' THEN b.published_year
            WHEN up.media_type = 'audio' THEN ab.duration
            WHEN up.media_type = 'video' THEN v.duration
          END as duration_or_year,
          CASE
            WHEN up.media_type = 'book' THEN b.pdf_url
            WHEN up.media_type = 'audio' THEN ab.audio_file_path
            WHEN up.media_type = 'video' THEN COALESCE(v.video_file_path, v.youtube_url)
          END as file_url,
          CASE
            WHEN up.media_type = 'book' THEN b.pdf_url
            WHEN up.media_type = 'audio' THEN ab.audio_file_path
            WHEN up.media_type = 'video' THEN COALESCE(v.video_file_path, v.youtube_url)
          END as content_url,
          CASE
            WHEN up.media_type = 'book' THEN b.pdf_url
            ELSE NULL
          END as pdf_file_path,
          CASE
            WHEN up.media_type = 'audio' THEN ab.audio_file_path
            ELSE NULL
          END as audio_file_path,
          CASE
            WHEN up.media_type = 'video' THEN v.video_file_path
            ELSE NULL
          END as video_file_path,
          CASE
            WHEN up.media_type = 'video' THEN v.youtube_url
            ELSE NULL
          END as youtube_url,
          CASE
            WHEN up.media_type = 'video' THEN v.youtube_id
            ELSE NULL
          END as youtube_id,
          CASE
            WHEN up.media_type = 'book' THEN 'pdf'
            WHEN up.media_type = 'audio' THEN NULL
            WHEN up.media_type = 'video' THEN NULL
          END as file_format,
          CASE
            WHEN up.media_type = 'book' THEN 'application/pdf'
            WHEN up.media_type = 'audio' THEN NULL
            WHEN up.media_type = 'video' THEN NULL
          END as mime_type
        FROM user_progress up
        LEFT JOIN books b ON up.media_id = b.id AND up.media_type = 'book' AND b.is_active = true
        LEFT JOIN audio_books ab ON up.media_id = ab.id AND up.media_type = 'audio' AND ab.is_active = true
        LEFT JOIN videos v ON up.media_id = v.id AND up.media_type = 'video' AND v.is_active = true
        WHERE up.user_id = $1
          AND up.status != 'not_started'
          AND (
            (up.media_type = 'book' AND b.id IS NOT NULL) OR
            (up.media_type = 'audio' AND ab.id IS NOT NULL) OR
            (up.media_type = 'video' AND v.id IS NOT NULL)
          )
        ORDER BY up.last_accessed DESC
      `;

      const result = await pool.query(query, [userId]);

      // Group by status - only valid media items
      const inProgress = result.rows.filter(item => item.status === 'in_progress' && item.title);
      const completed = result.rows.filter(item => item.status === 'completed' && item.title);

      res.json({
        inProgress,
        completed,
        stats: {
          totalInProgress: inProgress.length,
          totalCompleted: completed.length,
          totalTimeSpent: result.rows.reduce((sum, item) => sum + (item.time_spent || 0), 0)
        }
      });
    } catch (error) {
      logger.error('Error getting user progress:', error);
      res.status(500).json({ error: 'Failed to fetch user progress' });
    }
  }

  // Track user activity
  static async trackActivity(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { media_type, media_id, activity_type, metadata = {} } = req.body;

      if (!media_type || !media_id || !activity_type) {
        return res.status(400).json({ error: 'Media type, media ID, and activity type are required' });
      }

      // Insert activity
      await pool.query(
        `INSERT INTO user_activity (user_id, media_type, media_id, activity_type, metadata)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [userId, media_type, media_id, activity_type, JSON.stringify(metadata)]
      );

      // Update or create progress record
      const progressData = metadata.progress || 0;
      const status = progressData >= 100 ? 'completed' :
                    progressData > 0 ? 'in_progress' : 'not_started';

      await pool.query(
        `INSERT INTO user_progress (user_id, media_type, media_id, progress_percentage, status, current_position, total_duration, time_spent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, media_type, media_id)
         DO UPDATE SET
           progress_percentage = EXCLUDED.progress_percentage,
           status = EXCLUDED.status,
           current_position = EXCLUDED.current_position,
           total_duration = EXCLUDED.total_duration,
           time_spent = user_progress.time_spent + EXCLUDED.time_spent,
           last_accessed = CURRENT_TIMESTAMP`,
        [
          userId,
          media_type,
          media_id,
          progressData,
          status,
          metadata.current_position || 0,
          metadata.total_duration || 0,
          metadata.time_spent || 0
        ]
      );

      // Update user preferences
      await pool.query(
        `INSERT INTO user_preferences (user_id, preferred_genres, preferred_languages, preferred_media_types, interaction_data)
         VALUES ($1, '{}', '{}', '{}', '{}')
         ON CONFLICT (user_id) DO UPDATE SET
           interaction_data = user_preferences.interaction_data || $2::jsonb`,
        [userId, JSON.stringify({ [`${media_type}_${activity_type}`]: Date.now() })]
      );

      res.json({ message: 'Activity tracked successfully' });
    } catch (error) {
      logger.error('Error tracking activity:', error);
      res.status(500).json({ error: 'Failed to track activity' });
    }
  }

  // Get dashboard overview
  static async getDashboardOverview(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const query = `
        WITH stats AS (
          SELECT
            COUNT(CASE WHEN up.status = 'in_progress' THEN 1 END) as in_progress_count,
            COUNT(CASE WHEN up.status = 'completed' THEN 1 END) as completed_count,
            COUNT(CASE WHEN up.status = 'not_started' THEN 1 END) as not_started_count,
            COALESCE(SUM(up.time_spent), 0) as total_time_spent
          FROM user_progress up
          WHERE up.user_id = $1
        ),
        recent_activity AS (
          SELECT COUNT(*) as recent_views
          FROM user_activity ua
          WHERE ua.user_id = $1
            AND ua.created_at >= (CURRENT_DATE - INTERVAL '7 days')::timestamp
        )
        SELECT
          s.*,
          ra.recent_views,
          CASE
            WHEN s.completed_count + s.in_progress_count = 0 THEN 0
            ELSE ROUND((s.completed_count::numeric / (s.completed_count + s.in_progress_count)::numeric) * 100, 2)
          END as completion_rate
        FROM stats s, recent_activity ra
      `;

      const result = await pool.query(query, [userId]);

      const rawOverview = result.rows[0] || {
        in_progress_count: 0,
        completed_count: 0,
        not_started_count: 0,
        total_time_spent: 0,
        recent_views: 0,
        completion_rate: 0
      };

      res.json({
        overview: {
          in_progress_count: parseInt(rawOverview.in_progress_count) || 0,
          completed_count: parseInt(rawOverview.completed_count) || 0,
          not_started_count: parseInt(rawOverview.not_started_count) || 0,
          total_time_spent: parseInt(rawOverview.total_time_spent) || 0,
          recent_views: parseInt(rawOverview.recent_views) || 0,
          completion_rate: parseFloat(rawOverview.completion_rate) || 0
        }
      });
    } catch (error) {
      logger.error('Error getting dashboard overview:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard overview' });
    }
  }
}