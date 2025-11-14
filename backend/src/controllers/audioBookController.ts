import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import { NotificationsController } from './notificationsController';
import { imageProcessingService } from '../services/ImageProcessingService';

export const getAllAudioBooks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const language = req.query.language as string;
    const genre = req.query.genre as string;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM audio_books WHERE is_active = true';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (language) {
      query += ` AND language = $${paramIndex}`;
      queryParams.push(language);
      paramIndex++;
    }

    if (genre) {
      query += ` AND genre ILIKE $${paramIndex}`;
      queryParams.push(`%${genre}%`);
      paramIndex++;
    }

    if (search) {
      query += ` AND (title ILIKE $${paramIndex} OR author ILIKE $${paramIndex} OR narrator ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM audio_books WHERE is_active = true';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (language) {
      countQuery += ` AND language = $${countParamIndex}`;
      countParams.push(language);
      countParamIndex++;
    }

    if (genre) {
      countQuery += ` AND genre ILIKE $${countParamIndex}`;
      countParams.push(`%${genre}%`);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (title ILIKE $${countParamIndex} OR author ILIKE $${countParamIndex} OR narrator ILIKE $${countParamIndex} OR description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      audioBooks: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get audio books error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAudioBookById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM audio_books WHERE id = $1 AND is_active = true',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Audio book not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get audio book error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createAudioBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      author,
      narrator,
      description,
      cover_image_url,
      language,
      genre,
      duration
    } = req.body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files?.audioFile || files.audioFile.length === 0) {
      res.status(400).json({ error: 'Audio file is required' });
      return;
    }

    const audio_file_path = files.audioFile[0].path;
    const file_size = files.audioFile[0].size;

    // Handle cover image: PRIORITIZE uploaded file over URL from request body
    let final_cover_image_url = null;
    let coverThumbnail = null;
    let coverSmall = null;
    let coverMedium = null;
    let coverLarge = null;

    // If a cover file was uploaded, ALWAYS use its path (highest priority)
    if (files?.coverFile && files.coverFile.length > 0) {
      // Convert file path to URL accessible by frontend
      const coverPath = files.coverFile[0].path;
      // Replace absolute path with relative path for URL construction
      final_cover_image_url = coverPath.replace(process.cwd(), '');
      // Ensure path starts with /
      if (!final_cover_image_url.startsWith('/')) {
        final_cover_image_url = '/' + final_cover_image_url;
      }

      try {
        // Process the uploaded image to generate multiple sizes
        const processedImages = await imageProcessingService.processUploadedImage(
          coverPath,
          {
            aspectRatio: '1:1', // Audio books use 1:1 square aspect ratio
            quality: 85,
            format: 'webp',
            outputDir: path.join(process.cwd(), 'public', 'images')
          }
        );

        // Convert absolute paths to relative URLs for database storage
        const publicDir = path.join(process.cwd(), 'public');
        coverThumbnail = imageProcessingService.convertToRelativePath(processedImages.thumbnail, publicDir);
        coverSmall = imageProcessingService.convertToRelativePath(processedImages.small, publicDir);
        coverMedium = imageProcessingService.convertToRelativePath(processedImages.medium, publicDir);
        coverLarge = imageProcessingService.convertToRelativePath(processedImages.large, publicDir);

        console.log('✅ Audio book cover image processed successfully');
      } catch (error) {
        console.error('❌ Error processing audio book cover image:', error);
        // Continue without processed images if processing fails
      }
    } else if (cover_image_url) {
      // Only use URL from text input if NO file was uploaded
      final_cover_image_url = cover_image_url;
    }

    const result = await pool.query(
      `INSERT INTO audio_books (
        title, author, narrator, description, cover_image_url, cover_image_thumbnail,
        cover_image_small, cover_image_medium, cover_image_large,
        audio_file_path, language, genre, duration, file_size, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [title, author, narrator, description, final_cover_image_url, coverThumbnail, coverSmall,
       coverMedium, coverLarge, audio_file_path, language, genre, duration, file_size, req.user!.id]
    );

    const createdAudioBook = result.rows[0];

    // Create notification for the new audiobook
    await NotificationsController.createNotification('audio', createdAudioBook.id, createdAudioBook.title);

    res.status(201).json({
      message: 'Audio book created successfully',
      audioBook: createdAudioBook
    });
  } catch (error) {
    console.error('Create audio book error:', error);
    // Clean up uploaded file on error
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.audioFile && files.audioFile.length > 0) {
      fs.unlink(files.audioFile[0].path, () => {});
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAudioBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title,
      author,
      narrator,
      description,
      cover_image_url,
      language,
      genre,
      duration,
      is_active
    } = req.body;


    let audio_file_path = null;
    let file_size = null;
    let final_cover_image_url = undefined; // undefined means "don't update this field"
    let coverThumbnail = undefined;
    let coverSmall = undefined;
    let coverMedium = undefined;
    let coverLarge = undefined;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Handle audio file upload
    if (files?.audioFile && files.audioFile.length > 0) {
      // Get old file path to delete later
      const oldFileResult = await pool.query(
        'SELECT audio_file_path FROM audio_books WHERE id = $1',
        [id]
      );

      if (oldFileResult.rows.length > 0) {
        const oldFilePath = oldFileResult.rows[0].audio_file_path;
        // Delete old file
        fs.unlink(oldFilePath, () => {});
      }

      audio_file_path = files.audioFile[0].path;
      file_size = files.audioFile[0].size;
    }

    // Handle cover image: PRIORITIZE uploaded file over URL from request body
    if (files?.coverFile && files.coverFile.length > 0) {
      // UPLOADED FILE - Always takes priority
      // Get old cover path to delete later
      const oldCoverResult = await pool.query(
        'SELECT cover_image_url FROM audio_books WHERE id = $1',
        [id]
      );

      if (oldCoverResult.rows.length > 0 && oldCoverResult.rows[0].cover_image_url) {
        const oldCoverPath = oldCoverResult.rows[0].cover_image_url;
        // Delete old cover file if it exists
        if (oldCoverPath.startsWith('/')) {
          const fullOldCoverPath = process.cwd() + oldCoverPath;
          fs.unlink(fullOldCoverPath, () => {});
        }
      }

      // Convert file path to URL accessible by frontend
      const coverPath = files.coverFile[0].path;
      final_cover_image_url = coverPath.replace(process.cwd(), '');
      // Ensure path starts with /
      if (!final_cover_image_url.startsWith('/')) {
        final_cover_image_url = '/' + final_cover_image_url;
      }

      try {
        // Process the uploaded image to generate multiple sizes
        const processedImages = await imageProcessingService.processUploadedImage(
          coverPath,
          {
            aspectRatio: '1:1', // Audio books use 1:1 square aspect ratio
            quality: 85,
            format: 'webp',
            outputDir: path.join(process.cwd(), 'public', 'images')
          }
        );

        // Convert absolute paths to relative URLs for database storage
        const publicDir = path.join(process.cwd(), 'public');
        coverThumbnail = imageProcessingService.convertToRelativePath(processedImages.thumbnail, publicDir);
        coverSmall = imageProcessingService.convertToRelativePath(processedImages.small, publicDir);
        coverMedium = imageProcessingService.convertToRelativePath(processedImages.medium, publicDir);
        coverLarge = imageProcessingService.convertToRelativePath(processedImages.large, publicDir);

        console.log('✅ Audio book cover image updated and processed successfully');
      } catch (error) {
        console.error('❌ Error processing updated audio book cover image:', error);
        // Continue without processed images if processing fails
      }
    } else if (cover_image_url !== undefined && cover_image_url !== null && cover_image_url !== '') {
      // URL FROM TEXT INPUT - Only use if no file was uploaded
      final_cover_image_url = cover_image_url;
    }
    // If both are empty/undefined, final_cover_image_url stays undefined (no update)

    // Convert string fields to appropriate types
    const durationNum = duration ? (typeof duration === 'string' ? parseInt(duration, 10) : duration) : null;
    const fileSizeNum = file_size || null; // file_size is already a number from req.file.size
    const isActiveBool = is_active !== undefined ? (is_active === 'true' || is_active === true) : undefined;

  
    const result = await pool.query(
      `UPDATE audio_books SET
        title = COALESCE($1, title),
        author = COALESCE($2, author),
        narrator = COALESCE($3, narrator),
        description = COALESCE($4, description),
        cover_image_url = COALESCE($5, cover_image_url),
        cover_image_thumbnail = COALESCE($6, cover_image_thumbnail),
        cover_image_small = COALESCE($7, cover_image_small),
        cover_image_medium = COALESCE($8, cover_image_medium),
        cover_image_large = COALESCE($9, cover_image_large),
        audio_file_path = COALESCE($10, audio_file_path),
        language = COALESCE($11, language),
        genre = COALESCE($12, genre),
        duration = COALESCE($13, duration),
        file_size = COALESCE($14, file_size),
        is_active = COALESCE($15, is_active)
      WHERE id = $16 AND is_active = true
      RETURNING *`,
      [title, author, narrator, description, final_cover_image_url, coverThumbnail, coverSmall,
       coverMedium, coverLarge, audio_file_path, language, genre, durationNum, fileSizeNum, isActiveBool, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Audio book not found' });
      return;
    }

    res.json({
      message: 'Audio book updated successfully',
      audioBook: result.rows[0]
    });
  } catch (error) {
    console.error('Update audio book error:', error);
    // Clean up uploaded files on error
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.audioFile && files.audioFile.length > 0) {
      fs.unlink(files.audioFile[0].path, () => {});
    }
    if (files?.coverFile && files.coverFile.length > 0) {
      fs.unlink(files.coverFile[0].path, () => {});
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteAudioBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // First get the audio book to check for files to delete
    const audioBookResult = await pool.query('SELECT * FROM audio_books WHERE id = $1', [id]);

    if (audioBookResult.rows.length === 0) {
      res.status(404).json({ error: 'Audio book not found' });
      return;
    }

    const audioBook = audioBookResult.rows[0];

    // Delete associated files from filesystem
    if (audioBook.audio_file_path && audioBook.audio_file_path.startsWith('/')) {
      const fullAudioPath = process.cwd() + audioBook.audio_file_path;
      fs.unlink(fullAudioPath, () => {
        console.log('Deleted audio file:', fullAudioPath);
      });
    }

    if (audioBook.cover_image_url && audioBook.cover_image_url.startsWith('/')) {
      const fullCoverPath = process.cwd() + audioBook.cover_image_url;
      fs.unlink(fullCoverPath, () => {
        console.log('Deleted cover image file:', fullCoverPath);
      });
    }

    // Delete the audio book record from database permanently
    const result = await pool.query('DELETE FROM audio_books WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Audio book not found' });
      return;
    }

    res.json({ message: 'Audio book deleted permanently' });
  } catch (error) {
    console.error('Delete audio book error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const streamAudio = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT audio_file_path FROM audio_books WHERE id = $1 AND is_active = true',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Audio book not found' });
      return;
    }

    const filePath = result.rows[0].audio_file_path;

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Stream audio error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};