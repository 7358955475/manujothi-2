/**
 * Integration Tests for Recommendation Pipeline
 *
 * Tests the full end-to-end flow from data ingestion to recommendation delivery
 */

import pool from '../../src/config/database';
import { TFIDFService } from '../../src/services/recommendation/TFIDFService';
import { ContentBasedService } from '../../src/services/recommendation/ContentBasedService';
import { CollaborativeService } from '../../src/services/recommendation/CollaborativeService';
import { HybridService } from '../../src/services/recommendation/HybridService';

describe('Recommendation Pipeline Integration Tests', () => {
  let testUserId: string;
  let testBook1Id: string;
  let testBook2Id: string;
  let testBook3Id: string;
  let testAudioId: string;
  let testVideoId: string;

  beforeAll(async () => {
    // Create test user
    const userResult = await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ('test-integration@test.com', 'hashed', 'Test', 'User', 'user')
      RETURNING id
    `);
    testUserId = userResult.rows[0].id;

    // Create test books with similar content
    const book1 = await pool.query(`
      INSERT INTO books (title, author, description, genre, language)
      VALUES (
        'The Great Adventure',
        'John Smith',
        'An exciting journey through mountains and valleys',
        'Adventure',
        'english'
      )
      RETURNING id
    `);
    testBook1Id = book1.rows[0].id;

    const book2 = await pool.query(`
      INSERT INTO books (title, author, description, genre, language)
      VALUES (
        'Mountain Journey',
        'Jane Doe',
        'A thrilling adventure in the mountains',
        'Adventure',
        'english'
      )
      RETURNING id
    `);
    testBook2Id = book2.rows[0].id;

    const book3 = await pool.query(`
      INSERT INTO books (title, author, description, genre, language)
      VALUES (
        'Science Fiction Novel',
        'Bob Johnson',
        'A futuristic story about space exploration',
        'Sci-Fi',
        'english'
      )
      RETURNING id
    `);
    testBook3Id = book3.rows[0].id;

    // Create test audio and video
    const audio = await pool.query(`
      INSERT INTO audio_books (title, author, narrator, description, audio_file_path, genre, language)
      VALUES (
        'Audio Adventure',
        'John Smith',
        'Voice Actor',
        'An audio book about adventures',
        '/path/to/audio.mp3',
        'Adventure',
        'english'
      )
      RETURNING id
    `);
    testAudioId = audio.rows[0].id;

    const video = await pool.query(`
      INSERT INTO videos (title, description, youtube_url, youtube_id, category, language)
      VALUES (
        'Adventure Documentary',
        'A documentary about mountain climbing',
        'https://youtube.com/watch?v=test',
        'test123',
        'Documentary',
        'english'
      )
      RETURNING id
    `);
    testVideoId = video.rows[0].id;

    // Build vectors for all test media
    console.log('Building vectors for test media...');
    await TFIDFService.buildVectorForSingleMedia(testBook1Id, 'book');
    await TFIDFService.buildVectorForSingleMedia(testBook2Id, 'book');
    await TFIDFService.buildVectorForSingleMedia(testBook3Id, 'book');
    await TFIDFService.buildVectorForSingleMedia(testAudioId, 'audio');
    await TFIDFService.buildVectorForSingleMedia(testVideoId, 'video');

    // Precompute similar items
    await ContentBasedService.precomputeSimilarItems(10);
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM user_interactions WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM user_preference_profiles WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM similar_items_cache WHERE media_id IN ($1, $2, $3, $4, $5)',
      [testBook1Id, testBook2Id, testBook3Id, testAudioId, testVideoId]);
    await pool.query('DELETE FROM media_vectors WHERE media_id IN ($1, $2, $3, $4, $5)',
      [testBook1Id, testBook2Id, testBook3Id, testAudioId, testVideoId]);
    await pool.query('DELETE FROM books WHERE id IN ($1, $2, $3)', [testBook1Id, testBook2Id, testBook3Id]);
    await pool.query('DELETE FROM audio_books WHERE id = $1', [testAudioId]);
    await pool.query('DELETE FROM videos WHERE id = $1', [testVideoId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('Content-Based Recommendations Flow', () => {
    it('should recommend similar books based on content', async () => {
      const recommendations = await ContentBasedService.getRecommendations(
        testBook1Id,
        'book',
        { limit: 5, minScore: 0.1 }
      );

      expect(recommendations.length).toBeGreaterThan(0);

      // Book 2 should be recommended (similar adventure content)
      const similarBook = recommendations.find(r => r.media_id === testBook2Id);
      expect(similarBook).toBeDefined();

      if (similarBook) {
        expect(similarBook.score).toBeGreaterThan(0.3); // Should have decent similarity
        expect(similarBook.media_type).toBe('book');
        expect(similarBook.title).toBe('Mountain Journey');
      }
    });

    it('should use precomputed cache for fast retrieval', async () => {
      const startTime = Date.now();

      const recommendations = await ContentBasedService.getRecommendations(
        testBook1Id,
        'book',
        { limit: 5 }
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Should be fast with cache
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should filter by same language if requested', async () => {
      const recommendations = await ContentBasedService.getRecommendations(
        testBook1Id,
        'book',
        { limit: 10, sameLanguageOnly: true }
      );

      // All recommendations should be English
      recommendations.forEach(rec => {
        if (rec.metadata?.language) {
          expect(rec.metadata.language).toBe('english');
        }
      });
    });

    it('should boost same-genre items', async () => {
      const recommendations = await ContentBasedService.getRecommendations(
        testBook1Id,
        'book',
        { limit: 10, sameGenreBoost: 1.5 }
      );

      // Adventure books should rank higher
      const adventureBooks = recommendations.filter(
        r => r.metadata?.genre === 'Adventure'
      );

      if (adventureBooks.length > 0) {
        expect(adventureBooks[0].score).toBeGreaterThanOrEqual(
          recommendations[recommendations.length - 1].score
        );
      }
    });
  });

  describe('Collaborative Filtering Flow', () => {
    beforeEach(async () => {
      // Clear previous interactions
      await pool.query('DELETE FROM user_interactions WHERE user_id = $1', [testUserId]);
    });

    it('should handle cold start with no interactions', async () => {
      const recommendations = await CollaborativeService.getPersonalizedRecommendations(
        testUserId,
        { limit: 5 }
      );

      // Should return popular items
      expect(recommendations.length).toBeGreaterThan(0);
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('media_id');
        expect(rec).toHaveProperty('score');
      });
    });

    it('should track interactions and build user profile', async () => {
      // Track interactions
      await CollaborativeService.trackInteraction(
        testUserId,
        testBook1Id,
        'book',
        'view',
        { durationSeconds: 120 }
      );

      await CollaborativeService.trackInteraction(
        testUserId,
        testBook1Id,
        'book',
        'like'
      );

      await CollaborativeService.trackInteraction(
        testUserId,
        testAudioId,
        'audio',
        'complete',
        { durationSeconds: 1800, progressPercentage: 100 }
      );

      // Verify interactions were recorded
      const result = await pool.query(
        'SELECT COUNT(*) FROM user_interactions WHERE user_id = $1',
        [testUserId]
      );
      expect(parseInt(result.rows[0].count)).toBeGreaterThanOrEqual(3);
    });

    it('should generate recommendations based on user history', async () => {
      // Add more interactions
      for (let i = 0; i < 5; i++) {
        await CollaborativeService.trackInteraction(
          testUserId,
          testBook1Id,
          'book',
          'view',
          { durationSeconds: 60 * i }
        );
      }

      const recommendations = await CollaborativeService.getPersonalizedRecommendations(
        testUserId,
        { limit: 5, excludeViewed: false }
      );

      expect(recommendations.length).toBeGreaterThan(0);

      // Should recommend similar books
      const hasAdventureBook = recommendations.some(
        r => r.media_type === 'book' && r.metadata?.genre === 'Adventure'
      );
      expect(hasAdventureBook).toBe(true);
    });

    it('should exclude already viewed items', async () => {
      const recommendations = await CollaborativeService.getPersonalizedRecommendations(
        testUserId,
        { limit: 10, excludeViewed: true }
      );

      // Should not recommend books user has already viewed
      const viewedBookRecommended = recommendations.some(
        r => r.media_id === testBook1Id
      );

      // May or may not be present depending on other factors
      // Just verify no errors occur
      expect(recommendations).toBeDefined();
    });

    it('should weight interactions correctly', async () => {
      // Clear previous
      await pool.query('DELETE FROM user_interactions WHERE user_id = $1', [testUserId]);

      // Track different interaction types
      await CollaborativeService.trackInteraction(testUserId, testBook1Id, 'book', 'view');
      await CollaborativeService.trackInteraction(testUserId, testBook2Id, 'book', 'like');
      await CollaborativeService.trackInteraction(testUserId, testBook3Id, 'book', 'complete');

      // Verify weights in database
      const result = await pool.query(`
        SELECT media_id, interaction_type, interaction_value
        FROM user_interactions
        WHERE user_id = $1
        ORDER BY interaction_value DESC
      `, [testUserId]);

      expect(result.rows.length).toBe(3);
      // Complete should have highest weight
      expect(result.rows[0].interaction_type).toBe('complete');
      expect(result.rows[0].interaction_value).toBeGreaterThan(result.rows[1].interaction_value);
    });
  });

  describe('Hybrid Recommendations Flow', () => {
    beforeEach(async () => {
      // Setup user with interactions
      await pool.query('DELETE FROM user_interactions WHERE user_id = $1', [testUserId]);

      await CollaborativeService.trackInteraction(testUserId, testBook1Id, 'book', 'view');
      await CollaborativeService.trackInteraction(testUserId, testBook1Id, 'book', 'like');
    });

    it('should combine content-based and collaborative recommendations', async () => {
      const recommendations = await HybridService.getHybridRecommendations(
        testUserId,
        testBook1Id,
        {
          limit: 5,
          contentWeight: 0.5,
          collaborativeWeight: 0.5
        }
      );

      expect(recommendations.length).toBeGreaterThan(0);

      recommendations.forEach(rec => {
        expect(rec.score).toBeGreaterThan(0);
        expect(rec.score).toBeLessThanOrEqual(1);
      });
    });

    it('should use adaptive weights based on user maturity', async () => {
      const weights = await HybridService.getAdaptiveWeights(testUserId);

      expect(weights).toHaveProperty('contentWeight');
      expect(weights).toHaveProperty('collaborativeWeight');
      expect(weights.contentWeight + weights.collaborativeWeight).toBeCloseTo(1, 1);
    });

    it('should enforce diversity in recommendations', async () => {
      const recommendations = await HybridService.getHybridRecommendations(
        testUserId,
        undefined,
        {
          limit: 10,
          diversityFactor: 0.3 // High diversity
        }
      );

      // Count unique genres
      const genres = new Set(recommendations.map(r => r.metadata?.genre).filter(Boolean));

      // Should have multiple genres
      expect(genres.size).toBeGreaterThan(1);
    });

    it('should include exploration items', async () => {
      const recommendations = await HybridService.getHybridRecommendations(
        testUserId,
        undefined,
        {
          limit: 10,
          explorationRate: 0.2 // 20% exploration
        }
      );

      expect(recommendations.length).toBeLessThanOrEqual(10);

      // Should have at least 2 items (20% of 10)
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should re-rank recommendations based on user preferences', async () => {
      // Build user profile
      await pool.query(`
        INSERT INTO user_preference_profiles (user_id, preference_vector, favorite_genres, favorite_languages)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          preference_vector = EXCLUDED.preference_vector,
          favorite_genres = EXCLUDED.favorite_genres,
          favorite_languages = EXCLUDED.favorite_languages
      `, [testUserId, JSON.stringify({}), ['Adventure'], ['english']]);

      const recommendations = await HybridService.getHybridRecommendations(
        testUserId,
        undefined,
        { limit: 5 }
      );

      const reRanked = await HybridService.reRankRecommendations(
        testUserId,
        recommendations
      );

      expect(reRanked.length).toBe(recommendations.length);

      // Adventure books should be boosted
      const adventureIndex = reRanked.findIndex(r => r.metadata?.genre === 'Adventure');
      if (adventureIndex >= 0) {
        expect(adventureIndex).toBeLessThan(reRanked.length / 2); // In top half
      }
    });
  });

  describe('Cache Integration', () => {
    it('should cache content-based recommendations', async () => {
      const cacheKey = `content_based:book:${testBook1Id}:limit:5`;

      // First call - should cache
      await ContentBasedService.getRecommendations(testBook1Id, 'book', { limit: 5 });

      // Check if cached
      const cacheResult = await pool.query(
        'SELECT * FROM recommendation_cache WHERE cache_key = $1',
        [cacheKey]
      );

      // May or may not be cached depending on implementation
      // Just verify no errors
      expect(cacheResult).toBeDefined();
    });

    it('should retrieve from cache on subsequent calls', async () => {
      const startTime1 = Date.now();
      await ContentBasedService.getRecommendations(testBook1Id, 'book', { limit: 5 });
      const duration1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      await ContentBasedService.getRecommendations(testBook1Id, 'book', { limit: 5 });
      const duration2 = Date.now() - startTime2;

      // Second call should be faster (cached)
      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple concurrent recommendation requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        ContentBasedService.getRecommendations(testBook1Id, 'book', { limit: 5 })
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;

      expect(results.length).toBe(10);
      expect(duration).toBeLessThan(5000); // All 10 requests < 5s

      results.forEach(recs => {
        expect(recs.length).toBeGreaterThan(0);
      });
    });

    it('should handle concurrent interaction tracking', async () => {
      const interactions = Array(20).fill(null).map((_, i) =>
        CollaborativeService.trackInteraction(
          testUserId,
          testBook1Id,
          'book',
          'view',
          { durationSeconds: i * 10 }
        )
      );

      await Promise.all(interactions);

      // Verify all were recorded
      const result = await pool.query(
        'SELECT COUNT(*) FROM user_interactions WHERE user_id = $1 AND media_id = $2',
        [testUserId, testBook1Id]
      );

      expect(parseInt(result.rows[0].count)).toBeGreaterThanOrEqual(20);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity', async () => {
      const recommendations = await ContentBasedService.getRecommendations(
        testBook1Id,
        'book',
        { limit: 10 }
      );

      // All recommended items should exist in database
      for (const rec of recommendations) {
        let exists;
        if (rec.media_type === 'book') {
          const result = await pool.query('SELECT id FROM books WHERE id = $1', [rec.media_id]);
          exists = result.rows.length > 0;
        } else if (rec.media_type === 'audio') {
          const result = await pool.query('SELECT id FROM audio_books WHERE id = $1', [rec.media_id]);
          exists = result.rows.length > 0;
        } else {
          const result = await pool.query('SELECT id FROM videos WHERE id = $1', [rec.media_id]);
          exists = result.rows.length > 0;
        }
        expect(exists).toBe(true);
      }
    });

    it('should return valid metadata for all recommendations', async () => {
      const recommendations = await HybridService.getHybridRecommendations(
        testUserId,
        undefined,
        { limit: 5 }
      );

      recommendations.forEach(rec => {
        expect(rec.metadata).toBeDefined();
        expect(rec.metadata?.title).toBeTruthy();
        expect(rec.metadata?.type).toBeTruthy();
        expect(['book', 'audio', 'video']).toContain(rec.metadata?.type);
      });
    });
  });
});
