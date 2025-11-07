/**
 * Content-Based Recommendation Service
 *
 * Implements content-based filtering using TF-IDF vectors and cosine similarity.
 * Recommends items similar to a given item based on metadata features.
 *
 * Features:
 * - Precomputed similar items cache for fast retrieval
 * - Language and genre filtering
 * - Configurable similarity threshold
 * - Diversity boosting to avoid filter bubbles
 */

import pool from '../../config/database';
import { TFIDFService } from './TFIDFService';

interface MediaDetails {
  id: string;
  type: 'book' | 'audio' | 'video';
  title: string;
  author?: string;
  narrator?: string;
  description?: string;
  cover_image_url?: string;
  thumbnail_url?: string;
  genre?: string;
  category?: string;
  language?: string;
}

interface Recommendation {
  media_id: string;
  media_type: 'book' | 'audio' | 'video';
  title: string;
  score: number;
  reason?: string;
  metadata?: MediaDetails;
}

export class ContentBasedService {
  /**
   * Get content-based recommendations for a given media item
   */
  static async getRecommendations(
    mediaId: string,
    mediaType: 'book' | 'audio' | 'video',
    options: {
      limit?: number;
      minScore?: number;
      sameLanguageOnly?: boolean;
      sameGenreBoost?: number;
      diversityFactor?: number;
    } = {}
  ): Promise<Recommendation[]> {
    const {
      limit = 10,
      minScore = 0.1,
      sameLanguageOnly = false,
      sameGenreBoost = 1.2,
      diversityFactor = 0.1
    } = options;

    console.log(`🔍 Finding content-based recommendations for ${mediaType}:${mediaId}`);

    try {
      // First, try to get from precomputed cache
      const cachedRecommendations = await this.getCachedSimilarItems(mediaId, mediaType, limit);

      if (cachedRecommendations.length > 0) {
        console.log(`✅ Found ${cachedRecommendations.length} cached recommendations`);
        return cachedRecommendations;
      }

      // If no cache, compute on-the-fly
      console.log('⚡ Computing recommendations on-the-fly...');
      return await this.computeRecommendations(mediaId, mediaType, {
        limit,
        minScore,
        sameLanguageOnly,
        sameGenreBoost,
        diversityFactor
      });
    } catch (error) {
      console.error('❌ Error getting content-based recommendations:', error);
      throw error;
    }
  }

  /**
   * Get precomputed similar items from cache
   */
  private static async getCachedSimilarItems(
    mediaId: string,
    mediaType: string,
    limit: number
  ): Promise<Recommendation[]> {
    const result = await pool.query(`
      SELECT
        sic.similar_media_id,
        sic.similar_media_type,
        sic.similarity_score,
        CASE
          WHEN sic.similar_media_type = 'book' THEN b.title
          WHEN sic.similar_media_type = 'audio' THEN ab.title
          WHEN sic.similar_media_type = 'video' THEN v.title
        END as title,
        CASE
          WHEN sic.similar_media_type = 'book' THEN b.author
          WHEN sic.similar_media_type = 'audio' THEN ab.author
        END as author,
        CASE
          WHEN sic.similar_media_type = 'audio' THEN ab.narrator
        END as narrator,
        CASE
          WHEN sic.similar_media_type = 'book' THEN b.description
          WHEN sic.similar_media_type = 'audio' THEN ab.description
          WHEN sic.similar_media_type = 'video' THEN v.description
        END as description,
        CASE
          WHEN sic.similar_media_type = 'book' THEN b.cover_image_url
          WHEN sic.similar_media_type = 'audio' THEN ab.cover_image_url
          WHEN sic.similar_media_type = 'video' THEN v.thumbnail_url
        END as image_url,
        CASE
          WHEN sic.similar_media_type = 'book' THEN b.genre
          WHEN sic.similar_media_type = 'audio' THEN ab.genre
          WHEN sic.similar_media_type = 'video' THEN v.category
        END as genre,
        CASE
          WHEN sic.similar_media_type = 'book' THEN b.language::text
          WHEN sic.similar_media_type = 'audio' THEN ab.language::text
          WHEN sic.similar_media_type = 'video' THEN v.language::text
        END as language
      FROM similar_items_cache sic
      LEFT JOIN books b ON sic.similar_media_type = 'book' AND sic.similar_media_id = b.id
      LEFT JOIN audio_books ab ON sic.similar_media_type = 'audio' AND sic.similar_media_id = ab.id
      LEFT JOIN videos v ON sic.similar_media_type = 'video' AND sic.similar_media_id = v.id
      WHERE sic.media_type = $1
        AND sic.media_id = $2
        AND sic.ranking <= $3
      ORDER BY sic.ranking ASC
    `, [mediaType, mediaId, limit]);

    return result.rows.map(row => ({
      media_id: row.similar_media_id,
      media_type: row.similar_media_type,
      title: row.title,
      score: Number(row.similarity_score),
      reason: `Similar to items you liked`,
      metadata: {
        id: row.similar_media_id,
        type: row.similar_media_type,
        title: row.title,
        author: row.author,
        narrator: row.narrator,
        description: row.description,
        cover_image_url: row.image_url,
        thumbnail_url: row.image_url,
        genre: row.genre,
        language: row.language
      }
    }));
  }

