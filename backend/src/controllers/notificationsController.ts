import pool from '../config/database';
import { logger } from '../utils/logger';

export class NotificationsController {
  /**
   * Create a notification when new media is uploaded
   */
  static async createNotification(
    contentType: 'book' | 'audio' | 'video',
    contentId: string,
    title: string
  ): Promise<void> {
    try {
      // Generate notification message based on media type
      const messages = {
        book: `New book "${title}" is now available!`,
        audio: `New audiobook "${title}" is now available!`,
        video: `New video "${title}" is now available!`
      };

      const message = messages[contentType];

      const query = `
        INSERT INTO notifications (content_type, content_id, title, message, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
      `;

      const result = await pool.query(query, [contentType, contentId, title, message]);

      logger.info(`Created notification for ${contentType}: ${title} (ID: ${result.rows[0].id})`);
    } catch (error) {
      logger.error(`Error creating notification for ${contentType} ${contentId}:`, error);
      // Don't throw error - notification creation should not block media upload
    }
  }

  /**
   * Delete notification when media is deleted
   */
  static async deleteNotification(
    contentType: 'book' | 'audio' | 'video',
    contentId: string
  ): Promise<void> {
    try {
      const query = `
        UPDATE notifications
        SET is_active = false
        WHERE content_type = $1 AND content_id = $2
      `;

      await pool.query(query, [contentType, contentId]);

      logger.info(`Deactivated notification for ${contentType} ${contentId}`);
    } catch (error) {
      logger.error(`Error deactivating notification for ${contentType} ${contentId}:`, error);
    }
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM notifications n
        LEFT JOIN user_notifications un ON n.id = un.notification_id AND un.user_id = $1
        WHERE n.is_active = true
          AND COALESCE(un.read, false) = false
      `;

      const result = await pool.query(query, [userId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error(`Error getting unread count for user ${userId}:`, error);
      return 0;
    }
  }
}
