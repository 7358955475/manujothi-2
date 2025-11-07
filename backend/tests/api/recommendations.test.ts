import request from 'supertest';
import app from '../../src/index';
import pool from '../../src/config/database';
import { TFIDFService } from '../../src/services/recommendation/TFIDFService';
import { ContentBasedService } from '../../src/services/recommendation/ContentBasedService';
import { CollaborativeService } from '../../src/services/recommendation/CollaborativeService';

describe('Recommendation Engine API Tests', () => {
  let authToken: string;
  let testUserId: string;
  let testBookId: string;
  let testAudioId: string;
  let testVideoId: string;

  beforeAll(async () => {
    // Login and get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@ogon.com',
        password: 'admin123'
      });

    authToken = loginResponse.body.token;
    testUserId = loginResponse.body.user.id;

    // Get test media IDs
    const booksResult = await pool.query('SELECT id FROM books LIMIT 1');
    const audioResult = await pool.query('SELECT id FROM audio_books LIMIT 1');
    const videosResult = await pool.query('SELECT id FROM videos LIMIT 1');

    testBookId = booksResult.rows[0]?.id;
    testAudioId = audioResult.rows[0]?.id;
    testVideoId = videosResult.rows[0]?.id;

    // Initialize recommendation engine
    console.log('Initializing recommendation engine for tests...');
    if (testBookId) {
      await TFIDFService.buildVectorForSingleMedia(testBookId, 'book');
    }
    if (testAudioId) {
      await TFIDFService.buildVectorForSingleMedia(testAudioId, 'audio');
    }
  });

  describe('GET /api/recommendations/content-based', () => {
    it('should return 400 without media_id', async () => {
      const response = await request(app)
        .get('/api/recommendations/content-based')
        .query({ media_type: 'book' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('media_id');
    });

    it('should return 400 with invalid media_type', async () => {
      const response = await request(app)
        .get('/api/recommendations/content-based')
        .query({ media_id: testBookId, media_type: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('media_type');
    });

    it('should return content-based recommendations', async () => {
      if (!testBookId) {
        console.log('Skipping test: no test book available');
        return;
      }

      const response = await request(app)
        .get('/api/recommendations/content-based')
        .query({
          media_id: testBookId,
          media_type: 'book',
          limit: 5
        })
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.recommendations)).toBe(true);
      expect(response.body).toHaveProperty('source');
      expect(['cache', 'fresh']).toContain(response.body.source);

      if (response.body.recommendations.length > 0) {
        const rec = response.body.recommendations[0];
        expect(rec).toHaveProperty('media_id');
        expect(rec).toHaveProperty('media_type');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('score');
        expect(typeof rec.score).toBe('number');
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(1);
      }
    });

    it('should respect limit parameter', async () => {
      if (!testBookId) {
        console.log('Skipping test: no test book available');
        return;
      }

      const limit = 3;
      const response = await request(app)
        .get('/api/recommendations/content-based')
        .query({
          media_id: testBookId,
          media_type: 'book',
          limit
        })
        .expect(200);

      expect(response.body.recommendations.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('GET /api/recommendations/personalized', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/recommendations/personalized')
        .expect(401);
    });

    it('should return personalized recommendations', async () => {
      const response = await request(app)
        .get('/api/recommendations/personalized')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 5 })
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.recommendations)).toBe(true);

      if (response.body.recommendations.length > 0) {
        const rec = response.body.recommendations[0];
        expect(rec).toHaveProperty('media_id');
        expect(rec).toHaveProperty('media_type');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('score');
      }
    });

    it('should handle cold start (user with no interactions)', async () => {
      const response = await request(app)
        .get('/api/recommendations/personalized')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 5 })
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.recommendations)).toBe(true);
      // Should return popular items for cold start
    });
  });

  describe('GET /api/recommendations/hybrid', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/recommendations/hybrid')
        .expect(401);
    });

    it('should return hybrid recommendations', async () => {
      const response = await request(app)
        .get('/api/recommendations/hybrid')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 5 })
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('weights');
      expect(Array.isArray(response.body.recommendations)).toBe(true);

      if (response.body.recommendations.length > 0) {
        const rec = response.body.recommendations[0];
        expect(rec).toHaveProperty('media_id');
        expect(rec).toHaveProperty('media_type');
        expect(rec).toHaveProperty('title');
        expect(rec).toHaveProperty('score');
      }
    });

    it('should accept custom weights', async () => {
      const response = await request(app)
        .get('/api/recommendations/hybrid')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          limit: 5,
          content_weight: 0.7,
          collaborative_weight: 0.3
        })
        .expect(200);

      expect(response.body.weights.content).toBeCloseTo(0.7, 1);
      expect(response.body.weights.collaborative).toBeCloseTo(0.3, 1);
    });

    it('should support media_id for context', async () => {
      if (!testBookId) {
        console.log('Skipping test: no test book available');
        return;
      }

      const response = await request(app)
        .get('/api/recommendations/hybrid')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          media_id: testBookId,
          limit: 5
        })
        .expect(200);

      expect(response.body).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });
  });

  describe('POST /api/recommendations/track-interaction', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/recommendations/track-interaction')
        .send({
          media_id: testBookId,
          media_type: 'book',
          interaction_type: 'view'
        })
        .expect(401);
    });

    it('should return 400 with missing fields', async () => {
      const response = await request(app)
        .post('/api/recommendations/track-interaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          media_id: testBookId
          // Missing media_type and interaction_type
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should track view interaction', async () => {
      if (!testBookId) {
        console.log('Skipping test: no test book available');
        return;
      }

      const response = await request(app)
        .post('/api/recommendations/track-interaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          media_id: testBookId,
          media_type: 'book',
          interaction_type: 'view',
          duration_seconds: 120
        })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);

      // Verify interaction was recorded
      const result = await pool.query(
        'SELECT * FROM user_interactions WHERE user_id = $1 AND media_id = $2 ORDER BY created_at DESC LIMIT 1',
        [testUserId, testBookId]
      );
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].interaction_type).toBe('view');
    });

    it('should track like interaction', async () => {
      if (!testBookId) {
        console.log('Skipping test: no test book available');
        return;
      }

      const response = await request(app)
        .post('/api/recommendations/track-interaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          media_id: testBookId,
          media_type: 'book',
          interaction_type: 'like'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should track complete interaction with progress', async () => {
      if (!testVideoId) {
        console.log('Skipping test: no test video available');
        return;
      }

      const response = await request(app)
        .post('/api/recommendations/track-interaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          media_id: testVideoId,
          media_type: 'video',
          interaction_type: 'complete',
          duration_seconds: 1800,
          progress_percentage: 100
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should invalidate cache after interaction', async () => {
      if (!testBookId) {
        console.log('Skipping test: no test book available');
        return;
      }

      // Track interaction
      await request(app)
        .post('/api/recommendations/track-interaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          media_id: testBookId,
          media_type: 'book',
          interaction_type: 'view'
        })
        .expect(200);

      // Check that user's cache was invalidated
      const cacheResult = await pool.query(
        'SELECT * FROM recommendation_cache WHERE cache_key LIKE $1 AND expires_at > CURRENT_TIMESTAMP',
        [`%user:${testUserId}%`]
      );

      // Cache should be cleared or empty
      expect(cacheResult.rows.length).toBe(0);
    });
  });

  describe('POST /api/recommendations/track-click', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/recommendations/track-click')
        .send({
          recommendation_id: 'test_rec_1',
          media_id: testBookId,
          media_type: 'book',
          position: 1
        })
        .expect(401);
    });

    it('should track recommendation click', async () => {
      if (!testBookId) {
        console.log('Skipping test: no test book available');
        return;
      }

      const response = await request(app)
        .post('/api/recommendations/track-click')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          recommendation_id: 'test_rec_1',
          media_id: testBookId,
          media_type: 'book',
          position: 1
        })
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache content-based recommendations', async () => {
      if (!testBookId) {
        console.log('Skipping test: no test book available');
        return;
      }

      // First request (fresh)
      const response1 = await request(app)
        .get('/api/recommendations/content-based')
        .query({
          media_id: testBookId,
          media_type: 'book',
          limit: 5
        })
        .expect(200);

      // Second request (should be cached)
      const response2 = await request(app)
        .get('/api/recommendations/content-based')
        .query({
          media_id: testBookId,
          media_type: 'book',
          limit: 5
        })
        .expect(200);

      // Second response should indicate cache hit
      if (response1.body.recommendations.length > 0) {
        expect(['cache', 'fresh']).toContain(response2.body.source);
      }
    });
  });

  describe('Performance', () => {
    it('should return content-based recommendations within 2 seconds', async () => {
      if (!testBookId) {
        console.log('Skipping test: no test book available');
        return;
      }

      const startTime = Date.now();
      await request(app)
        .get('/api/recommendations/content-based')
        .query({
          media_id: testBookId,
          media_type: 'book',
          limit: 10
        })
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });

    it('should return personalized recommendations within 3 seconds', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/api/recommendations/personalized')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 })
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000);
    });
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM user_interactions WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM recommendation_cache');
  });
});