  /**
   * Compute recommendations on-the-fly
   */
  private static async computeRecommendations(
    mediaId: string,
    mediaType: 'book' | 'audio' | 'video',
    options: {
      limit: number;
      minScore: number;
      sameLanguageOnly: boolean;
      sameGenreBoost: number;
      diversityFactor: number;
    }
  ): Promise<Recommendation[]> {
    // Get source media details
    const sourceMedia = await this.getMediaDetails(mediaId, mediaType);
    if (!sourceMedia) {
      throw new Error(`Media not found: ${mediaType}:${mediaId}`);
    }

    // Get similar items using TF-IDF
    const similarItems = await TFIDFService.findSimilarItems(
      mediaId,
      mediaType,
      options.limit * 3, // Get more candidates for filtering
      options.minScore
    );

    // Fetch details for all similar items
    const recommendations: Recommendation[] = [];

    for (const item of similarItems) {
      const details = await this.getMediaDetails(item.mediaId, item.mediaType as any);
      if (!details) continue;

      // Apply filters
      if (options.sameLanguageOnly && details.language !== sourceMedia.language) {
        continue;
      }

      // Calculate boosted score
      let score = item.similarity;

      // Boost same genre
      if (details.genre === sourceMedia.genre) {
        score *= options.sameGenreBoost;
      }

      // Apply diversity penalty (reduce score for too similar items)
      if (score > 0.9) {
        score *= (1 - options.diversityFactor);
      }

      recommendations.push({
        media_id: item.mediaId,
        media_type: item.mediaType as any,
        title: details.title,
        score: Math.min(score, 1), // Cap at 1.0
        reason: this.generateReason(sourceMedia, details, score),
        metadata: details
      });
    }

    // Sort by score and limit
    recommendations.sort((a, b) => b.score - a.score);
    return recommendations.slice(0, options.limit);
  }

  /**
   * Get media details
   */
  private static async getMediaDetails(
    mediaId: string,
    mediaType: 'book' | 'audio' | 'video'
  ): Promise<MediaDetails | null> {
    let result;

    if (mediaType === 'book') {
      result = await pool.query(
        `SELECT id, title, author, description, cover_image_url, genre, language::text
         FROM books WHERE id = $1 AND is_active = true`,
        [mediaId]
      );
    } else if (mediaType === 'audio') {
      result = await pool.query(
        `SELECT id, title, author, narrator, description, cover_image_url, genre, language::text
         FROM audio_books WHERE id = $1 AND is_active = true`,
        [mediaId]
      );
    } else {
      result = await pool.query(
        `SELECT id, title, description, thumbnail_url, category as genre, language::text
         FROM videos WHERE id = $1 AND is_active = true`,
        [mediaId]
      );
    }

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      type: mediaType,
      title: row.title,
      author: row.author,
      narrator: row.narrator,
      description: row.description,
      cover_image_url: row.cover_image_url || row.thumbnail_url,
      thumbnail_url: row.thumbnail_url || row.cover_image_url,
      genre: row.genre,
      language: row.language
    };
  }

  /**
   * Generate human-readable reason for recommendation
   */
  private static generateReason(
    sourceMedia: MediaDetails,
    targetMedia: MediaDetails,
    score: number
  ): string {
    const reasons: string[] = [];

    if (targetMedia.genre === sourceMedia.genre) {
      reasons.push(`Same genre: ${targetMedia.genre}`);
    }

    if (targetMedia.author && sourceMedia.author && targetMedia.author === sourceMedia.author) {
      reasons.push(`Same author: ${targetMedia.author}`);
    }

    if (targetMedia.language === sourceMedia.language) {
      reasons.push(`Same language`);
    }

    if (score > 0.7) {
      reasons.push('Highly similar content');
    } else if (score > 0.5) {
      reasons.push('Similar content');
    }

    return reasons.length > 0 ? reasons.join(' • ') : 'Recommended for you';
  }

  /**
   * Precompute and cache similar items for all media
   * This should be run periodically (e.g., after TF-IDF reindexing)
   */
  static async precomputeSimilarItems(
    topN: number = 20
  ): Promise<{ processed: number; errors: number }> {
    console.log('🔄 Precomputing similar items for all media...');

    try {
      // Clear existing cache
      await pool.query('DELETE FROM similar_items_cache');

      // Get all media with vectors
      const result = await pool.query(`
        SELECT media_id, media_type
        FROM media_vectors
        ORDER BY last_updated DESC
      `);

      const allMedia = result.rows;
      console.log(`📚 Processing ${allMedia.length} media items`);

      let processed = 0;
      let errors = 0;

      for (const media of allMedia) {
        try {
          // Find similar items
          const similarItems = await TFIDFService.findSimilarItems(
            media.media_id,
            media.media_type,
            topN,
            0.05 // Lower threshold for cache
          );

          // Store in cache
          for (let i = 0; i < similarItems.length; i++) {
            const item = similarItems[i];
            await pool.query(`
              INSERT INTO similar_items_cache (
                media_type, media_id, similar_media_type, similar_media_id,
                similarity_score, ranking, algorithm, last_computed
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
              ON CONFLICT (media_type, media_id, similar_media_type, similar_media_id)
              DO UPDATE SET
                similarity_score = EXCLUDED.similarity_score,
                ranking = EXCLUDED.ranking,
                last_computed = CURRENT_TIMESTAMP
            `, [
              media.media_type,
              media.media_id,
              item.mediaType,
              item.mediaId,
              item.similarity,
              i + 1,
              'cosine_tfidf'
            ]);
          }

          processed++;

          if (processed % 10 === 0) {
            console.log(`✅ Processed ${processed}/${allMedia.length} items`);
          }
        } catch (error) {
          console.error(`❌ Error processing ${media.media_type}:${media.media_id}:`, error);
          errors++;
        }
      }

      console.log(`✅ Precomputation complete: ${processed} processed, ${errors} errors`);
      return { processed, errors };
    } catch (error) {
      console.error('❌ Error in precomputeSimilarItems:', error);
      throw error;
    }
  }
}
