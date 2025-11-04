import { Request, Response } from 'express';
import pool from '../config/database';
import { logger } from '../utils/logger';

export interface FavoriteItem {
  id: string;
  user_id: string;
  media_type: 'book' | 'audio' | 'video';
  media_id: string;
  created_at: string;
}

export class FavoritesController {
  // Get all favorites for a user
  static async getUserFavorites(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const query = `
        SELECT f.id, f.user_id, f.media_type, f.media_id,
               CASE
                 WHEN f.media_type = 'book' THEN b.id
                 WHEN f.media_type = 'audio' THEN ab.id
                 WHEN f.media_type = 'video' THEN v.id
               END as actual_media_id,
               CASE
                 WHEN f.media_type = 'book' THEN b.title
                 WHEN f.media_type = 'audio' THEN ab.title
                 WHEN f.media_type = 'video' THEN v.title
               END as title,
               CASE
                 WHEN f.media_type = 'book' THEN b.author
                 WHEN f.media_type = 'audio' THEN ab.author
                 WHEN f.media_type = 'video' THEN NULL
               END as author,
               CASE
                 WHEN f.media_type = 'audio' THEN ab.narrator
                 ELSE NULL
               END as narrator,
               CASE
                 WHEN f.media_type = 'book' THEN b.cover_image_url
                 WHEN f.media_type = 'audio' THEN ab.cover_image_url
                 WHEN f.media_type = 'video' THEN v.thumbnail_url
               END as cover_image_url,
               CASE
                 WHEN f.media_type = 'video' THEN v.thumbnail_url
                 ELSE NULL
               END as thumbnail_url,
               CASE
                 WHEN f.media_type = 'video' THEN v.youtube_id
                 ELSE NULL
               END as youtube_id,
               CASE
                 WHEN f.media_type = 'video' THEN v.youtube_url
                 ELSE NULL
               END as youtube_url,
               CASE
                 WHEN f.media_type = 'video' THEN v.video_source
                 ELSE NULL
               END as video_source,
               CASE
                 WHEN f.media_type = 'video' THEN v.video_file_path
                 ELSE NULL
               END as video_file_path,
               CASE
                 WHEN f.media_type = 'audio' THEN ab.audio_file_path
                 ELSE NULL
               END as audio_file_path,
               CASE
                 WHEN f.media_type = 'book' THEN b.language
                 WHEN f.media_type = 'audio' THEN ab.language
                 WHEN f.media_type = 'video' THEN v.language
               END as language,
               CASE
                 WHEN f.media_type = 'book' THEN b.genre
                 WHEN f.media_type = 'audio' THEN ab.genre
                 WHEN f.media_type = 'video' THEN v.category
               END as genre_or_category,
               CASE
                 WHEN f.media_type = 'book' THEN b.published_year
                 WHEN f.media_type = 'audio' THEN ab.duration
                 WHEN f.media_type = 'video' THEN v.duration
               END as duration,
               b.description as book_description,
               ab.description as audio_description,
               v.description as video_description,
               f.created_at
        FROM favorites f
        LEFT JOIN books b ON f.media_id = b.id AND f.media_type = 'book' AND b.is_active = true
        LEFT JOIN audio_books ab ON f.media_id = ab.id AND f.media_type = 'audio' AND ab.is_active = true
        LEFT JOIN videos v ON f.media_id = v.id AND f.media_type = 'video' AND v.is_active = true
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC
      `;

      const result = await pool.query(query, [userId]);

      // Filter out favorites where the actual media item no longer exists or is inactive
      // and transform the results to include media details
      const favorites = result.rows
        .filter((row) => {
          // Only include items where the actual media still exists (actual_media_id is not null)
          const mediaExists = row.actual_media_id !== null;

          if (!mediaExists) {
            // Log orphaned favorites (favorites pointing to non-existent media)
            logger.warn(`Orphaned favorite found: User ${userId}, Media ${row.media_type}:${row.media_id} - media item no longer exists`);

            // Optionally, clean up orphaned favorites in the background
            pool.query(
              'DELETE FROM favorites WHERE id = $1',
              [row.id]
            ).catch(err => logger.error('Error cleaning up orphaned favorite:', err));
          }

          return mediaExists;
        })
        .map((row) => ({
          id: row.media_id, // Use actual media_id as the item ID for the frontend
          user_id: row.user_id,
          media_type: row.media_type,
          media_id: row.media_id,
          title: row.title,
          author: row.author,
          narrator: row.narrator,
          cover_image_url: row.cover_image_url,
          thumbnail_url: row.thumbnail_url,
          youtube_id: row.youtube_id,
          youtube_url: row.youtube_url,
          video_source: row.video_source,
          video_file_path: row.video_file_path,
          audio_file_path: row.audio_file_path,
          language: row.language,
          genre: row.genre_or_category,
          category: row.genre_or_category,
          duration: row.duration,
          published_year: row.media_type === 'book' ? row.duration : null,
          description: row.media_type === 'book' ? row.book_description :
                      row.media_type === 'audio' ? row.audio_description :
                      row.video_description,
          created_at: row.created_at
        }));

      logger.info(`Fetched ${favorites.length} valid favorites for user ${userId}`);

      res.json({ favorites, pagination: {
        total: favorites.length,
        page: 1,
        limit: favorites.length,
        pages: 1
      }});
    } catch (error) {
      logger.error('Error getting user favorites:', error);
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  }

