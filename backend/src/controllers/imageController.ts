import { Request, Response } from 'express';
import pool from '../config/database';
import { imageProcessingService } from '../services/ImageProcessingService';
import path from 'path';

interface RegenerateRequest {
  mediaType: 'book' | 'audiobook' | 'video';
  mediaId: string;
  focalPoint?: { x: number; y: number };
}

/**
 * Get statistics about image variants across all media
 */
export async function getImageStats(req: Request, res: Response) {
  try {
    const stats = {
      books: { total: 0, missingVariants: 0 },
      audiobooks: { total: 0, missingVariants: 0 },
      videos: { total: 0, missingVariants: 0 }
    };

    // Check books
    const booksResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE cover_image_thumbnail IS NULL OR cover_image_small IS NULL OR cover_image_medium IS NULL OR cover_image_large IS NULL) as missing
      FROM books
      WHERE cover_image_url IS NOT NULL
    `);
    stats.books.total = parseInt(booksResult.rows[0]?.total || '0');
    stats.books.missingVariants = parseInt(booksResult.rows[0]?.missing || '0');

    // Check audiobooks
    const audiobooksResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE cover_image_thumbnail IS NULL OR cover_image_small IS NULL OR cover_image_medium IS NULL OR cover_image_large IS NULL) as missing
      FROM audio_books
      WHERE cover_image_url IS NOT NULL
    `);
    stats.audiobooks.total = parseInt(audiobooksResult.rows[0]?.total || '0');
    stats.audiobooks.missingVariants = parseInt(audiobooksResult.rows[0]?.missing || '0');

    // Check videos
    const videosResult = await pool.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE thumbnail_thumbnail IS NULL OR thumbnail_small IS NULL OR thumbnail_medium IS NULL OR thumbnail_large IS NULL) as missing
      FROM videos
      WHERE thumbnail_url IS NOT NULL
    `);
    stats.videos.total = parseInt(videosResult.rows[0]?.total || '0');
    stats.videos.missingVariants = parseInt(videosResult.rows[0]?.missing || '0');

    res.json({
      success: true,
      stats,
      totalMissing: stats.books.missingVariants + stats.audiobooks.missingVariants + stats.videos.missingVariants
    });
  } catch (error) {
    console.error('Error getting image stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get image statistics' });
  }
}

/**
 * Regenerate image variants for a specific media item
 */
export async function regenerateImageVariants(req: Request, res: Response) {
  try {
    const { mediaType, mediaId, focalPoint }: RegenerateRequest = req.body;

    if (!mediaType || !mediaId) {
      return res.status(400).json({
        success: false,
        message: 'mediaType and mediaId are required'
      });
    }

    const publicDir = path.resolve(__dirname, '../../');

    let result;
    switch (mediaType) {
      case 'book':
        result = await regenerateBookVariants(mediaId, publicDir, focalPoint);
        break;
      case 'audiobook':
        result = await regenerateAudioBookVariants(mediaId, publicDir, focalPoint);
        break;
      case 'video':
        result = await regenerateVideoVariants(mediaId, publicDir, focalPoint);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid mediaType. Must be: book, audiobook, or video'
        });
    }

    res.json({
      success: true,
      message: 'Image variants regenerated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error regenerating image variants:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to regenerate image variants'
    });
  }
}

/**
 * Batch regenerate all missing variants
 */
export async function regenerateAllMissingVariants(req: Request, res: Response) {
  try {
    const publicDir = path.resolve(__dirname, '../../');
    const results = {
      books: { processed: 0, errors: 0 },
      audiobooks: { processed: 0, errors: 0 },
      videos: { processed: 0, errors: 0 }
    };

    // Regenerate missing book variants
    const booksQuery = await pool.query(`
      SELECT id, cover_image_url
      FROM books
      WHERE cover_image_url IS NOT NULL
        AND (cover_image_thumbnail IS NULL OR cover_image_small IS NULL OR cover_image_medium IS NULL OR cover_image_large IS NULL)
    `);

    for (const book of booksQuery.rows) {
      try {
        await regenerateBookVariants(book.id, publicDir);
        results.books.processed++;
      } catch (error) {
        console.error(`Error regenerating book ${book.id}:`, error);
        results.books.errors++;
      }
    }

    // Regenerate missing audiobook variants
    const audiobooksQuery = await pool.query(`
      SELECT id, cover_image_url
      FROM audio_books
      WHERE cover_image_url IS NOT NULL
        AND (cover_image_thumbnail IS NULL OR cover_image_small IS NULL OR cover_image_medium IS NULL OR cover_image_large IS NULL)
    `);

    for (const audiobook of audiobooksQuery.rows) {
      try {
        await regenerateAudioBookVariants(audiobook.id, publicDir);
        results.audiobooks.processed++;
      } catch (error) {
        console.error(`Error regenerating audiobook ${audiobook.id}:`, error);
        results.audiobooks.errors++;
      }
    }

    // Regenerate missing video variants
    const videosQuery = await pool.query(`
      SELECT id, thumbnail_url
      FROM videos
      WHERE thumbnail_url IS NOT NULL
        AND (thumbnail_thumbnail IS NULL OR thumbnail_small IS NULL OR thumbnail_medium IS NULL OR thumbnail_large IS NULL)
    `);

    for (const video of videosQuery.rows) {
      try {
        await regenerateVideoVariants(video.id, publicDir);
        results.videos.processed++;
      } catch (error) {
        console.error(`Error regenerating video ${video.id}:`, error);
        results.videos.errors++;
      }
    }

    res.json({
      success: true,
      message: 'Batch regeneration completed',
      results
    });
  } catch (error) {
    console.error('Error in batch regeneration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete batch regeneration'
    });
  }
}

// Helper functions

async function regenerateBookVariants(
  bookId: string,
  publicDir: string,
  focalPoint?: { x: number; y: number }
) {
  const bookQuery = await pool.query(
    'SELECT id, cover_image_url FROM books WHERE id = $1',
    [bookId]
  );

  if (bookQuery.rows.length === 0) {
    throw new Error('Book not found');
  }

  const book = bookQuery.rows[0];
  if (!book.cover_image_url) {
    throw new Error('Book has no cover image');
  }

  // Regenerate variants
  const variants = await imageProcessingService.regenerateVariants(
    book.cover_image_url,
    '3:4',
    publicDir,
    focalPoint
  );

  // Update database
  const relativePath = (p: string) => imageProcessingService.convertToRelativePath(p, publicDir);

  await pool.query(
    `UPDATE books
     SET cover_image_thumbnail = $1,
         cover_image_small = $2,
         cover_image_medium = $3,
         cover_image_large = $4,
         updated_at = NOW()
     WHERE id = $5`,
    [
      relativePath(variants.thumbnail),
      relativePath(variants.small),
      relativePath(variants.medium),
      relativePath(variants.large),
      bookId
    ]
  );

  return {
    id: bookId,
    variants: {
      thumbnail: relativePath(variants.thumbnail),
      small: relativePath(variants.small),
      medium: relativePath(variants.medium),
      large: relativePath(variants.large)
    }
  };
}

async function regenerateAudioBookVariants(
  audiobookId: string,
  publicDir: string,
  focalPoint?: { x: number; y: number }
) {
  const audiobookQuery = await pool.query(
    'SELECT id, cover_image_url FROM audio_books WHERE id = $1',
    [audiobookId]
  );

  if (audiobookQuery.rows.length === 0) {
    throw new Error('Audiobook not found');
  }

  const audiobook = audiobookQuery.rows[0];
  if (!audiobook.cover_image_url) {
    throw new Error('Audiobook has no cover image');
  }

  // Regenerate variants (1:1 aspect ratio for audiobooks)
  const variants = await imageProcessingService.regenerateVariants(
    audiobook.cover_image_url,
    '1:1',
    publicDir,
    focalPoint
  );

  // Update database
  const relativePath = (p: string) => imageProcessingService.convertToRelativePath(p, publicDir);

  await pool.query(
    `UPDATE audio_books
     SET cover_image_thumbnail = $1,
         cover_image_small = $2,
         cover_image_medium = $3,
         cover_image_large = $4,
         updated_at = NOW()
     WHERE id = $5`,
    [
      relativePath(variants.thumbnail),
      relativePath(variants.small),
      relativePath(variants.medium),
      relativePath(variants.large),
      audiobookId
    ]
  );

  return {
    id: audiobookId,
    variants: {
      thumbnail: relativePath(variants.thumbnail),
      small: relativePath(variants.small),
      medium: relativePath(variants.medium),
      large: relativePath(variants.large)
    }
  };
}

async function regenerateVideoVariants(
  videoId: string,
  publicDir: string,
  focalPoint?: { x: number; y: number }
) {
  const videoQuery = await pool.query(
    'SELECT id, thumbnail_url FROM videos WHERE id = $1',
    [videoId]
  );

  if (videoQuery.rows.length === 0) {
    throw new Error('Video not found');
  }

  const video = videoQuery.rows[0];
  if (!video.thumbnail_url) {
    throw new Error('Video has no thumbnail');
  }

  // Regenerate variants (16:9 aspect ratio for videos)
  const variants = await imageProcessingService.regenerateVariants(
    video.thumbnail_url,
    '16:9',
    publicDir,
    focalPoint
  );

  // Update database
  const relativePath = (p: string) => imageProcessingService.convertToRelativePath(p, publicDir);

  await pool.query(
    `UPDATE videos
     SET thumbnail_thumbnail = $1,
         thumbnail_small = $2,
         thumbnail_medium = $3,
         thumbnail_large = $4,
         updated_at = NOW()
     WHERE id = $5`,
    [
      relativePath(variants.thumbnail),
      relativePath(variants.small),
      relativePath(variants.medium),
      relativePath(variants.large),
      videoId
    ]
  );

  return {
    id: videoId,
    variants: {
      thumbnail: relativePath(variants.thumbnail),
      small: relativePath(variants.small),
      medium: relativePath(variants.medium),
      large: relativePath(variants.large)
    }
  };
}
