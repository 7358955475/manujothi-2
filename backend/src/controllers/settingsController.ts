import { Request, Response } from 'express';
import pool from '../config/database';

/**
 * Settings Controller
 * Manages user preferences, notification settings, and account configuration
 * All data is fetched dynamically from the database
 */

// Get user settings (preferences + notification settings + account info)
export const getUserSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Fetch user profile
    const userQuery = `
      SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Fetch user preferences
    const preferencesQuery = `
      SELECT id, user_id, preferred_genres, preferred_languages, preferred_media_types,
             interaction_data, created_at, updated_at
      FROM user_preferences
      WHERE user_id = $1
    `;
    const preferencesResult = await pool.query(preferencesQuery, [userId]);

    // Fetch notification preferences (check if user wants notifications)
    const notificationSettingsQuery = `
      SELECT
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN read = false THEN 1 END) as unread_notifications
      FROM user_notifications
      WHERE user_id = $1
    `;
    const notificationSettingsResult = await pool.query(notificationSettingsQuery, [userId]);

    // Fetch user activity statistics
    const activityQuery = `
      SELECT
        media_type,
        COUNT(*) as count,
        MAX(created_at) as last_accessed
      FROM user_activity
      WHERE user_id = $1
      GROUP BY media_type
    `;
    const activityResult = await pool.query(activityQuery, [userId]);

    // Fetch favorites count
    const favoritesQuery = `
      SELECT COUNT(*) as favorites_count
      FROM favorites
      WHERE user_id = $1
    `;
    const favoritesResult = await pool.query(favoritesQuery, [userId]);

    res.json({
      success: true,
      data: {
        user: userResult.rows[0],
        preferences: preferencesResult.rows[0] || {
          preferred_genres: [],
          preferred_languages: [],
          preferred_media_types: [],
          interaction_data: {}
        },
        notifications: {
          total: parseInt(notificationSettingsResult.rows[0]?.total_notifications || '0'),
          unread: parseInt(notificationSettingsResult.rows[0]?.unread_notifications || '0'),
          enabled: true // Default enabled
        },
        activity: activityResult.rows.reduce((acc: any, row: any) => {
          acc[row.media_type] = {
            count: parseInt(row.count),
            lastAccessed: row.last_accessed
          };
          return acc;
        }, {}),
        stats: {
          favoritesCount: parseInt(favoritesResult.rows[0]?.favorites_count || '0')
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update user profile
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { first_name, last_name, email } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Update user profile
    const updateQuery = `
      UPDATE users
      SET first_name = $1, last_name = $2, email = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, email, first_name, last_name, role, is_active, created_at, updated_at
    `;
    const result = await pool.query(updateQuery, [first_name, last_name, email, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update user preferences
export const updateUserPreferences = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { preferred_genres, preferred_languages, preferred_media_types } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Check if preferences exist
    const checkQuery = `SELECT id FROM user_preferences WHERE user_id = $1`;
    const checkResult = await pool.query(checkQuery, [userId]);

    let result;
    if (checkResult.rows.length === 0) {
      // Create new preferences
      const insertQuery = `
        INSERT INTO user_preferences (user_id, preferred_genres, preferred_languages, preferred_media_types)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      result = await pool.query(insertQuery, [
        userId,
        preferred_genres || [],
        preferred_languages || [],
        preferred_media_types || []
      ]);
    } else {
      // Update existing preferences
      const updateQuery = `
        UPDATE user_preferences
        SET
          preferred_genres = $1,
          preferred_languages = $2,
          preferred_media_types = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $4
        RETURNING *
      `;
      result = await pool.query(updateQuery, [
        preferred_genres || [],
        preferred_languages || [],
        preferred_media_types || [],
        userId
      ]);
    }

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Change password
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { current_password, new_password } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const userQuery = `SELECT password_hash FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Update password
    const updateQuery = `
      UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await pool.query(updateQuery, [hashedPassword, userId]);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Delete user account
export const deleteUserAccount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { password } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to delete account' });
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    const userQuery = `SELECT password_hash FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Password is incorrect' });
    }

    // Soft delete: deactivate user
    const deleteQuery = `
      UPDATE users
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await pool.query(deleteQuery, [userId]);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user account:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get user activity statistics
export const getUserActivityStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Fetch comprehensive activity statistics
    const statsQuery = `
      SELECT
        media_type,
        activity_type,
        COUNT(*) as count,
        MAX(created_at) as last_accessed,
        MIN(created_at) as first_accessed
      FROM user_activity
      WHERE user_id = $1
      GROUP BY media_type, activity_type
      ORDER BY media_type, activity_type
    `;
    const statsResult = await pool.query(statsQuery, [userId]);

    // Fetch total time spent (if progress tracking exists)
    const progressQuery = `
      SELECT
        media_type,
        SUM(progress_percentage) as total_progress,
        COUNT(*) as items_in_progress,
        COUNT(CASE WHEN progress_percentage = 100 THEN 1 END) as completed_items
      FROM user_progress
      WHERE user_id = $1
      GROUP BY media_type
    `;
    const progressResult = await pool.query(progressQuery, [userId]);

    res.json({
      success: true,
      data: {
        activity: statsResult.rows,
        progress: progressResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching activity statistics:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
