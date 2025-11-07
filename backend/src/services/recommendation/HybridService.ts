/**
 * Hybrid Recommendation Service
 *
 * Combines content-based and collaborative filtering with tunable weights
 * for optimal recommendation quality.
 *
 * Features:
 * - Weighted fusion of content and collaborative scores
 * - Adaptive weights based on user profile maturity
 * - Diversity enforcement
 * - Re-ranking based on user preferences
 * - Exploration/exploitation balance
 */

import { ContentBasedService } from './ContentBasedService';
import { CollaborativeService } from './CollaborativeService';

interface Recommendation {
  media_id: string;
  media_type: 'book' | 'audio' | 'video';
  title: string;
  score: number;
  reason?: string;
  metadata?: any;
}

interface HybridOptions {
  limit?: number;
  contentWeight?: number;
  collaborativeWeight?: number;
  diversityFactor?: number;
  explorationRate?: number;
  minScore?: number;
}

export class HybridService {
  /**
   * Get hybrid recommendations combining content-based and collaborative filtering
   */
  static async getHybridRecommendations(
    userId: string,
    mediaId?: string,
    options: HybridOptions = {}
  ): Promise<Recommendation[]> {
    const {
      limit = 10,
      contentWeight = 0.4,
      collaborativeWeight = 0.6,
      diversityFactor = 0.15,
      explorationRate = 0.1,
      minScore = 0.1
    } = options;

    console.log(`🔀 Generating hybrid recommendations for user ${userId}`);
    console.log(`⚖️ Weights: content=${contentWeight}, collaborative=${collaborativeWeight}`);

    try {
      // Determine strategy based on available inputs
      let contentRecommendations: Recommendation[] = [];
      let collaborativeRecommendations: Recommendation[] = [];

      // Get collaborative recommendations (always)
      if (collaborativeWeight > 0) {
        console.log('🤝 Fetching collaborative recommendations...');
        collaborativeRecommendations = await CollaborativeService.getPersonalizedRecommendations(
          userId,
          {
            limit: limit * 3,
            minScore: minScore * 0.8,
            excludeViewed: true,
            recencyWeight: 0.3
          }
        );
        console.log(`✅ Got ${collaborativeRecommendations.length} collaborative recommendations`);
      }

      // Get content-based recommendations (if media_id provided)
      if (mediaId && contentWeight > 0) {
        // Extract media type from recent interactions or parameter
        const mediaType = await this.getMediaType(mediaId);
        if (mediaType) {
          console.log(`📚 Fetching content-based recommendations for ${mediaType}:${mediaId}...`);
          contentRecommendations = await ContentBasedService.getRecommendations(
            mediaId,
            mediaType,
            {
              limit: limit * 3,
              minScore: minScore * 0.8,
              sameLanguageOnly: false,
              sameGenreBoost: 1.3,
              diversityFactor: 0.1
            }
          );
          console.log(`✅ Got ${contentRecommendations.length} content-based recommendations`);
        }
      }

      // Merge recommendations using weighted scores
      const mergedRecommendations = this.mergeRecommendations(
        contentRecommendations,
        collaborativeRecommendations,
        contentWeight,
        collaborativeWeight
      );

      // Apply diversity enforcement
      const diverseRecommendations = this.enforceDiversity(
        mergedRecommendations,
        diversityFactor
      );

      // Add exploration (random popular items)
      const finalRecommendations = await this.addExploration(
        userId,
        diverseRecommendations,
        explorationRate,
        limit
      );

      // Sort by score and limit
      finalRecommendations.sort((a, b) => b.score - a.score);
      const result = finalRecommendations.slice(0, limit);

      console.log(`✅ Generated ${result.length} hybrid recommendations`);
      return result;
    } catch (error) {
      console.error('❌ Error generating hybrid recommendations:', error);
      throw error;
    }
  }

