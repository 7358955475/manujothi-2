import { Request, Response } from 'express';
import pool from '../config/database';

// Helper function to calculate time range
const getTimeRangeFilter = (timeRange: string) => {
  const now = new Date();
  let startDate;

  switch (timeRange) {
    case '1h':
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return startDate.toISOString();
};

export class AnalyticsController {
  // Get content performance metrics
  static async getContentPerformance(req: Request, res: Response) {
    try {
      const { timeRange = '7d', limit = 10 } = req.query;
      const limitNum = parseInt(limit as string);

      // Validate limit parameter
      if (limitNum < 0) {
        return res.status(400).json({ error: 'Limit must be a positive number' });
      }

      const startDate = getTimeRangeFilter(timeRange as string);

      const query = `
        WITH content_views AS (
          SELECT
            ua.media_type,
            ua.media_id,
            COUNT(DISTINCT ua.user_id) as view_count,
            COALESCE(AVG(up.progress_percentage), 0) as avg_progress
          FROM user_activity ua
          LEFT JOIN user_progress up ON ua.media_id = up.media_id
            AND ua.media_type = up.media_type
            AND ua.user_id = up.user_id
          WHERE ua.activity_type IN ('viewed', 'in_progress')
            AND ua.created_at >= $1
          GROUP BY ua.media_type, ua.media_id
        ),
        content_favorites AS (
          SELECT
            media_type,
            media_id,
            COUNT(*) as favorite_count
          FROM favorites
          WHERE created_at >= $1
          GROUP BY media_type, media_id
        ),
        combined_stats AS (
          SELECT
            cv.media_type as content_type,
            cv.media_id,
            COALESCE(cv.view_count, 0) as view_count,
            COALESCE(cf.favorite_count, 0) as favorite_count,
            cv.avg_progress,
            CASE
              WHEN cv.media_type = 'book' THEN b.title
              WHEN cv.media_type = 'audio' THEN ab.title
              WHEN cv.media_type = 'video' THEN v.title
            END as title
          FROM content_views cv
          LEFT JOIN content_favorites cf ON cv.media_type = cf.media_type
            AND cv.media_id = cf.media_id
          LEFT JOIN books b ON cv.media_id = b.id AND cv.media_type = 'book'
          LEFT JOIN audio_books ab ON cv.media_id = ab.id AND cv.media_type = 'audio'
          LEFT JOIN videos v ON cv.media_id = v.id AND cv.media_type = 'video'
          WHERE (
            (cv.media_type = 'book' AND b.id IS NOT NULL) OR
            (cv.media_type = 'audio' AND ab.id IS NOT NULL) OR
            (cv.media_type = 'video' AND v.id IS NOT NULL)
          )
        )
        SELECT * FROM combined_stats
        ORDER BY view_count DESC, favorite_count DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [startDate, limitNum]);

      const performance = result.rows.map(row => ({
        content_type: row.content_type,
        media_id: row.media_id,
        title: row.title,
        view_count: parseInt(row.view_count),
        favorite_count: parseInt(row.favorite_count),
        avg_progress: parseFloat(row.avg_progress)
      }));

      res.json(performance);
    } catch (error: any) {
      console.error('Error getting content performance:', error);
      res.status(500).json({ error: 'Failed to fetch content performance data' });
    }
  }

  // Get user engagement metrics
  static async getUserEngagement(req: Request, res: Response) {
    try {
      const { timeRange = '7d' } = req.query;
      const startDate = getTimeRangeFilter(timeRange as string);

      const query = `
        WITH user_stats AS (
          SELECT
            (SELECT COUNT(*) FROM users) as total_users,
            (SELECT COUNT(DISTINCT user_id) FROM user_activity WHERE created_at >= $1) as active_users,
            (SELECT COUNT(*) FROM users WHERE created_at >= $1) as new_users,
            (SELECT COUNT(DISTINCT user_id) FROM user_activity) as total_active_users,
            (SELECT COALESCE(AVG(time_spent), 0) FROM user_progress WHERE updated_at >= $1) as avg_session_duration,
            (SELECT COUNT(*) FROM user_activity WHERE created_at >= $1) as total_sessions
        )
        SELECT
          total_users,
          active_users,
          new_users,
          CASE
            WHEN total_users > 0 THEN ROUND((active_users::numeric / total_users::numeric) * 100, 2)
            ELSE 0
          END as retention_rate,
          ROUND(avg_session_duration::numeric, 2) as avg_session_duration,
          total_sessions
        FROM user_stats
      `;

      const result = await pool.query(query, [startDate]);

      const data = result.rows[0];
      res.json({
        total_users: parseInt(data.total_users),
        active_users: parseInt(data.active_users),
        new_users: parseInt(data.new_users),
        retention_rate: parseFloat(data.retention_rate),
        avg_session_duration: parseFloat(data.avg_session_duration),
        total_sessions: parseInt(data.total_sessions)
      });
    } catch (error: any) {
      console.error('Error getting user engagement:', error);
      res.status(500).json({ error: 'Failed to fetch user engagement data' });
    }
  }

  // Get activity trends over time
  static async getActivityTrends(req: Request, res: Response) {
    try {
      const { timeRange = '7d', groupBy = 'day' } = req.query;
      const startDate = getTimeRangeFilter(timeRange as string);

      let dateFormat = 'YYYY-MM-DD';
      let dateTrunc = 'day';

      if (timeRange === '1h') {
        dateFormat = 'HH24:MI';
        dateTrunc = 'minute';
      } else if (timeRange === '24h') {
        dateFormat = 'YYYY-MM-DD HH24:00';
        dateTrunc = 'hour';
      }

      const query = `
        WITH activity_data AS (
          SELECT
            DATE_TRUNC('${dateTrunc}', ua.created_at) as period,
            COUNT(CASE WHEN ua.activity_type = 'viewed' THEN 1 END) as views,
            COUNT(CASE WHEN ua.activity_type = 'completed' THEN 1 END) as completions
          FROM user_activity ua
          WHERE ua.created_at >= $1
          GROUP BY DATE_TRUNC('${dateTrunc}', ua.created_at)
        ),
        favorites_data AS (
          SELECT
            DATE_TRUNC('${dateTrunc}', created_at) as period,
            COUNT(*) as favorites
          FROM favorites
          WHERE created_at >= $1
          GROUP BY DATE_TRUNC('${dateTrunc}', created_at)
        )
        SELECT
          TO_CHAR(ad.period, '${dateFormat}') as period,
          COALESCE(ad.views, 0) as views,
          COALESCE(ad.completions, 0) as completions,
          COALESCE(fd.favorites, 0) as favorites
        FROM activity_data ad
        LEFT JOIN favorites_data fd ON ad.period = fd.period
        ORDER BY ad.period ASC
      `;

      const result = await pool.query(query, [startDate]);

      const trends = result.rows.map(row => ({
        period: row.period,
        views: parseInt(row.views),
        completions: parseInt(row.completions),
        favorites: parseInt(row.favorites)
      }));

      res.json(trends);
    } catch (error: any) {
      console.error('Error getting activity trends:', error);
      res.status(500).json({ error: 'Failed to fetch activity trends data' });
    }
  }

  // Get peak usage times
  static async getPeakUsageTimes(req: Request, res: Response) {
    try {
      const { timeRange = '7d' } = req.query;
      const startDate = getTimeRangeFilter(timeRange as string);

      const query = `
        WITH hourly_stats AS (
          SELECT
            EXTRACT(HOUR FROM created_at) as hour,
            COUNT(*) as activity_count
          FROM user_activity
          WHERE created_at >= $1
          GROUP BY EXTRACT(HOUR FROM created_at)
        ),
        daily_stats AS (
          SELECT
            TO_CHAR(created_at, 'Day') as day_name,
            EXTRACT(DOW FROM created_at) as day_num,
            COUNT(*) as activity_count
          FROM user_activity
          WHERE created_at >= $1
          GROUP BY TO_CHAR(created_at, 'Day'), EXTRACT(DOW FROM created_at)
        )
        SELECT
          json_build_object(
            'by_hour', (SELECT json_agg(row_to_json(h)) FROM (
              SELECT hour, activity_count FROM hourly_stats ORDER BY hour
            ) h),
            'by_day', (SELECT json_agg(row_to_json(d)) FROM (
              SELECT day_name, activity_count FROM daily_stats ORDER BY day_num
            ) d)
          ) as data
      `;

      const result = await pool.query(query, [startDate]);

      res.json(result.rows[0].data);
    } catch (error: any) {
      console.error('Error getting peak usage:', error);
      res.status(500).json({ error: 'Failed to fetch peak usage data' });
    }
  }

  // Get comparative stats (period over period)
  static async getComparativeStats(req: Request, res: Response) {
    try {
      const { timeRange = '7d' } = req.query;
      const currentStartDate = getTimeRangeFilter(timeRange as string);

      // Calculate previous period
      const currentStart = new Date(currentStartDate);
      const periodLength = new Date().getTime() - currentStart.getTime();
      const previousStart = new Date(currentStart.getTime() - periodLength);

      const query = `
        WITH current_stats AS (
          SELECT
            COUNT(DISTINCT CASE WHEN ua.activity_type = 'viewed' THEN ua.id END) as views,
            COUNT(DISTINCT f.id) as favorites,
            COUNT(DISTINCT ua.user_id) as users,
            COALESCE(AVG(up.progress_percentage), 0) as avg_progress
          FROM user_activity ua
          LEFT JOIN favorites f ON f.created_at >= $1
          LEFT JOIN user_progress up ON up.updated_at >= $1
          WHERE ua.created_at >= $1
        ),
        previous_stats AS (
          SELECT
            COUNT(DISTINCT CASE WHEN ua.activity_type = 'viewed' THEN ua.id END) as views,
            COUNT(DISTINCT f.id) as favorites,
            COUNT(DISTINCT ua.user_id) as users,
            COALESCE(AVG(up.progress_percentage), 0) as avg_progress
          FROM user_activity ua
          LEFT JOIN favorites f ON f.created_at >= $2 AND f.created_at < $1
          LEFT JOIN user_progress up ON up.updated_at >= $2 AND up.updated_at < $1
          WHERE ua.created_at >= $2 AND ua.created_at < $1
        )
        SELECT
          json_build_object(
            'views', c.views,
            'favorites', c.favorites,
            'users', c.users,
            'avg_progress', ROUND(c.avg_progress::numeric, 2)
          ) as current,
          json_build_object(
            'views', p.views,
            'favorites', p.favorites,
            'users', p.users,
            'avg_progress', ROUND(p.avg_progress::numeric, 2)
          ) as previous,
          json_build_object(
            'views', CASE WHEN p.views > 0 THEN ROUND(((c.views - p.views)::numeric / p.views::numeric) * 100, 2) ELSE 0 END,
            'favorites', CASE WHEN p.favorites > 0 THEN ROUND(((c.favorites - p.favorites)::numeric / p.favorites::numeric) * 100, 2) ELSE 0 END,
            'users', CASE WHEN p.users > 0 THEN ROUND(((c.users - p.users)::numeric / p.users::numeric) * 100, 2) ELSE 0 END,
            'avg_progress', CASE WHEN p.avg_progress > 0 THEN ROUND(((c.avg_progress - p.avg_progress)::numeric / p.avg_progress::numeric) * 100, 2) ELSE 0 END
          ) as change
        FROM current_stats c, previous_stats p
      `;

      const result = await pool.query(query, [currentStartDate, previousStart.toISOString()]);

      res.json(result.rows[0]);
    } catch (error: any) {
      console.error('Error getting comparative stats:', error);
      res.status(500).json({ error: 'Failed to fetch comparative stats' });
    }
  }

  // Get real-time activity (last hour)
  static async getRealTimeActivity(req: Request, res: Response) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const query = `
        WITH recent_activities AS (
          SELECT
            u.first_name || ' ' || u.last_name as user_name,
            ua.activity_type,
            ua.created_at,
            ua.media_type,
            ua.media_id,
            CASE
              WHEN ua.media_type = 'book' THEN b.title
              WHEN ua.media_type = 'audio' THEN ab.title
              WHEN ua.media_type = 'video' THEN v.title
            END as content_title
          FROM user_activity ua
          JOIN users u ON ua.user_id = u.id
          LEFT JOIN books b ON ua.media_id = b.id AND ua.media_type = 'book'
          LEFT JOIN audio_books ab ON ua.media_id = ab.id AND ua.media_type = 'audio'
          LEFT JOIN videos v ON ua.media_id = v.id AND ua.media_type = 'video'
          WHERE ua.created_at >= $1
          ORDER BY ua.created_at DESC
          LIMIT 20
        ),
        active_now AS (
          SELECT COUNT(DISTINCT user_id) as count
          FROM user_activity
          WHERE created_at >= $2
        )
        SELECT
          (SELECT json_agg(row_to_json(ra)) FROM recent_activities ra) as recent_activities,
          (SELECT count FROM active_now) as active_now
      `;

      const result = await pool.query(query, [oneHourAgo, fiveMinutesAgo]);

      res.json({
        recent_activities: result.rows[0].recent_activities || [],
        active_now: parseInt(result.rows[0].active_now) || 0
      });
    } catch (error: any) {
      console.error('Error getting real-time activity:', error);
      res.status(500).json({ error: 'Failed to fetch real-time activity' });
    }
  }
}
