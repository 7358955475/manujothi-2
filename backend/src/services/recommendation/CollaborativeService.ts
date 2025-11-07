/**
 * Collaborative Filtering Service
 *
 * Implements user-based collaborative filtering for personalized recommendations.
 * Builds user preference profiles from interaction history and finds similar users.
 *
 * Features:
 * - User preference vector building from interactions
 * - Weighted interactions (view=1, like=2, share=3, complete=5)
 * - User-user similarity calculation
 * - Temporal decay for recent preferences
 * - Cold start handling for new users
 */

import pool from '../../config/database';
import { TFIDFService } from './TFIDFService';

interface UserInteraction {
  media_id: string;
  media_type: 'book' | 'audio' | 'video';
  interaction_type: 'view' | 'like' | 'share' | 'complete' | 'progress';
  interaction_value: number;
  duration_seconds: number;
  created_at: Date;
}

interface UserPreferenceVector {
  [term: string]: number;
}

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

type InteractionType = 'view' | 'like' | 'share' | 'progress' | 'complete';

export class CollaborativeService {
  // Interaction weights
  private static readonly INTERACTION_WEIGHTS: Record<InteractionType, number> = {
    view: 1.0,
    like: 2.0,
    share: 3.0,
    progress: 2.5,
    complete: 5.0
  };

  // Temporal decay factor (older interactions have less weight)
  private static readonly TEMPORAL_DECAY_DAYS = 90;

  /**
   * Get personalized recommendations for a user
   */
  static async getPersonalizedRecommendations(
    userId: string,
    options: {
      limit?: number;
      minScore?: number;
      excludeViewed?: boolean;
      recencyWeight?: number;
    } = {}
  ): Promise<Recommendation[]> {
    const {
      limit = 10,
      minScore = 0.1,
      excludeViewed = true,
      recencyWeight = 0.3
    } = options;

    console.log(`👤 Generating personalized recommendations for user ${userId}`);

    try {
      // Check if user has interactions
      const interactionCount = await this.getUserInteractionCount(userId);

      if (interactionCount === 0) {
        console.log('⚠️ User has no interactions, using cold start strategy');
        return await this.getColdStartRecommendations(userId, limit);
      }

      // Get or build user preference profile
      const userProfile = await this.getUserPreferenceProfile(userId);

      // Find similar users
      const similarUsers = await this.findSimilarUsers(userId, userProfile, 10);

      if (similarUsers.length === 0) {
        console.log('⚠️ No similar users found, falling back to popular items');
        return await this.getPopularItemsRecommendations(userId, limit);
      }

      // Get recommendations from similar users
      const recommendations = await this.getRecommendationsFromSimilarUsers(
        userId,
        similarUsers,
        {
          limit: limit * 2,
          excludeViewed,
          recencyWeight
        }
      );

      // Sort by score and limit
      recommendations.sort((a, b) => b.score - a.score);

      console.log(`✅ Generated ${recommendations.length} personalized recommendations`);
      return recommendations.slice(0, limit);
    } catch (error) {
      console.error('❌ Error getting personalized recommendations:', error);
      throw error;
    }
  }