  /**
   * Merge content-based and collaborative recommendations
   */
  private static mergeRecommendations(
    contentRecs: Recommendation[],
    collaborativeRecs: Recommendation[],
    contentWeight: number,
    collaborativeWeight: number
  ): Recommendation[] {
    const scoreMap = new Map<string, {
      rec: Recommendation;
      contentScore: number;
      collaborativeScore: number;
    }>();

    // Add content-based recommendations
    for (const rec of contentRecs) {
      const key = `${rec.media_type}:${rec.media_id}`;
      scoreMap.set(key, {
        rec,
        contentScore: rec.score,
        collaborativeScore: 0
      });
    }

    // Add/merge collaborative recommendations
    for (const rec of collaborativeRecs) {
      const key = `${rec.media_type}:${rec.media_id}`;

      if (scoreMap.has(key)) {
        const existing = scoreMap.get(key)!;
        existing.collaborativeScore = rec.score;
      } else {
        scoreMap.set(key, {
          rec,
          contentScore: 0,
          collaborativeScore: rec.score
        });
      }
    }

    // Calculate weighted scores
    const merged: Recommendation[] = [];

    for (const [key, data] of scoreMap.entries()) {
      const totalWeight = (data.contentScore > 0 ? contentWeight : 0) +
                          (data.collaborativeScore > 0 ? collaborativeWeight : 0);

      const normalizedWeight = totalWeight > 0 ? totalWeight : 1;

      const hybridScore = (
        data.contentScore * contentWeight +
        data.collaborativeScore * collaborativeWeight
      ) / normalizedWeight;

      // Build combined reason
      const reasons: string[] = [];
      if (data.contentScore > 0) {
        reasons.push('Similar content');
      }
      if (data.collaborativeScore > 0) {
        reasons.push('Users like you enjoyed this');
      }

      merged.push({
        ...data.rec,
        score: hybridScore,
        reason: reasons.join(' • ')
      });
    }

    return merged;
  }

  /**
   * Enforce diversity by penalizing too many items from same genre/author
   */
  private static enforceDiversity(
    recommendations: Recommendation[],
    diversityFactor: number
  ): Recommendation[] {
    if (diversityFactor === 0) {
      return recommendations;
    }

    const genreCount = new Map<string, number>();
    const authorCount = new Map<string, number>();
    const typeCount = new Map<string, number>();

    const diverseRecs = recommendations.map(rec => {
      const genre = rec.metadata?.genre || 'unknown';
      const author = rec.metadata?.author || 'unknown';
      const type = rec.media_type;

      // Count occurrences
      const genreOccurrences = genreCount.get(genre) || 0;
      const authorOccurrences = authorCount.get(author) || 0;
      const typeOccurrences = typeCount.get(type) || 0;

      // Apply diversity penalty
      let diversityPenalty = 1.0;

      // Penalize overrepresented genres
      if (genreOccurrences > 2) {
        diversityPenalty *= Math.pow(0.9, genreOccurrences - 2);
      }

      // Penalize overrepresented authors
      if (authorOccurrences > 1) {
        diversityPenalty *= Math.pow(0.85, authorOccurrences - 1);
      }

      // Penalize overrepresented media types
      if (typeOccurrences > 3) {
        diversityPenalty *= Math.pow(0.95, typeOccurrences - 3);
      }

      // Update counts
      genreCount.set(genre, genreOccurrences + 1);
      authorCount.set(author, authorOccurrences + 1);
      typeCount.set(type, typeOccurrences + 1);

      // Apply penalty
      const finalPenalty = 1 - (1 - diversityPenalty) * diversityFactor;

      return {
        ...rec,
        score: rec.score * finalPenalty
      };
    });

    return diverseRecs;
  }

