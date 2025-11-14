import pool from '../config/database';
import { imageProcessingService } from '../services/ImageProcessingService';
import path from 'path';
import fs from 'fs/promises';

/**
 * Migration script to regenerate all existing book, audio, and video images
 * with the new resize behavior (fit: 'inside' instead of 'cover')
 *
 * This fixes images that were generated with cropping to use the new
 * resize-to-fit behavior that shows the entire image.
 */

interface MediaRecord {
  id: string;
  title: string;
  cover_image_url?: string;
  thumbnail_url?: string;
}

async function regenerateImages() {
  console.log('🔄 Starting image regeneration process...\n');

  try {
    // 1. Regenerate book covers
    console.log('📚 Processing books...');
    const booksResult = await pool.query(
      'SELECT id, title, cover_image_url FROM books WHERE cover_image_url IS NOT NULL AND cover_image_url != \'\''
    );

    for (const book of booksResult.rows as MediaRecord[]) {
      await regenerateMediaImage(book, 'book', '3:4', book.cover_image_url!);
    }
    console.log(`✅ Regenerated ${booksResult.rows.length} book covers\n`);

    // 2. Regenerate audio book covers
    console.log('🎧 Processing audio books...');
    const audioBooksResult = await pool.query(
      'SELECT id, title, cover_image_url FROM audio_books WHERE cover_image_url IS NOT NULL AND cover_image_url != \'\''
    );

    for (const audioBook of audioBooksResult.rows as MediaRecord[]) {
      await regenerateMediaImage(audioBook, 'audio', '1:1', audioBook.cover_image_url!);
    }
    console.log(`✅ Regenerated ${audioBooksResult.rows.length} audio book covers\n`);

    // 3. Regenerate video thumbnails
    console.log('🎬 Processing videos...');
    const videosResult = await pool.query(
      'SELECT id, title, thumbnail_url FROM videos WHERE thumbnail_url IS NOT NULL AND thumbnail_url != \'\' AND thumbnail_url LIKE \'/public/%\''
    );

    for (const video of videosResult.rows as MediaRecord[]) {
      await regenerateMediaImage(video, 'video', '16:9', video.thumbnail_url!);
    }
    console.log(`✅ Regenerated ${videosResult.rows.length} video thumbnails\n`);

    console.log('🎉 Image regeneration complete!');

  } catch (error) {
    console.error('❌ Error regenerating images:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function regenerateMediaImage(
  media: MediaRecord,
  type: 'book' | 'audio' | 'video',
  aspectRatio: '1:1' | '3:4' | '16:9',
  imageUrl: string
) {
  try {
    // Convert URL to file path
    const imagePath = imageUrl.replace('/public/', '');
    const fullImagePath = path.join(process.cwd(), 'public', imagePath);

    // Check if original file exists
    try {
      await fs.access(fullImagePath);
    } catch {
      console.log(`⚠️  Skipping ${media.title} - Original file not found: ${fullImagePath}`);
      return;
    }

    console.log(`  Processing: ${media.title}`);

    // Delete old responsive images if they exist
    const originalName = path.basename(fullImagePath, path.extname(fullImagePath));
    const imageDir = path.dirname(fullImagePath);
    const ext = 'webp';

    const oldImages = [
      path.join(imageDir, `${originalName}-thumbnail.${ext}`),
      path.join(imageDir, `${originalName}-small.${ext}`),
      path.join(imageDir, `${originalName}-medium.${ext}`),
      path.join(imageDir, `${originalName}-large.${ext}`)
    ];

    for (const oldImage of oldImages) {
      try {
        await fs.unlink(oldImage);
      } catch {
        // File doesn't exist, ignore
      }
    }

    // Generate new responsive images with resize-to-fit behavior
    const processedImages = await imageProcessingService.processUploadedImage(
      fullImagePath,
      {
        aspectRatio,
        quality: 85,
        format: 'webp',
        outputDir: imageDir
      }
    );

    // Convert absolute paths to relative URLs for database storage
    const publicDir = path.join(process.cwd(), 'public');
    const coverThumbnail = imageProcessingService.convertToRelativePath(processedImages.thumbnail, publicDir);
    const coverSmall = imageProcessingService.convertToRelativePath(processedImages.small, publicDir);
    const coverMedium = imageProcessingService.convertToRelativePath(processedImages.medium, publicDir);
    const coverLarge = imageProcessingService.convertToRelativePath(processedImages.large, publicDir);

    // Update database with new responsive image paths
    if (type === 'book') {
      await pool.query(
        `UPDATE books SET
          cover_image_thumbnail = $1,
          cover_image_small = $2,
          cover_image_medium = $3,
          cover_image_large = $4
         WHERE id = $5`,
        [coverThumbnail, coverSmall, coverMedium, coverLarge, media.id]
      );
    } else if (type === 'audio') {
      await pool.query(
        `UPDATE audio_books SET
          cover_image_thumbnail = $1,
          cover_image_small = $2,
          cover_image_medium = $3,
          cover_image_large = $4
         WHERE id = $5`,
        [coverThumbnail, coverSmall, coverMedium, coverLarge, media.id]
      );
    } else if (type === 'video') {
      await pool.query(
        `UPDATE videos SET
          thumbnail_thumbnail = $1,
          thumbnail_small = $2,
          thumbnail_medium = $3,
          thumbnail_large = $4
         WHERE id = $5`,
        [coverThumbnail, coverSmall, coverMedium, coverLarge, media.id]
      );
    }

    console.log(`  ✅ Regenerated: ${media.title}`);

  } catch (error) {
    console.error(`  ❌ Error processing ${media.title}:`, error);
  }
}

// Run the script
regenerateImages();
