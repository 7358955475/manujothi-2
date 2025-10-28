import { Request, Response } from 'express';
import pool from '../config/database';
import { logger } from '../utils/logger';

export class DebugController {
  // Check what columns exist in each table
  static async checkTableColumns(req: Request, res: Response) {
    try {
      const tables = ['books', 'audio_books', 'videos'];
      const results: Record<string, any[]> = {};

      for (const table of tables) {
        const query = `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `;

        const result = await pool.query(query, [table]);
        results[table] = result.rows;
      }

      res.json({ tables: results });
    } catch (error) {
      logger.error('Error checking table columns:', error);
      res.status(500).json({ error: 'Failed to check table columns' });
    }
  }

  // Test simple queries
  static async testSimpleQuery(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Simple query without complex joins
      const simpleQuery = `
        SELECT
          ua.media_type,
          ua.media_id,
          ua.created_at as last_viewed
        FROM user_activity ua
        WHERE ua.user_id = $1
          AND ua.activity_type = 'viewed'
        ORDER BY ua.created_at DESC
        LIMIT 5
      `;

      const result = await pool.query(simpleQuery, [userId]);

      res.json({
        message: 'Simple query successful',
        data: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      logger.error('Error testing simple query:', error);
      res.status(500).json({ error: 'Failed to test simple query' });
    }
  }
}