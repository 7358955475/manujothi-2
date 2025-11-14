import express, { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { body, query, validationResult } from 'express-validator';
import pool from '../config/database';

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

    // Query to get notifications with full media item data
    const query = `
      SELECT
        n.id,
        n.content_type,
        n.content_id,
        n.title,
        n.message,
        n.created_at,
        COALESCE(un.read, false) as read,
        un.read_at,
        -- Get full media item data based on content_type
        CASE
          WHEN n.content_type = 'book' THEN json_build_object(
            'id', b.id,
            'title', b.title,
            'author', b.author,
            'cover_image_url', b.cover_image_url,
            'pdf_url', b.pdf_url,
            'file_format', b.file_format,
            'mime_type', b.mime_type,
            'language', b.language,
            'genre', b.genre,
            'published_year', b.published_year,
            'description', b.description,
            'created_at', b.created_at
          )
          WHEN n.content_type = 'audio' THEN json_build_object(
            'id', ab.id,
            'title', ab.title,
            'author', ab.author,
            'narrator', ab.narrator,
            'cover_image_url', ab.cover_image_url,
            'audio_file_path', ab.audio_file_path,
            'language', ab.language,
            'genre', ab.genre,
            'duration', ab.duration,
            'description', ab.description,
            'created_at', ab.created_at
          )
          WHEN n.content_type = 'video' THEN json_build_object(
            'id', v.id,
            'title', v.title,
            'thumbnail_url', v.thumbnail_url,
            'youtube_id', v.youtube_id,
            'youtube_url', v.youtube_url,
            'video_source', v.video_source,
            'video_file_path', v.video_file_path,
            'language', v.language,
            'category', v.category,
            'duration', v.duration,
            'description', v.description,
            'created_at', v.created_at
          )
        END as item
      FROM notifications n
      LEFT JOIN user_notifications un ON n.id = un.notification_id AND un.user_id = $1
      LEFT JOIN books b ON n.content_type = 'book' AND n.content_id = b.id AND b.is_active = true
      LEFT JOIN audio_books ab ON n.content_type = 'audio' AND n.content_id = ab.id AND ab.is_active = true
      LEFT JOIN videos v ON n.content_type = 'video' AND n.content_id = v.id AND v.is_active = true
      WHERE n.is_active = true
        AND (
          (n.content_type = 'book' AND b.id IS NOT NULL) OR
          (n.content_type = 'audio' AND ab.id IS NOT NULL) OR
          (n.content_type = 'video' AND v.id IS NOT NULL)
        )
      ORDER BY n.created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [userId, limit]);

    // Transform the notifications to include formatted time
    const notifications = result.rows.map(row => ({
      id: row.content_id, // Use content_id as notification ID for frontend
      notification_id: row.id,
      content_type: row.content_type,
      title: row.title,
      message: row.message,
      created_at: row.created_at,
      time: formatTimeAgo(row.created_at),
      read: row.read,
      read_at: row.read_at,
      item: row.item // Full media item data
    }));

    res.json({
      notifications,
      count: notifications.length,
      unread_count: notifications.filter(n => !n.read).length
    });
  } catch (error) {
    console.error('Error fetching latest content:', error);
    res.status(500).json({
      error: 'Failed to fetch latest content',
      message: 'Internal server error'
    });
  }
});

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(date).toLocaleDateString();
}

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

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!content_id || !content_type) {
      return res.status(400).json({ error: 'Content ID and type are required' });
    }

    // Find the notification ID
    const notificationQuery = `
      SELECT id FROM notifications
      WHERE content_id = $1 AND content_type = $2 AND is_active = true
      LIMIT 1
    `;
    const notificationResult = await pool.query(notificationQuery, [content_id, content_type]);

    if (notificationResult.rows.length === 0) {
      return res.json({
        message: 'Notification not found',
        success: true
      });
    }

    const notificationId = notificationResult.rows[0].id;

    // Insert or update user_notifications
    const upsertQuery = `
      INSERT INTO user_notifications (user_id, notification_id, read, read_at)
      VALUES ($1, $2, true, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, notification_id)
      DO UPDATE SET read = true, read_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    await pool.query(upsertQuery, [userId, notificationId]);

    res.json({
      message: 'Notification marked as read',
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