  // Add a favorite
  static async addFavorite(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { media_type, media_id } = req.body;

      if (!media_type || !media_id) {
        return res.status(400).json({ error: 'Media type and media ID are required' });
      }

      if (!['book', 'audio', 'video'].includes(media_type)) {
        return res.status(400).json({ error: 'Invalid media type' });
      }

      // Check if already favorited
      const existingFavorite = await pool.query(
        'SELECT id FROM favorites WHERE user_id = $1 AND media_type = $2 AND media_id = $3',
        [userId, media_type, media_id]
      );

      if (existingFavorite.rows.length > 0) {
        return res.status(409).json({ error: 'Item already in favorites' });
      }

      // Add the favorite
      const result = await pool.query(
        'INSERT INTO favorites (user_id, media_type, media_id) VALUES ($1, $2, $3) RETURNING *',
        [userId, media_type, media_id]
      );

      const favorite = result.rows[0];
      logger.info(`User ${userId} added ${media_type} ${media_id} to favorites`);

      res.status(201).json({
        message: 'Added to favorites',
        favorite
      });
    } catch (error) {
      logger.error('Error adding favorite:', error);
      res.status(500).json({ error: 'Failed to add to favorites' });
    }
  }

  // Remove a favorite
  static async removeFavorite(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { media_type, media_id } = req.params;

      const result = await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND media_type = $2 AND media_id = $3 RETURNING *',
        [userId, media_type, media_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Favorite not found' });
      }

      logger.info(`User ${userId} removed ${media_type} ${media_id} from favorites`);

      res.json({
        message: 'Removed from favorites',
        deleted: true
      });
    } catch (error) {
      logger.error('Error removing favorite:', error);
      res.status(500).json({ error: 'Failed to remove from favorites' });
    }
  }

  // Check if an item is favorited
  static async checkFavorite(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { media_type, media_id } = req.params;

      const result = await pool.query(
        'SELECT id FROM favorites WHERE user_id = $1 AND media_type = $2 AND media_id = $3',
        [userId, media_type, media_id]
      );

      const isFavorited = result.rows.length > 0;

      res.json({ isFavorited });
    } catch (error) {
      logger.error('Error checking favorite status:', error);
      res.status(500).json({ error: 'Failed to check favorite status' });
    }
  }

  // Get favorites count for a user
  static async getFavoritesCount(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const result = await pool.query(
        'SELECT COUNT(*) as count FROM favorites WHERE user_id = $1',
        [userId]
      );

      const count = parseInt(result.rows[0].count);

      res.json({ count });
    } catch (error) {
      logger.error('Error getting favorites count:', error);
      res.status(500).json({ error: 'Failed to get favorites count' });
    }
  }

  // Batch check multiple favorites status at once
  static async batchCheckFavorites(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items array is required and cannot be empty' });
      }

      // Build dynamic query for batch check
      const values: any[] = [];
      const conditions: string[] = [];

      items.forEach((item, index) => {
        conditions.push(`($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`);
        values.push(userId, item.media_type, item.media_id);
      });

      const query = `
        SELECT temp.media_type, temp.media_id, COUNT(f.id) > 0 as is_favorited
        FROM (VALUES ${conditions.join(', ')}) AS temp(user_id, media_type, media_id)
        LEFT JOIN favorites f ON f.user_id::text = temp.user_id AND f.media_type = temp.media_type AND f.media_id::text = temp.media_id
        GROUP BY temp.media_type, temp.media_id
      `;

      const result = await pool.query(query, values);

      // Create a lookup map for fast access
      const favoriteMap = new Map();
      result.rows.forEach(row => {
        favoriteMap.set(`${row.media_type}:${row.media_id}`, row.is_favorited);
      });

      // Build response for all requested items
      const batchResults = items.map(item => ({
        media_type: item.media_type,
        media_id: item.media_id,
        is_favorited: favoriteMap.get(`${item.media_type}:${item.media_id}`) || false
      }));

      res.json({
        favorites: batchResults,
        count: batchResults.filter(item => item.is_favorited).length
      });
    } catch (error) {
      logger.error('Error batch checking favorites:', error);
      res.status(500).json({ error: 'Failed to batch check favorites' });
    }
  }

  // Toggle favorite status with enhanced race condition protection
  static async toggleFavorite(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { media_type, media_id } = req.body;

      // Validate inputs
      if (!media_type || !media_id) {
        return res.status(400).json({
          error: 'Media type and media ID are required',
          isFavorited: false
        });
      }

      if (!['book', 'audio', 'video'].includes(media_type)) {
        return res.status(400).json({
          error: 'Invalid media type. Must be book, audio, or video',
          isFavorited: false
        });
      }

      // Use a transaction with proper locking to handle race conditions
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        logger.info(`Toggle favorite request: User ${userId}, Media ${media_type}:${media_id}`);

        // Check if already favorited with SELECT FOR UPDATE to lock the row
        const existingFavorite = await client.query(
          'SELECT id, created_at FROM favorites WHERE user_id = $1 AND media_type = $2 AND media_id = $3 FOR UPDATE',
          [userId, media_type, media_id]
        );

        let response;
        let wasFavorited = existingFavorite.rows.length > 0;

        if (wasFavorited) {
          // Remove from favorites
          const deleteResult = await client.query(
            'DELETE FROM favorites WHERE user_id = $1 AND media_type = $2 AND media_id = $3 RETURNING id',
            [userId, media_type, media_id]
          );

          await client.query('COMMIT');
          logger.info(`User ${userId} removed ${media_type} ${media_id} from favorites`);

          response = {
            isFavorited: false,
            message: 'Removed from favorites',
            action: 'removed',
            success: true
          };
        } else {
          // Add to favorites with ON CONFLICT to handle duplicates
          const insertResult = await client.query(
            'INSERT INTO favorites (user_id, media_type, media_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, media_type, media_id) DO NOTHING RETURNING *',
            [userId, media_type, media_id]
          );

          await client.query('COMMIT');

          // Check if the insert actually happened (not a duplicate)
          if (insertResult.rows.length > 0) {
            logger.info(`User ${userId} added ${media_type} ${media_id} to favorites`);
            response = {
              isFavorited: true,
              message: 'Added to favorites',
              action: 'added',
              success: true,
              favorite: insertResult.rows[0]
            };
          } else {
            // Item was already favorited (race condition - another request added it)
            logger.warn(`Duplicate favorite attempt: User ${userId}, Media ${media_type}:${media_id}`);
            response = {
              isFavorited: true,
              message: 'Already in favorites',
              action: 'already_existed',
              success: true
            };
          }
        }

        // Add a small delay to prevent rapid successive clicks
        await new Promise(resolve => setTimeout(resolve, 100));

        // Send appropriate status code based on action
        if (response.action === 'added') {
          res.status(201).json(response);
        } else {
          res.json(response);
        }

      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Transaction error in toggleFavorite:', error);
        res.status(500).json({
          error: 'Failed to toggle favorite',
          isFavorited: false,
          success: false
        });
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error toggling favorite:', error);
      res.status(500).json({
        error: 'Failed to toggle favorite',
        isFavorited: false,
        success: false
      });
    }
  }
}