  /**
   * Get user interaction count
   */
  private static async getUserInteractionCount(userId: string): Promise<number> {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM user_interactions WHERE user_id = $1',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Get or build user preference profile
   */
  private static async getUserPreferenceProfile(
    userId: string
  ): Promise<UserPreferenceVector> {
    // Check if profile exists and is recent
    const profileResult = await pool.query(`
      SELECT preference_vector, last_updated
      FROM user_preference_profiles
      WHERE user_id = $1
        AND last_updated > CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `, [userId]);

    if (profileResult.rows.length > 0) {
      console.log('✅ Using cached user profile');
      return profileResult.rows[0].preference_vector;
    }

    // Build new profile
    console.log('🔄 Building user preference profile...');
    return await this.buildUserPreferenceProfile(userId);
  }

  /**
   * Build user preference profile from interactions
   */
  private static async buildUserPreferenceProfile(
    userId: string
  ): Promise<UserPreferenceVector> {
    // Get user interactions (last 90 days)
    const interactionsResult = await pool.query(`
      SELECT
        media_id,
        media_type,
        interaction_type,
        interaction_value,
        duration_seconds,
        created_at
      FROM user_interactions
      WHERE user_id = $1
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '${this.TEMPORAL_DECAY_DAYS} days'
      ORDER BY created_at DESC
    `, [userId]);

    const interactions: UserInteraction[] = interactionsResult.rows;

    if (interactions.length === 0) {
      return {};
    }

    // Build aggregate vector from interacted items
    const aggregateVector: UserPreferenceVector = {};
    let totalWeight = 0;

    const now = new Date();

    for (const interaction of interactions) {
      // Get media vector
      const mediaVector = await TFIDFService.getVector(
        interaction.media_id,
        interaction.media_type
      );

      if (!mediaVector) continue;

      // Calculate interaction weight
      let weight = this.INTERACTION_WEIGHTS[interaction.interaction_type as InteractionType] || 1.0;

      // Apply explicit interaction value
      weight *= interaction.interaction_value;

      // Apply temporal decay
      const daysAgo = (now.getTime() - new Date(interaction.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.exp(-daysAgo / this.TEMPORAL_DECAY_DAYS);
      weight *= decayFactor;

      // Duration boost (longer engagement = higher weight)
      if (interaction.duration_seconds > 0) {
        const durationBoost = Math.min(interaction.duration_seconds / 3600, 2); // Cap at 2x
        weight *= (1 + durationBoost * 0.5);
      }

      // Aggregate vector
      for (const term in mediaVector) {
        aggregateVector[term] = (aggregateVector[term] || 0) + mediaVector[term] * weight;
      }

      totalWeight += weight;
    }

    // Normalize by total weight
    if (totalWeight > 0) {
      for (const term in aggregateVector) {
        aggregateVector[term] /= totalWeight;
      }
    }

    // Store profile
    await this.storeUserProfile(userId, aggregateVector, interactions);

    return aggregateVector;
  }

  /**
   * Store user preference profile
   */
  private static async storeUserProfile(
    userId: string,
    preferenceVector: UserPreferenceVector,
    interactions: UserInteraction[]
  ): Promise<void> {
    // Aggregate statistics
    const genres = new Set<string>();
    const languages = new Set<string>();
    let completionSum = 0;
    let completionCount = 0;

    for (const interaction of interactions) {
      // Fetch media details for stats
      const mediaDetails = await this.getMediaDetails(interaction.media_id, interaction.media_type);
      if (mediaDetails) {
        if (mediaDetails.genre) genres.add(mediaDetails.genre);
        if (mediaDetails.language) languages.add(mediaDetails.language);
      }

      if (interaction.interaction_type === 'complete') {
        completionSum += 100;
        completionCount++;
      }
    }

    const avgCompletionRate = completionCount > 0 ? completionSum / completionCount : 0;

    await pool.query(`
      INSERT INTO user_preference_profiles (
        user_id, preference_vector, favorite_genres, favorite_languages,
        interaction_count, avg_completion_rate, last_updated
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        preference_vector = EXCLUDED.preference_vector,
        favorite_genres = EXCLUDED.favorite_genres,
        favorite_languages = EXCLUDED.favorite_languages,
        interaction_count = EXCLUDED.interaction_count,
        avg_completion_rate = EXCLUDED.avg_completion_rate,
        last_updated = CURRENT_TIMESTAMP
    `, [
      userId,
      JSON.stringify(preferenceVector),
      Array.from(genres),
      Array.from(languages),
      interactions.length,
      avgCompletionRate
    ]);
  }

  /**
   * Find users similar to the target user
   */
  private static async findSimilarUsers(
    userId: string,
    userVector: UserPreferenceVector,
    limit: number = 10
  ): Promise<Array<{ userId: string; similarity: number }>> {
    // Get all other user profiles
    const result = await pool.query(`
      SELECT user_id, preference_vector
      FROM user_preference_profiles
      WHERE user_id != $1
        AND interaction_count >= 5
    `, [userId]);

    if (result.rows.length === 0) {
      return [];
    }

    // Calculate similarities
    const similarities = result.rows
      .map(row => ({
        userId: row.user_id,
        similarity: TFIDFService.cosineSimilarity(userVector, row.preference_vector)
      }))
      .filter(item => item.similarity > 0.1)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return similarities;
  }

  /**
   * Get recommendations from similar users
   */
  private static async getRecommendationsFromSimilarUsers(
    targetUserId: string,
    similarUsers: Array<{ userId: string; similarity: number }>,
    options: {
      limit: number;
      excludeViewed: boolean;
      recencyWeight: number;
    }
  ): Promise<Recommendation[]> {
    // Get items interacted by similar users
    const userIds = similarUsers.map(u => u.userId);
    const similarityMap = new Map(similarUsers.map(u => [u.userId, u.similarity]));

    // Get viewed items by target user (for exclusion)
    let viewedItems = new Set<string>();
    if (options.excludeViewed) {
      const viewedResult = await pool.query(
        `SELECT CONCAT(media_type, ':', media_id) as key FROM user_interactions WHERE user_id = $1`,
        [targetUserId]
      );
      viewedItems = new Set(viewedResult.rows.map(r => r.key));
    }

    // Get candidate items from similar users
    const candidatesResult = await pool.query(`
      SELECT
        ui.media_id,
        ui.media_type,
        ui.interaction_type,
        ui.interaction_value,
        ui.user_id,
        ui.created_at,
        COUNT(*) OVER (PARTITION BY ui.media_id, ui.media_type) as interaction_count
      FROM user_interactions ui
      WHERE ui.user_id = ANY($1)
        AND ui.created_at > CURRENT_TIMESTAMP - INTERVAL '90 days'
      ORDER BY ui.created_at DESC
    `, [userIds]);

    // Aggregate scores by media item
    const scoreMap = new Map<string, {
      mediaId: string;
      mediaType: string;
      score: number;
      interactions: number;
    }>();

    for (const row of candidatesResult.rows) {
      const key = `${row.media_type}:${row.media_id}`;

      // Skip if already viewed
      if (viewedItems.has(key)) continue;

      const userSimilarity = similarityMap.get(row.user_id) || 0;
      const interactionWeight = this.INTERACTION_WEIGHTS[row.interaction_type as InteractionType] || 1.0;

      // Temporal recency boost
      const daysAgo = (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.exp(-daysAgo / 30) * options.recencyWeight;

      const score = userSimilarity * interactionWeight * (1 + recencyBoost);

      if (scoreMap.has(key)) {
        const existing = scoreMap.get(key)!;
        existing.score += score;
        existing.interactions++;
      } else {
        scoreMap.set(key, {
          mediaId: row.media_id,
          mediaType: row.media_type,
          score,
          interactions: 1
        });
      }
    }

    // Convert to recommendations
    const recommendations: Recommendation[] = [];

    for (const [key, data] of scoreMap.entries()) {
      const details = await this.getMediaDetails(data.mediaId, data.mediaType as any);
      if (!details) continue;

      // Popularity boost (more interactions = higher confidence)
      const popularityBoost = Math.log(data.interactions + 1);
      const finalScore = data.score * (1 + popularityBoost * 0.1);

      recommendations.push({
        media_id: data.mediaId,
        media_type: data.mediaType as any,
        title: details.title,
        score: Math.min(finalScore, 1), // Cap at 1.0
        reason: `${data.interactions} similar users enjoyed this`,
        metadata: details
      });
    }

    return recommendations;
  }

  /**
   * Cold start recommendations for new users
   */
  private static async getColdStartRecommendations(
    userId: string,
    limit: number
  ): Promise<Recommendation[]> {
    console.log('🆕 Providing cold start recommendations...');

    // Get user preferences if available
    const userResult = await pool.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    // Return popular items from last 30 days
    return await this.getPopularItemsRecommendations(userId, limit);
  }

  /**
   * Get popular items recommendations
   */
  private static async getPopularItemsRecommendations(
    userId: string,
    limit: number
  ): Promise<Recommendation[]> {
    const result = await pool.query(`
      WITH popular_items AS (
        SELECT
          media_id,
          media_type,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(interaction_value) as avg_value,
          MAX(created_at) as last_interaction
        FROM user_interactions
        WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
        GROUP BY media_id, media_type
        HAVING COUNT(DISTINCT user_id) >= 3
        ORDER BY unique_users DESC, avg_value DESC
        LIMIT $1
      )
      SELECT
        pi.media_id,
        pi.media_type,
        pi.unique_users,
        pi.avg_value,
        CASE
          WHEN pi.media_type = 'book' THEN b.title
          WHEN pi.media_type = 'audio' THEN ab.title
          WHEN pi.media_type = 'video' THEN v.title
        END as title,
        CASE
          WHEN pi.media_type = 'book' THEN b.author
          WHEN pi.media_type = 'audio' THEN ab.author
        END as author,
        CASE
          WHEN pi.media_type = 'audio' THEN ab.narrator
        END as narrator,
        CASE
          WHEN pi.media_type = 'book' THEN b.description
          WHEN pi.media_type = 'audio' THEN ab.description
          WHEN pi.media_type = 'video' THEN v.description
        END as description,
        CASE
          WHEN pi.media_type = 'book' THEN b.cover_image_url
          WHEN pi.media_type = 'audio' THEN ab.cover_image_url
          WHEN pi.media_type = 'video' THEN v.thumbnail_url
        END as image_url,
        CASE
          WHEN pi.media_type = 'book' THEN b.genre
          WHEN pi.media_type = 'audio' THEN ab.genre
          WHEN pi.media_type = 'video' THEN v.category
        END as genre,
        CASE
          WHEN pi.media_type = 'book' THEN b.language::text
          WHEN pi.media_type = 'audio' THEN ab.language::text
          WHEN pi.media_type = 'video' THEN v.language::text
        END as language
      FROM popular_items pi
      LEFT JOIN books b ON pi.media_type = 'book' AND pi.media_id = b.id
      LEFT JOIN audio_books ab ON pi.media_type = 'audio' AND pi.media_id = ab.id
      LEFT JOIN videos v ON pi.media_type = 'video' AND pi.media_id = v.id
    `, [limit]);

    return result.rows.map(row => ({
      media_id: row.media_id,
      media_type: row.media_type,
      title: row.title,
      score: Math.min(row.unique_users / 10, 1), // Normalize score
      reason: `Popular with ${row.unique_users} users`,
      metadata: {
        id: row.media_id,
        type: row.media_type,
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
   * Track user interaction for future recommendations
   */
  static async trackInteraction(
    userId: string,
    mediaId: string,
    mediaType: 'book' | 'audio' | 'video',
    interactionType: 'view' | 'like' | 'share' | 'complete' | 'progress',
    options: {
      durationSeconds?: number;
      progressPercentage?: number;
      metadata?: any;
    } = {}
  ): Promise<void> {
    const interactionValue = this.INTERACTION_WEIGHTS[interactionType as InteractionType] || 1.0;

    await pool.query(`
      INSERT INTO user_interactions (
        user_id, media_id, media_type, interaction_type,
        interaction_value, duration_seconds, progress_percentage, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      userId,
      mediaId,
      mediaType,
      interactionType,
      interactionValue,
      options.durationSeconds || 0,
      options.progressPercentage || 0,
      options.metadata ? JSON.stringify(options.metadata) : null
    ]);

    console.log(`📊 Tracked ${interactionType} interaction: ${userId} -> ${mediaType}:${mediaId}`);
  }
}
