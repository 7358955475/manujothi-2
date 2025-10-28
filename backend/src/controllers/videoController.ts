import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '../types';
import fs from 'fs';
import path from 'path';

const extractYouTubeId = (url: string): string => {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : '';
};

const getYouTubeThumbnail = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
};

export const getAllVideos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const language = req.query.language as string;
    const category = req.query.category as string;
    const offset = (page - 1) * limit;

    // For admin users, show all videos (active and inactive). For regular users, only active videos.
    const isAdmin = req.user && req.user.role === UserRole.ADMIN;
    let query = isAdmin ? 'SELECT * FROM videos WHERE 1=1' : 'SELECT * FROM videos WHERE is_active = true';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (language) {
      query += ` AND language = $${paramIndex}`;
      queryParams.push(language);
      paramIndex++;
    }

    if (category) {
      query += ` AND category ILIKE $${paramIndex}`;
      queryParams.push(`%${category}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Get total count
    let countQuery = isAdmin ? 'SELECT COUNT(*) FROM videos WHERE 1=1' : 'SELECT COUNT(*) FROM videos WHERE is_active = true';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (language) {
      countQuery += ` AND language = $${countParamIndex}`;
      countParams.push(language);
      countParamIndex++;
    }

    if (category) {
      countQuery += ` AND category ILIKE $${countParamIndex}`;
      countParams.push(`%${category}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      videos: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getVideoById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // For admin users, allow viewing inactive videos. For regular users, only active videos.
    const isAdmin = req.user && req.user.role === UserRole.ADMIN;
    const whereClause = isAdmin ? 'WHERE id = $1' : 'WHERE id = $1 AND is_active = true';

    const result = await pool.query(
      `SELECT * FROM videos ${whereClause}`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('Request body received:', req.body);
    console.log('Video source value:', req.body.video_source);
    console.log('Type of video source:', typeof req.body.video_source);

    const {
      title,
      description,
      youtube_url,
      language,
      category,
      duration,
      video_source
    } = req.body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Validate video source manually since express-validator doesn't work well with FormData
    if (!video_source || !['youtube', 'local'].includes(video_source)) {
      console.log('Validation failed for video_source:', video_source);
      console.log('Available values:', Object.keys(req.body));
      res.status(400).json({ error: 'Invalid video source. Must be youtube or local' });
      return;
    }

    let youtube_id = null;
    let youtube_url_final = null;
    let video_file_path = null;
    let file_size = null;
    let mime_type = null;
    let thumbnail_url = null;

    // Handle based on video source
    if (video_source === 'youtube') {
      // Handle YouTube video
      if (!youtube_url) {
        res.status(400).json({ error: 'YouTube URL is required for YouTube videos' });
        return;
      }

      youtube_id = extractYouTubeId(youtube_url);
      if (!youtube_id) {
        res.status(400).json({ error: 'Invalid YouTube URL' });
        return;
      }

      youtube_url_final = youtube_url;
      thumbnail_url = getYouTubeThumbnail(youtube_id);
    } else if (video_source === 'local') {
      // Handle local video upload
      if (!files?.videoFile || files.videoFile.length === 0) {
        res.status(400).json({ error: 'Video file is required for local uploads' });
        return;
      }

      const videoFile = files.videoFile[0];
      video_file_path = videoFile.path.replace(process.cwd(), '');
      if (!video_file_path.startsWith('/')) {
        video_file_path = '/' + video_file_path;
      }
      file_size = videoFile.size;
      mime_type = videoFile.mimetype;

      // For local videos, set youtube_url and youtube_id to empty strings to satisfy NOT NULL constraints
      youtube_url_final = '';
      youtube_id = '';

      // For local videos, we need a thumbnail
      if (files?.thumbnailFile && files.thumbnailFile.length > 0) {
        const thumbnailPath = files.thumbnailFile[0].path;
        thumbnail_url = thumbnailPath.replace(process.cwd(), '');
        if (!thumbnail_url.startsWith('/')) {
          thumbnail_url = '/' + thumbnail_url;
        }
      } else {
        // No thumbnail provided - set as null and let frontend handle fallback
        thumbnail_url = null;
      }
    } else {
      res.status(400).json({ error: 'Invalid video source. Must be youtube or local' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO videos (
        title, description, youtube_url, youtube_id, thumbnail_url,
        language, category, duration, video_source, video_file_path,
        file_size, mime_type, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        title, description, youtube_url_final, youtube_id, thumbnail_url,
        language, category, duration, video_source, video_file_path,
        file_size, mime_type, req.user!.id
      ]
    );

    res.status(201).json({
      message: 'Video created successfully',
      video: result.rows[0]
    });
  } catch (error) {
    console.error('Create video error:', error);
    // Clean up uploaded files on error
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.videoFile && files.videoFile.length > 0) {
      fs.unlink(files.videoFile[0].path, () => {});
    }
    if (files?.thumbnailFile && files.thumbnailFile.length > 0) {
      fs.unlink(files.thumbnailFile[0].path, () => {});
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      youtube_url,
      language,
      category,
      duration,
      is_active,
      video_source
    } = req.body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Validate video source manually if provided (express-validator doesn't work well with FormData)
    if (video_source && !['youtube', 'local'].includes(video_source)) {
      res.status(400).json({ error: 'Invalid video source. Must be youtube or local' });
      return;
    }

    let youtube_id = null;
    let youtube_url_final = null;
    let video_file_path = null;
    let file_size = null;
    let mime_type = null;
    let thumbnail_url = null;

    // Get current video data for cleanup
    const currentVideoResult = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);
    if (currentVideoResult.rows.length === 0) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }
    const currentVideo = currentVideoResult.rows[0];

    // Handle based on video source
    if (video_source === 'youtube') {
      if (youtube_url) {
        youtube_id = extractYouTubeId(youtube_url);
        if (!youtube_id) {
          res.status(400).json({ error: 'Invalid YouTube URL' });
          return;
        }
        youtube_url_final = youtube_url;
        thumbnail_url = getYouTubeThumbnail(youtube_id);
      }
    } else if (video_source === 'local') {
      // Handle local video file update
      if (files?.videoFile && files.videoFile.length > 0) {
        const videoFile = files.videoFile[0];
        video_file_path = videoFile.path.replace(process.cwd(), '');
        if (!video_file_path.startsWith('/')) {
          video_file_path = '/' + video_file_path;
        }
        file_size = videoFile.size;
        mime_type = videoFile.mimetype;

        // Delete old video file if exists
        if (currentVideo.video_file_path) {
          const fullOldVideoPath = process.cwd() + currentVideo.video_file_path;
          fs.unlink(fullOldVideoPath, () => {});
        }
      }
    }

    // Handle custom thumbnail upload
    if (files?.thumbnailFile && files.thumbnailFile.length > 0) {
      // Delete old thumbnail file if it's a local file
      if (currentVideo.thumbnail_url && currentVideo.thumbnail_url.startsWith('/')) {
        const fullOldThumbnailPath = process.cwd() + currentVideo.thumbnail_url;
        fs.unlink(fullOldThumbnailPath, () => {});
      }

      const thumbnailPath = files.thumbnailFile[0].path;
      thumbnail_url = thumbnailPath.replace(process.cwd(), '');
      if (!thumbnail_url.startsWith('/')) {
        thumbnail_url = '/' + thumbnail_url;
      }
    }

    const result = await pool.query(
      `UPDATE videos SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        youtube_url = COALESCE($3, youtube_url),
        youtube_id = COALESCE($4, youtube_id),
        thumbnail_url = COALESCE($5, thumbnail_url),
        language = COALESCE($6, language),
        category = COALESCE($7, category),
        duration = COALESCE($8, duration),
        video_source = COALESCE($9, video_source),
        video_file_path = COALESCE($10, video_file_path),
        file_size = COALESCE($11, file_size),
        mime_type = COALESCE($12, mime_type),
        is_active = COALESCE($13, is_active)
      WHERE id = $14
      RETURNING *`,
      [
        title, description, youtube_url_final, youtube_id, thumbnail_url,
        language, category, duration, video_source, video_file_path,
        file_size, mime_type, is_active, id
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    res.json({
      message: 'Video updated successfully',
      video: result.rows[0]
    });
  } catch (error) {
    console.error('Update video error:', error);
    // Clean up uploaded files on error
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.videoFile && files.videoFile.length > 0) {
      fs.unlink(files.videoFile[0].path, () => {});
    }
    if (files?.thumbnailFile && files.thumbnailFile.length > 0) {
      fs.unlink(files.thumbnailFile[0].path, () => {});
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // First get the video to check for files to delete
    const videoResult = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);

    if (videoResult.rows.length === 0) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const video = videoResult.rows[0];

    // Delete associated files from filesystem
    if (video.video_file_path) {
      const fullVideoPath = process.cwd() + video.video_file_path;
      fs.unlink(fullVideoPath, () => {
        console.log('Deleted video file:', fullVideoPath);
      });
    }

    if (video.thumbnail_url && video.thumbnail_url.startsWith('/')) {
      const fullThumbnailPath = process.cwd() + video.thumbnail_url;
      fs.unlink(fullThumbnailPath, () => {
        console.log('Deleted thumbnail file:', fullThumbnailPath);
      });
    }

    // Delete the video record from database permanently
    const result = await pool.query('DELETE FROM videos WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    res.json({ message: 'Video deleted permanently' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};