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
        SELECT f.*,
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
                 WHEN f.media_type = 'book' THEN b.cover_image_url
                 WHEN f.media_type = 'audio' THEN ab.cover_image_url
                 WHEN f.media_type = 'video' THEN v.thumbnail_url
               END as cover_image_url,
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
               v.description as video_description
        FROM favorites f
        LEFT JOIN books b ON f.media_id = b.id AND f.media_type = 'book'
        LEFT JOIN audio_books ab ON f.media_id = ab.id AND f.media_type = 'audio'
        LEFT JOIN videos v ON f.media_id = v.id AND f.media_type = 'video'
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC
      `;

      const result = await pool.query(query, [userId]);

      // Transform the results to include media details
      const favorites = result.rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        media_type: row.media_type,
        media_id: row.media_id,
        title: row.title,
        author: row.author,
        cover_image_url: row.cover_image_url,
        language: row.language,
        genre: row.genre_or_category,
        duration: row.duration,
        description: row.media_type === 'book' ? row.book_description :
                    row.media_type === 'audio' ? row.audio_description :
                    row.video_description,
        created_at: row.created_at
      }));

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

  // Toggle favorite status with race condition protection
  static async toggleFavorite(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { media_type, media_id } = req.body;

      // Use a transaction with proper locking to handle race conditions
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Check if already favorited with SELECT FOR UPDATE to lock the row
        const existingFavorite = await client.query(
          'SELECT id FROM favorites WHERE user_id = $1 AND media_type = $2 AND media_id = $3 FOR UPDATE',
          [userId, media_type, media_id]
        );

        if (existingFavorite.rows.length > 0) {
          // Remove from favorites
          await client.query(
            'DELETE FROM favorites WHERE user_id = $1 AND media_type = $2 AND media_id = $3',
            [userId, media_type, media_id]
          );

          await client.query('COMMIT');

          res.json({
            isFavorited: false,
            message: 'Removed from favorites'
          });
        } else {
          // Add to favorites with ON CONFLICT to handle duplicates
          const result = await client.query(
            'INSERT INTO favorites (user_id, media_type, media_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, media_type, media_id) DO NOTHING RETURNING *',
            [userId, media_type, media_id]
          );

          await client.query('COMMIT');

          // Check if the insert actually happened (not a duplicate)
          if (result.rows.length > 0) {
            res.status(201).json({
              isFavorited: true,
              message: 'Added to favorites',
              favorite: result.rows[0]
            });
          } else {
            // Item was already favorited (race condition - another request added it)
            res.json({
              isFavorited: true,
              message: 'Already in favorites'
            });
          }
        }
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error toggling favorite:', error);
      res.status(500).json({ error: 'Failed to toggle favorite' });
    }
  }
}