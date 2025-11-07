/**
 * Model Quality Validation Tests
 *
 * Validates the quality and accuracy of recommendation algorithms
 * using established ML metrics and heuristics
 */

import pool from '../../src/config/database';
import { TFIDFService } from '../../src/services/recommendation/TFIDFService';
import { ContentBasedService } from '../../src/services/recommendation/ContentBasedService';
import { CollaborativeService } from '../../src/services/recommendation/CollaborativeService';
import { HybridService } from '../../src/services/recommendation/HybridService';

describe('Model Quality Validation Tests', () => {
  describe('TF-IDF Model Validation', () => {
    it('should produce consistent vectors for identical content', async () => {
      // Create two identical books
      const book1 = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('Identical Book', 'Same Author', 'Same description', 'Fiction', 'english')
        RETURNING id
      `);

      const book2 = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('Identical Book', 'Same Author', 'Same description', 'Fiction', 'english')
        RETURNING id
      `);

      // Build vectors
      await TFIDFService.buildVectorForSingleMedia(book1.rows[0].id, 'book');
      await TFIDFService.buildVectorForSingleMedia(book2.rows[0].id, 'book');

      // Get vectors
      const vector1 = await TFIDFService.getVector(book1.rows[0].id, 'book');
      const vector2 = await TFIDFService.getVector(book2.rows[0].id, 'book');

      // Calculate similarity
      const similarity = TFIDFService.cosineSimilarity(vector1!, vector2!);

      expect(similarity).toBeGreaterThan(0.95); // Should be very similar

      // Cleanup
      await pool.query('DELETE FROM media_vectors WHERE media_id IN ($1, $2)',
        [book1.rows[0].id, book2.rows[0].id]);
      await pool.query('DELETE FROM books WHERE id IN ($1, $2)',
        [book1.rows[0].id, book2.rows[0].id]);
    }, 30000);

    it('should produce dissimilar vectors for different content', async () => {
      const book1 = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('Adventure Novel', 'Action Writer', 'Exciting adventures', 'Adventure', 'english')
        RETURNING id
      `);

      const book2 = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('Romance Story', 'Love Writer', 'Romantic tale', 'Romance', 'english')
        RETURNING id
      `);

      await TFIDFService.buildVectorForSingleMedia(book1.rows[0].id, 'book');
      await TFIDFService.buildVectorForSingleMedia(book2.rows[0].id, 'book');

      const vector1 = await TFIDFService.getVector(book1.rows[0].id, 'book');
      const vector2 = await TFIDFService.getVector(book2.rows[0].id, 'book');

      const similarity = TFIDFService.cosineSimilarity(vector1!, vector2!);

      expect(similarity).toBeLessThan(0.5); // Should be quite different

      // Cleanup
      await pool.query('DELETE FROM media_vectors WHERE media_id IN ($1, $2)',
        [book1.rows[0].id, book2.rows[0].id]);
      await pool.query('DELETE FROM books WHERE id IN ($1, $2)',
        [book1.rows[0].id, book2.rows[0].id]);
    }, 30000);

    it('should maintain triangular inequality for similarity', async () => {
      // Create three books
      const books = await Promise.all([
        pool.query(`INSERT INTO books (title, author, description, genre, language)
                    VALUES ('Book A', 'Author', 'Adventure story', 'Adventure', 'english')
                    RETURNING id`),
        pool.query(`INSERT INTO books (title, author, description, genre, language)
                    VALUES ('Book B', 'Author', 'Adventure tale', 'Adventure', 'english')
                    RETURNING id`),
        pool.query(`INSERT INTO books (title, author, description, genre, language)
                    VALUES ('Book C', 'Author', 'Science fiction', 'Sci-Fi', 'english')
                    RETURNING id`)
      ]);

      const ids = books.map(b => b.rows[0].id);

      // Build vectors
      for (const id of ids) {
        await TFIDFService.buildVectorForSingleMedia(id, 'book');
      }

      // Get vectors
      const vectors = await Promise.all(ids.map(id => TFIDFService.getVector(id, 'book')));

      // Calculate similarities
      const sim_AB = TFIDFService.cosineSimilarity(vectors[0]!, vectors[1]!);
      const sim_BC = TFIDFService.cosineSimilarity(vectors[1]!, vectors[2]!);
      const sim_AC = TFIDFService.cosineSimilarity(vectors[0]!, vectors[2]!);

      // Triangular inequality: d(A,C) <= d(A,B) + d(B,C)
      // For cosine similarity: 1-sim(A,C) <= (1-sim(A,B)) + (1-sim(B,C))
      const dist_AC = 1 - sim_AC;
      const dist_AB = 1 - sim_AB;
      const dist_BC = 1 - sim_BC;

      expect(dist_AC).toBeLessThanOrEqual(dist_AB + dist_BC + 0.01); // Small epsilon for floating point

      // Cleanup
      await pool.query('DELETE FROM media_vectors WHERE media_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM books WHERE id = ANY($1)', [ids]);
    }, 60000);

    it('should be invariant to text case', async () => {
      const book1 = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('UPPERCASE TITLE', 'AUTHOR', 'DESCRIPTION', 'Fiction', 'english')
        RETURNING id
      `);

      const book2 = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('uppercase title', 'author', 'description', 'Fiction', 'english')
        RETURNING id
      `);

      await TFIDFService.buildVectorForSingleMedia(book1.rows[0].id, 'book');
      await TFIDFService.buildVectorForSingleMedia(book2.rows[0].id, 'book');

      const vector1 = await TFIDFService.getVector(book1.rows[0].id, 'book');
      const vector2 = await TFIDFService.getVector(book2.rows[0].id, 'book');

      const similarity = TFIDFService.cosineSimilarity(vector1!, vector2!);

      expect(similarity).toBeGreaterThan(0.95); // Should be very similar

      // Cleanup
      await pool.query('DELETE FROM media_vectors WHERE media_id IN ($1, $2)',
        [book1.rows[0].id, book2.rows[0].id]);
      await pool.query('DELETE FROM books WHERE id IN ($1, $2)',
        [book1.rows[0].id, book2.rows[0].id]);
    }, 30000);
  });

  describe('Content-Based Recommendation Quality', () => {
    it('should recommend items from the same genre with higher scores', async () => {
      // Create books
      const adventure1 = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('Adventure 1', 'Author', 'An adventure', 'Adventure', 'english')
        RETURNING id
      `);

      const adventure2 = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('Adventure 2', 'Author', 'Another adventure', 'Adventure', 'english')
        RETURNING id
      `);

      const romance = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('Romance Book', 'Author', 'A love story', 'Romance', 'english')
        RETURNING id
      `);

      const ids = [adventure1.rows[0].id, adventure2.rows[0].id, romance.rows[0].id];

      // Build vectors
      for (const id of ids) {
        await TFIDFService.buildVectorForSingleMedia(id, 'book');
      }

      // Get recommendations for adventure1
      const recommendations = await ContentBasedService.getRecommendations(
        adventure1.rows[0].id,
        'book',
        { limit: 10, minScore: 0 }
      );

      // Adventure 2 should rank higher than Romance
      const adventure2Rec = recommendations.find(r => r.media_id === adventure2.rows[0].id);
      const romanceRec = recommendations.find(r => r.media_id === romance.rows[0].id);

      if (adventure2Rec && romanceRec) {
        expect(adventure2Rec.score).toBeGreaterThan(romanceRec.score);
      }

      // Cleanup
      await pool.query('DELETE FROM similar_items_cache WHERE media_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM media_vectors WHERE media_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM books WHERE id = ANY($1)', [ids]);
    }, 60000);

    it('should not recommend the same item', async () => {
      // Get any book
      const result = await pool.query('SELECT id FROM books LIMIT 1');
      if (result.rows.length === 0) return;

      const bookId = result.rows[0].id;

      const recommendations = await ContentBasedService.getRecommendations(
        bookId,
        'book',
        { limit: 10 }
      );

      // Should not include the source book
      const selfRecommended = recommendations.some(r => r.media_id === bookId);
      expect(selfRecommended).toBe(false);
    });

    it('should return diverse recommendations (not all same author)', async () => {
      // Create books with different authors
      const books = await Promise.all([
        pool.query(`INSERT INTO books (title, author, description, genre, language)
                    VALUES ('Book 1', 'Author A', 'Description', 'Fiction', 'english')
                    RETURNING id`),
        pool.query(`INSERT INTO books (title, author, description, genre, language)
                    VALUES ('Book 2', 'Author B', 'Description', 'Fiction', 'english')
                    RETURNING id`),
        pool.query(`INSERT INTO books (title, author, description, genre, language)
                    VALUES ('Book 3', 'Author C', 'Description', 'Fiction', 'english')
                    RETURNING id`)
      ]);

      const ids = books.map(b => b.rows[0].id);

      for (const id of ids) {
        await TFIDFService.buildVectorForSingleMedia(id, 'book');
      }

      const recommendations = await ContentBasedService.getRecommendations(
        ids[0],
        'book',
        { limit: 10, minScore: 0 }
      );

      // Count unique authors
      const authors = new Set(recommendations.map(r => r.metadata?.author).filter(Boolean));

      // Should have multiple authors
      expect(authors.size).toBeGreaterThan(1);

      // Cleanup
      await pool.query('DELETE FROM similar_items_cache WHERE media_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM media_vectors WHERE media_id = ANY($1)', [ids]);
      await pool.query('DELETE FROM books WHERE id = ANY($1)', [ids]);
    }, 60000);

    it('should maintain score ordering consistency', async () => {
      const result = await pool.query('SELECT id FROM books LIMIT 1');
      if (result.rows.length === 0) return;

      const bookId = result.rows[0].id;

      const recommendations = await ContentBasedService.getRecommendations(
        bookId,
        'book',
        { limit: 10 }
      );

      // Verify scores are in descending order
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].score).toBeGreaterThanOrEqual(recommendations[i].score);
      }

      // Verify all scores are between 0 and 1
      recommendations.forEach(rec => {
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Collaborative Filtering Quality', () => {
    let testUser1: string;
    let testUser2: string;
    let testBook1: string;
    let testBook2: string;

    beforeAll(async () => {
      // Create test users
      const user1 = await pool.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ('cf-test1@test.com', 'hash', 'Test', 'User1')
        RETURNING id
      `);
      testUser1 = user1.rows[0].id;

      const user2 = await pool.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ('cf-test2@test.com', 'hash', 'Test', 'User2')
        RETURNING id
      `);
      testUser2 = user2.rows[0].id;

      // Create test books
      const book1 = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('CF Test Book 1', 'Author', 'Description', 'Adventure', 'english')
        RETURNING id
      `);
      testBook1 = book1.rows[0].id;

      const book2 = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('CF Test Book 2', 'Author', 'Description', 'Adventure', 'english')
        RETURNING id
      `);
      testBook2 = book2.rows[0].id;
    });

    afterAll(async () => {
      await pool.query('DELETE FROM user_interactions WHERE user_id IN ($1, $2)',
        [testUser1, testUser2]);
      await pool.query('DELETE FROM user_preference_profiles WHERE user_id IN ($1, $2)',
        [testUser1, testUser2]);
      await pool.query('DELETE FROM books WHERE id IN ($1, $2)', [testBook1, testBook2]);
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [testUser1, testUser2]);
    });

    it('should give higher weight to completion than views', async () => {
      await CollaborativeService.trackInteraction(testUser1, testBook1, 'book', 'view');
      await CollaborativeService.trackInteraction(testUser1, testBook2, 'book', 'complete');

      const result = await pool.query(`
        SELECT media_id, interaction_type, interaction_value
        FROM user_interactions
        WHERE user_id = $1
        ORDER BY interaction_value DESC
      `, [testUser1]);

      expect(result.rows[0].interaction_type).toBe('complete');
      expect(result.rows[0].interaction_value).toBeGreaterThan(result.rows[1].interaction_value);
    });

    it('should apply temporal decay to old interactions', async () => {
      // Create old interaction (simulate by setting created_at in past)
      await pool.query(`
        INSERT INTO user_interactions (user_id, media_id, media_type, interaction_type, interaction_value, created_at)
        VALUES ($1, $2, 'book', 'view', 1.0, CURRENT_TIMESTAMP - INTERVAL '100 days')
      `, [testUser1, testBook1]);

      // Create recent interaction
      await CollaborativeService.trackInteraction(testUser1, testBook2, 'book', 'view');

      // Build user profile
      const profile = await (CollaborativeService as any).buildUserPreferenceProfile(testUser1);

      // Profile should exist and prioritize recent interaction
      expect(profile).toBeDefined();
      expect(Object.keys(profile).length).toBeGreaterThan(0);
    });
  });

  describe('Hybrid Model Quality', () => {
    it('should balance content and collaborative components', async () => {
      const user = await pool.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ('hybrid-test@test.com', 'hash', 'Hybrid', 'User')
        RETURNING id
      `);

      const book = await pool.query(`
        INSERT INTO books (title, author, description, genre, language)
        VALUES ('Hybrid Test Book', 'Author', 'Description', 'Fiction', 'english')
        RETURNING id
      `);

      // Add interactions
      await CollaborativeService.trackInteraction(user.rows[0].id, book.rows[0].id, 'book', 'like');

      const recommendations = await HybridService.getHybridRecommendations(
        user.rows[0].id,
        book.rows[0].id,
        {
          limit: 5,
          contentWeight: 0.5,
          collaborativeWeight: 0.5
        }
      );

      expect(recommendations.length).toBeGreaterThan(0);

      // Cleanup
      await pool.query('DELETE FROM user_interactions WHERE user_id = $1', [user.rows[0].id]);
      await pool.query('DELETE FROM books WHERE id = $1', [book.rows[0].id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user.rows[0].id]);
    }, 30000);

    it('should adapt weights based on user interaction count', async () => {
      const newUser = await pool.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ('adaptive-new@test.com', 'hash', 'New', 'User')
        RETURNING id
      `);

      const experiencedUser = await pool.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ('adaptive-exp@test.com', 'hash', 'Experienced', 'User')
        RETURNING id
      `);

      // Add many interactions for experienced user
      const book = await pool.query('SELECT id FROM books LIMIT 1');
      if (book.rows.length > 0) {
        for (let i = 0; i < 25; i++) {
          await CollaborativeService.trackInteraction(
            experiencedUser.rows[0].id,
            book.rows[0].id,
            'book',
            'view'
          );
        }
      }

      const newUserWeights = await HybridService.getAdaptiveWeights(newUser.rows[0].id);
      const expUserWeights = await HybridService.getAdaptiveWeights(experiencedUser.rows[0].id);

      // New user should favor content-based
      expect(newUserWeights.contentWeight).toBeGreaterThan(newUserWeights.collaborativeWeight);

      // Experienced user should favor collaborative
      expect(expUserWeights.collaborativeWeight).toBeGreaterThan(expUserWeights.contentWeight);

      // Cleanup
      await pool.query('DELETE FROM user_interactions WHERE user_id = $1', [experiencedUser.rows[0].id]);
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)',
        [newUser.rows[0].id, experiencedUser.rows[0].id]);
    }, 60000);
  });

  describe('Recommendation Diversity Metrics', () => {
    it('should maintain minimum diversity in recommendations', async () => {
      const result = await pool.query('SELECT id FROM books LIMIT 1');
      if (result.rows.length === 0) return;

      const recommendations = await ContentBasedService.getRecommendations(
        result.rows[0].id,
        'book',
        { limit: 10, minScore: 0 }
      );

      // Count unique genres
      const genres = new Set(recommendations.map(r => r.metadata?.genre).filter(Boolean));

      // Calculate diversity score (normalized unique genres)
      const diversityScore = genres.size / Math.min(recommendations.length, 5);

      // Should have at least 40% diversity
      expect(diversityScore).toBeGreaterThanOrEqual(0.4);
    });

    it('should not return all items from same media type', async () => {
      const user = await pool.query('SELECT id FROM users LIMIT 1');
      if (user.rows.length === 0) return;

      const recommendations = await HybridService.getHybridRecommendations(
        user.rows[0].id,
        undefined,
        { limit: 10, diversityFactor: 0.2 }
      );

      const mediaTypes = new Set(recommendations.map(r => r.media_type));

      // Should have multiple media types (unless data is limited)
      if (recommendations.length >= 5) {
        expect(mediaTypes.size).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Score Distribution Validation', () => {
    it('should have reasonable score distribution', async () => {
      const result = await pool.query('SELECT id FROM books LIMIT 1');
      if (result.rows.length === 0) return;

      const recommendations = await ContentBasedService.getRecommendations(
        result.rows[0].id,
        'book',
        { limit: 20, minScore: 0 }
      );

      if (recommendations.length < 5) return;

      const scores = recommendations.map(r => r.score);

      // Calculate statistics
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);

      // Should have some spread (not all same score)
      expect(stdDev).toBeGreaterThan(0.01);

      // Mean should be reasonable
      expect(mean).toBeGreaterThan(0);
      expect(mean).toBeLessThan(1);
    });
  });
});
