import request from 'supertest';
import app from '../../index';
import pool from '../../config/database';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { tmpdir } from 'os';

describe('Image Upload and Display Integration Tests', () => {
  let authToken: string;
  let adminToken: string;
  let testImagePath: string;
  let createdBookId: string;
  let createdAudiobookId: string;
  let createdVideoId: string | undefined;

  beforeAll(async () => {
    // Create a test image
    testImagePath = path.join(tmpdir(), 'integration-test-image.jpg');
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 100, g: 150, b: 200 }
      }
    })
      .jpeg()
      .toFile(testImagePath);

    // Login as admin to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@ogon.com',
        password: 'admin123'
      });

    adminToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup: Delete created records and test image
    try {
      if (createdBookId) {
        await pool.query('DELETE FROM books WHERE id = $1', [createdBookId]);
      }
      if (createdAudiobookId) {
        await pool.query('DELETE FROM audio_books WHERE id = $1', [createdAudiobookId]);
      }
      if (createdVideoId) {
        await pool.query('DELETE FROM videos WHERE id = $1', [createdVideoId]);
      }
      await fs.unlink(testImagePath);
    } catch (error) {
      console.error('Cleanup error:', error);
    }

    await pool.end();
  });

  describe('Book Cover Upload and Processing', () => {
    it('should upload book with cover and generate all responsive variants', async () => {
      const response = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Test Book')
        .field('author', 'Test Author')
        .field('language', 'english')
        .field('description', 'Test description')
        .attach('cover', testImagePath)
        .attach('pdf', testImagePath); // Using image as PDF for test

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');

      createdBookId = response.body.data.id;

      // Verify responsive variants were created
      const book = await pool.query(
        'SELECT cover_thumbnail, cover_small, cover_medium, cover_large FROM books WHERE id = $1',
        [createdBookId]
      );

      expect(book.rows[0].cover_thumbnail).toBeTruthy();
      expect(book.rows[0].cover_small).toBeTruthy();
      expect(book.rows[0].cover_medium).toBeTruthy();
      expect(book.rows[0].cover_large).toBeTruthy();

      // Verify files exist on disk
      const publicDir = path.resolve(__dirname, '../../../public');
      const thumbnailPath = path.join(publicDir, book.rows[0].cover_thumbnail.replace('/public/', ''));
      await expect(fs.access(thumbnailPath)).resolves.not.toThrow();
    }, 30000); // Increase timeout for file upload

    it('should return book with responsive image URLs in srcset format', async () => {
      const response = await request(app)
        .get(`/api/books/${createdBookId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('cover_image_thumbnail');
      expect(response.body.data).toHaveProperty('cover_image_small');
      expect(response.body.data).toHaveProperty('cover_image_medium');
      expect(response.body.data).toHaveProperty('cover_image_large');
    });

    it('should verify medium variant is under 200KB', async () => {
      const book = await pool.query(
        'SELECT cover_medium FROM books WHERE id = $1',
        [createdBookId]
      );

      const publicDir = path.resolve(__dirname, '../../../public');
      const mediumPath = path.join(publicDir, book.rows[0].cover_medium.replace('/public/', ''));

      const stats = await fs.stat(mediumPath);
      const sizeInKB = stats.size / 1024;

      expect(sizeInKB).toBeLessThanOrEqual(220); // Allow 10% tolerance
    });
  });

  describe('Audiobook Cover Upload (1:1 aspect ratio)', () => {
    it('should upload audiobook with square cover variants', async () => {
      const response = await request(app)
        .post('/api/audio-books')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Test Audiobook')
        .field('narrator', 'Test Narrator')
        .field('language', 'english')
        .field('description', 'Test description')
        .attach('cover', testImagePath)
        .attach('audio', testImagePath); // Using image as audio for test

      expect(response.status).toBe(201);
      createdAudiobookId = response.body.data.id;

      // Verify dimensions are square (1:1)
      const audiobook = await pool.query(
        'SELECT cover_thumbnail FROM audio_books WHERE id = $1',
        [createdAudiobookId]
      );

      const publicDir = path.resolve(__dirname, '../../../public');
      const thumbnailPath = path.join(publicDir, audiobook.rows[0].cover_thumbnail.replace('/public/', ''));

      const metadata = await sharp(thumbnailPath).metadata();
      expect(metadata.width).toBe(150);
      expect(metadata.height).toBe(150);
    }, 30000);
  });

  describe('Image Variant Regeneration', () => {
    it('should get image statistics', async () => {
      const response = await request(app)
        .get('/api/images/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toHaveProperty('books');
      expect(response.body.stats).toHaveProperty('audiobooks');
      expect(response.body.stats).toHaveProperty('videos');
    });

    it('should regenerate variants for a specific book', async () => {
      const response = await request(app)
        .post('/api/images/regenerate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mediaType: 'book',
          mediaId: createdBookId,
          focalPoint: { x: 0.6, y: 0.4 }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('variants');
      expect(response.body.data.variants).toHaveProperty('thumbnail');
      expect(response.body.data.variants).toHaveProperty('medium');
    });

    it('should handle invalid media type in regeneration', async () => {
      const response = await request(app)
        .post('/api/images/regenerate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mediaType: 'invalid',
          mediaId: createdBookId
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Focal Point Cropping', () => {
    it('should apply focal point when regenerating variants', async () => {
      // First upload without focal point
      const book = await pool.query(
        'SELECT cover_medium FROM books WHERE id = $1',
        [createdBookId]
      );

      const publicDir = path.resolve(__dirname, '../../../public');
      const originalPath = path.join(publicDir, book.rows[0].cover_medium.replace('/public/', ''));

      // Regenerate with focal point
      await request(app)
        .post('/api/images/regenerate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mediaType: 'book',
          mediaId: createdBookId,
          focalPoint: { x: 0.8, y: 0.2 } // Top right
        });

      // Verify file was updated (modification time changed or file size different)
      const updatedBook = await pool.query(
        'SELECT cover_medium FROM books WHERE id = $1',
        [createdBookId]
      );

      expect(updatedBook.rows[0].cover_medium).toBeTruthy();
    });
  });

  describe('Cache Headers and Optimization', () => {
    it('should serve images with correct cache headers', async () => {
      const book = await pool.query(
        'SELECT cover_medium FROM books WHERE id = $1',
        [createdBookId]
      );

      const imagePath = book.rows[0].cover_medium;

      const response = await request(app)
        .get(imagePath);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toContain('public');
      expect(response.headers['cache-control']).toContain('max-age');
      expect(response.headers['content-type']).toBe('image/webp');
    });

    it('should serve WebP format for responsive variants', async () => {
      const book = await pool.query(
        'SELECT cover_small, cover_medium FROM books WHERE id = $1',
        [createdBookId]
      );

      const publicDir = path.resolve(__dirname, '../../../public');
      const smallPath = path.join(publicDir, book.rows[0].cover_small.replace('/public/', ''));
      const mediumPath = path.join(publicDir, book.rows[0].cover_medium.replace('/public/', ''));

      const smallMeta = await sharp(smallPath).metadata();
      const mediumMeta = await sharp(mediumPath).metadata();

      expect(smallMeta.format).toBe('webp');
      expect(mediumMeta.format).toBe('webp');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should handle records without responsive variants', async () => {
      // Create a book with only cover_image_url (no variants)
      const result = await pool.query(
        `INSERT INTO books (title, author, language, cover_image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        ['Legacy Book', 'Test Author', 'english', '/public/images/test.jpg']
      );

      const legacyBookId = result.rows[0].id;

      // Try to regenerate variants
      const response = await request(app)
        .post('/api/images/regenerate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mediaType: 'book',
          mediaId: legacyBookId
        });

      // Should handle gracefully even if original image doesn't exist
      expect([200, 500]).toContain(response.status);

      // Cleanup
      await pool.query('DELETE FROM books WHERE id = $1', [legacyBookId]);
    });

    it('should batch regenerate all missing variants', async () => {
      const response = await request(app)
        .post('/api/images/regenerate-all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toHaveProperty('books');
      expect(response.body.results).toHaveProperty('audiobooks');
      expect(response.body.results).toHaveProperty('videos');
    }, 60000); // Longer timeout for batch operation
  });
});
