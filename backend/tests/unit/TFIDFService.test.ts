/**
 * Unit Tests for TF-IDF Service
 *
 * Tests text preprocessing, vectorization, normalization, and similarity calculations
 */

import { TFIDFService } from '../../src/services/recommendation/TFIDFService';
import pool from '../../src/config/database';

describe('TFIDFService - Unit Tests', () => {
  describe('Text Preprocessing', () => {
    it('should tokenize text correctly', () => {
      // Access private method via any cast for testing
      const service = TFIDFService as any;
      const text = 'The quick brown fox jumps over the lazy dog';
      const tokens = service.preprocessText(text);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
      // Should not contain stopwords
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('over');
    });

    it('should filter out stopwords', () => {
      const service = TFIDFService as any;
      const text = 'this is a test with many stopwords and the';
      const tokens = service.preprocessText(text);

      expect(tokens).not.toContain('this');
      expect(tokens).not.toContain('is');
      expect(tokens).not.toContain('a');
      expect(tokens).not.toContain('with');
      expect(tokens).not.toContain('and');
      expect(tokens).not.toContain('the');
    });

    it('should stem words correctly', () => {
      const service = TFIDFService as any;
      const text = 'running runner runs';
      const tokens = service.preprocessText(text);

      // All should stem to same root
      expect(new Set(tokens).size).toBe(1);
    });

    it('should handle empty text', () => {
      const service = TFIDFService as any;
      const tokens = service.preprocessText('');
      expect(tokens).toEqual([]);
    });

    it('should handle special characters', () => {
      const service = TFIDFService as any;
      const text = 'test@email.com #hashtag $price 123';
      const tokens = service.preprocessText(text);

      // Should filter out non-alphabetic tokens
      expect(tokens.every((t: string) => /^[a-z]+$/.test(t))).toBe(true);
    });

    it('should convert to lowercase', () => {
      const service = TFIDFService as any;
      const text = 'UPPERCASE lowercase MiXeD';
      const tokens = service.preprocessText(text);

      expect(tokens.every((t: string) => t === t.toLowerCase())).toBe(true);
    });
  });

  describe('Feature Text Extraction', () => {
    it('should extract and weight features correctly', () => {
      const service = TFIDFService as any;
      const media = {
        id: 'test-1',
        type: 'book' as const,
        title: 'Test Book',
        description: 'A great story',
        author: 'John Doe',
        genre: 'Fiction',
        tags: ['adventure', 'mystery']
      };

      const featureText = service.extractFeatureText(media);

      // Title should appear 3 times (weighted)
      const titleCount = (featureText.match(/Test Book/gi) || []).length;
      expect(titleCount).toBe(3);

      // Description should appear 2 times
      const descCount = (featureText.match(/A great story/gi) || []).length;
      expect(descCount).toBe(2);

      // Author should appear 2 times
      const authorCount = (featureText.match(/John Doe/gi) || []).length;
      expect(authorCount).toBe(2);

      // Tags should appear once each
      expect(featureText).toContain('adventure');
      expect(featureText).toContain('mystery');
    });

    it('should handle missing fields gracefully', () => {
      const service = TFIDFService as any;
      const media = {
        id: 'test-2',
        type: 'video' as const,
        title: 'Test Video'
        // Missing description, author, genre, tags
      };

      const featureText = service.extractFeatureText(media);
      expect(featureText).toBeTruthy();
      expect(featureText).toContain('Test Video');
    });
  });

  describe('Vector Normalization', () => {
    it('should normalize vector correctly', () => {
      const service = TFIDFService as any;
      const vector = {
        term1: 3,
        term2: 4
      };

      const { vector: normalized, magnitude } = service.normalizeVector(vector);

      // Magnitude should be 5 (sqrt(3^2 + 4^2))
      expect(magnitude).toBeCloseTo(5, 5);

      // Normalized vector components
      expect(normalized.term1).toBeCloseTo(0.6, 5);
      expect(normalized.term2).toBeCloseTo(0.8, 5);

      // Magnitude of normalized vector should be 1
      const mag = Math.sqrt(
        normalized.term1 ** 2 + normalized.term2 ** 2
      );
      expect(mag).toBeCloseTo(1, 5);
    });

    it('should handle zero vector', () => {
      const service = TFIDFService as any;
      const vector = {};

      const { vector: normalized, magnitude } = service.normalizeVector(vector);

      expect(magnitude).toBe(0);
      expect(Object.keys(normalized).length).toBe(0);
    });

    it('should handle single term vector', () => {
      const service = TFIDFService as any;
      const vector = { term1: 5 };

      const { vector: normalized, magnitude } = service.normalizeVector(vector);

      expect(magnitude).toBe(5);
      expect(normalized.term1).toBe(1);
    });
  });

  describe('Cosine Similarity', () => {
    it('should calculate similarity for identical vectors', () => {
      const vector1 = { term1: 1, term2: 1, term3: 1 };
      const vector2 = { term1: 1, term2: 1, term3: 1 };

      const similarity = TFIDFService.cosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should calculate similarity for orthogonal vectors', () => {
      const vector1 = { term1: 1, term2: 0 };
      const vector2 = { term1: 0, term2: 1 };

      const similarity = TFIDFService.cosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should calculate similarity for opposite vectors', () => {
      const vector1 = { term1: 1, term2: 0 };
      const vector2 = { term1: -1, term2: 0 };

      const similarity = TFIDFService.cosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should calculate similarity for partially overlapping vectors', () => {
      const vector1 = { term1: 1, term2: 1, term3: 0 };
      const vector2 = { term1: 1, term2: 0, term3: 1 };

      const similarity = TFIDFService.cosineSimilarity(vector1, vector2);

      // Expected: (1*1 + 1*0 + 0*1) / (sqrt(2) * sqrt(2)) = 1/2 = 0.5
      expect(similarity).toBeCloseTo(0.5, 5);
    });

    it('should handle empty vectors', () => {
      const vector1 = {};
      const vector2 = { term1: 1 };

      const similarity = TFIDFService.cosineSimilarity(vector1, vector2);

      expect(similarity).toBe(0);
    });

    it('should be symmetric', () => {
      const vector1 = { term1: 2, term2: 3, term3: 1 };
      const vector2 = { term1: 1, term2: 4, term3: 2 };

      const sim1 = TFIDFService.cosineSimilarity(vector1, vector2);
      const sim2 = TFIDFService.cosineSimilarity(vector2, vector1);

      expect(sim1).toBeCloseTo(sim2, 5);
    });

    it('should return value between -1 and 1', () => {
      const vector1 = { term1: 5, term2: -3, term3: 8 };
      const vector2 = { term1: 2, term2: 7, term3: -1 };

      const similarity = TFIDFService.cosineSimilarity(vector1, vector2);

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('TF-IDF Calculation', () => {
    it('should calculate TF-IDF for corpus', () => {
      const service = TFIDFService as any;
      const documents = [
        'the cat sat on the mat',
        'the dog sat on the log',
        'cats and dogs are enemies'
      ];

      const vectors = service.calculateTFIDF(documents);

      expect(vectors.length).toBe(3);
      expect(vectors[0]).toHaveProperty('cat');
      expect(vectors[1]).toHaveProperty('dog');
      expect(vectors[2]).toHaveProperty('cat');
      expect(vectors[2]).toHaveProperty('dog');
      expect(vectors[2]).toHaveProperty('enemi'); // stemmed
    });

    it('should give higher weight to rare terms', () => {
      const service = TFIDFService as any;
      const documents = [
        'common common common rare',
        'common common common',
        'common common common'
      ];

      const vectors = service.calculateTFIDF(documents);

      // 'rare' should have higher TF-IDF than 'common' in first doc
      if (vectors[0].rare && vectors[0].common) {
        expect(vectors[0].rare).toBeGreaterThan(vectors[0].common);
      }
    });

    it('should handle single document', () => {
      const service = TFIDFService as any;
      const documents = ['single document test'];

      const vectors = service.calculateTFIDF(documents);

      expect(vectors.length).toBe(1);
      expect(Object.keys(vectors[0]).length).toBeGreaterThan(0);
    });
  });

  describe('Database Integration', () => {
    let testMediaId: string;

    beforeAll(async () => {
      // Create test media
      const result = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('Test Book for TFIDF', 'Test Author', 'A test description', 'Fiction', 'english')
        RETURNING id
      `);
      testMediaId = result.rows[0].id;
    });

    afterAll(async () => {
      // Cleanup
      if (testMediaId) {
        await pool.query('DELETE FROM media_vectors WHERE media_id = $1', [testMediaId]);
        await pool.query('DELETE FROM books WHERE id = $1', [testMediaId]);
      }
    });

    it('should build vector for single media', async () => {
      await TFIDFService.buildVectorForSingleMedia(testMediaId, 'book');

      // Verify vector was stored
      const result = await pool.query(
        'SELECT * FROM media_vectors WHERE media_id = $1',
        [testMediaId]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].vector_data).toBeDefined();
      expect(result.rows[0].vector_magnitude).toBeGreaterThan(0);
    }, 30000);

    it('should retrieve vector from database', async () => {
      const vector = await TFIDFService.getVector(testMediaId, 'book');

      expect(vector).toBeDefined();
      expect(typeof vector).toBe('object');
      expect(Object.keys(vector!).length).toBeGreaterThan(0);
    });

    it('should return null for non-existent media', async () => {
      const vector = await TFIDFService.getVector('non-existent-id', 'book');

      expect(vector).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should preprocess large text efficiently', () => {
      const service = TFIDFService as any;
      const largeText = 'word '.repeat(10000); // 10k words

      const startTime = Date.now();
      const tokens = service.preprocessText(largeText);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // < 1 second
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should calculate similarity efficiently', () => {
      const largeVector: any = {};
      for (let i = 0; i < 1000; i++) {
        largeVector[`term${i}`] = Math.random();
      }

      const startTime = Date.now();
      const similarity = TFIDFService.cosineSimilarity(largeVector, largeVector);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // < 100ms
      expect(similarity).toBeCloseTo(1, 5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unicode characters', () => {
      const service = TFIDFService as any;
      const text = 'español français 中文 العربية';
      const tokens = service.preprocessText(text);

      // Should handle gracefully (may filter out non-latin)
      expect(Array.isArray(tokens)).toBe(true);
    });

    it('should handle very long words', () => {
      const service = TFIDFService as any;
      const longWord = 'a'.repeat(1000);
      const text = `normal word ${longWord} another`;
      const tokens = service.preprocessText(text);

      expect(Array.isArray(tokens)).toBe(true);
    });

    it('should handle numbers in text', () => {
      const service = TFIDFService as any;
      const text = 'test 123 456 test';
      const tokens = service.preprocessText(text);

      // Numbers should be filtered out
      expect(tokens.every((t: string) => !/\d/.test(t))).toBe(true);
    });

    it('should handle repeated words', () => {
      const service = TFIDFService as any;
      const text = 'test test test test test';
      const tokens = service.preprocessText(text);

      // Should still process correctly
      expect(tokens.every((t: string) => t === 'test')).toBe(true);
    });
  });
});