  /**
   * Add exploration items (random popular items user hasn't seen)
   */
  private static async addExploration(
    userId: string,
    recommendations: Recommendation[],
    explorationRate: number,
    limit: number
  ): Promise<Recommendation[]> {
    if (explorationRate === 0) {
      return recommendations;
    }

    const explorationCount = Math.ceil(limit * explorationRate);

    if (explorationCount === 0) {
      return recommendations;
    }

    // Get popular items for exploration
    const popularItems = await CollaborativeService.getPersonalizedRecommendations(
      userId,
      {
        limit: explorationCount * 2,
        minScore: 0,
        excludeViewed: true
      }
    );

    // Filter out items already in recommendations
    const existingIds = new Set(
      recommendations.map(r => `${r.media_type}:${r.media_id}`)
    );

    const explorationItems = popularItems
      .filter(item => !existingIds.has(`${item.media_type}:${item.media_id}`))
      .slice(0, explorationCount)
      .map(item => ({
        ...item,
        score: item.score * 0.7, // Lower score for exploration items
        reason: 'Discover something new'
      }));

    return [...recommendations, ...explorationItems];
  }

  /**
   * Get adaptive weights based on user profile maturity
   */
  static async getAdaptiveWeights(userId: string): Promise<{
    contentWeight: number;
    collaborativeWeight: number;
  }> {
    // Get user interaction count
    const result = await CollaborativeService['getUserInteractionCount'](userId);
    const interactionCount = result || 0;

    // New users: favor content-based (cold start)
    // Experienced users: favor collaborative
    if (interactionCount < 5) {
      return { contentWeight: 0.7, collaborativeWeight: 0.3 };
    } else if (interactionCount < 20) {
      return { contentWeight: 0.5, collaborativeWeight: 0.5 };
    } else {
      return { contentWeight: 0.3, collaborativeWeight: 0.7 };
    }
  }

  /**
   * Get recommendations with automatic weight adaptation
   */
  static async getAdaptiveHybridRecommendations(
    userId: string,
    mediaId?: string,
    options: Omit<HybridOptions, 'contentWeight' | 'collaborativeWeight'> = {}
  ): Promise<Recommendation[]> {
    // Get adaptive weights
    const weights = await this.getAdaptiveWeights(userId);

    console.log(`🎯 Using adaptive weights for user ${userId}:`, weights);

    return await this.getHybridRecommendations(userId, mediaId, {
      ...options,
      ...weights
    });
  }

  /**
   * Get media type from database
   */
  private static async getMediaType(
    mediaId: string
  ): Promise<'book' | 'audio' | 'video' | null> {
    const pool = (await import('../../config/database')).default;

    // Check books
    let result = await pool.query('SELECT id FROM books WHERE id = $1', [mediaId]);
    if (result.rows.length > 0) return 'book';

    // Check audio books
    result = await pool.query('SELECT id FROM audio_books WHERE id = $1', [mediaId]);
    if (result.rows.length > 0) return 'audio';

    // Check videos
    result = await pool.query('SELECT id FROM videos WHERE id = $1', [mediaId]);
    if (result.rows.length > 0) return 'video';

    return null;
  }

  /**
   * Re-rank recommendations based on user-specific factors
   */
  static async reRankRecommendations(
    userId: string,
    recommendations: Recommendation[]
  ): Promise<Recommendation[]> {
    const pool = (await import('../../config/database')).default;

    // Get user preferences
    const userPrefs = await pool.query(`
      SELECT favorite_genres, favorite_languages
      FROM user_preference_profiles
      WHERE user_id = $1
    `, [userId]);

    if (userPrefs.rows.length === 0) {
      return recommendations;
    }

    const favoriteGenres = new Set(userPrefs.rows[0].favorite_genres || []);
    const favoriteLanguages = new Set(userPrefs.rows[0].favorite_languages || []);

    // Apply personalization boosts
    const reRanked = recommendations.map(rec => {
      let boost = 1.0;

      // Boost favorite genres
      if (rec.metadata?.genre && favoriteGenres.has(rec.metadata.genre)) {
        boost *= 1.15;
      }

      // Boost favorite languages
      if (rec.metadata?.language && favoriteLanguages.has(rec.metadata.language)) {
        boost *= 1.1;
      }

      return {
        ...rec,
        score: Math.min(rec.score * boost, 1.0)
      };
    });

    // Sort by new scores
    reRanked.sort((a, b) => b.score - a.score);

    return reRanked;
  }
}
