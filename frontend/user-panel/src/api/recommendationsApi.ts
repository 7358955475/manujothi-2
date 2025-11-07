/**
 * Recommendations API Client
 *
 * Provides typed methods for interacting with the recommendation engine endpoints.
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface MediaMetadata {
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

export interface Recommendation {
  media_id: string;
  media_type: 'book' | 'audio' | 'video';
  title: string;
  score: number;
  reason?: string;
  metadata?: MediaMetadata;
}

export interface RecommendationResponse {
  recommendations: Recommendation[];
  source: 'cache' | 'fresh';
  timestamp: string;
  weights?: {
    content: number;
    collaborative: number;
  };
}

export interface InteractionRequest {
  media_id: string;
  media_type: 'book' | 'audio' | 'video';
  interaction_type: 'view' | 'like' | 'share' | 'complete' | 'progress';
  duration_seconds?: number;
  progress_percentage?: number;
  metadata?: any;
}

export interface ClickTrackingRequest {
  recommendation_id: string;
  media_id: string;
  media_type: 'book' | 'audio' | 'video';
  position: number;
}

class RecommendationsAPI {
  private token: string | null = null;

  /**
   * Set authentication token
   */
  setToken(token: string) {
    this.token = token;
  }

  /**
   * Get authorization header
   */
  private getAuthHeader() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  /**
   * Get content-based recommendations
   * Recommends items similar to the specified media item
   */
  async getContentBasedRecommendations(
    mediaId: string,
    mediaType: 'book' | 'audio' | 'video',
    options: {
      limit?: number;
      minScore?: number;
    } = {}
  ): Promise<RecommendationResponse> {
    const params = new URLSearchParams({
      media_id: mediaId,
      media_type: mediaType,
      limit: (options.limit || 10).toString(),
      min_score: (options.minScore || 0.1).toString()
    });

    const response = await axios.get(
      `${API_BASE_URL}/recommendations/content-based?${params}`,
      {
        headers: this.getAuthHeader()
      }
    );

    return response.data;
  }

  /**
   * Get personalized recommendations
   * Recommends items based on user's interaction history and preferences
   */
  async getPersonalizedRecommendations(
    options: {
      limit?: number;
      minScore?: number;
      excludeViewed?: boolean;
    } = {}
  ): Promise<RecommendationResponse> {
    const params = new URLSearchParams({
      limit: (options.limit || 10).toString(),
      min_score: (options.minScore || 0.1).toString(),
      exclude_viewed: (options.excludeViewed !== false).toString()
    });

    const response = await axios.get(
      `${API_BASE_URL}/recommendations/personalized?${params}`,
      {
        headers: this.getAuthHeader()
      }
    );

    return response.data;
  }

  /**
   * Get hybrid recommendations
   * Combines content-based and collaborative filtering
   */
  async getHybridRecommendations(
    options: {
      mediaId?: string;
      limit?: number;
      minScore?: number;
      contentWeight?: number;
      collaborativeWeight?: number;
      diversityFactor?: number;
      explorationRate?: number;
    } = {}
  ): Promise<RecommendationResponse> {
    const params: Record<string, string> = {
      limit: (options.limit || 10).toString(),
      min_score: (options.minScore || 0.1).toString(),
      diversity_factor: (options.diversityFactor || 0.15).toString(),
      exploration_rate: (options.explorationRate || 0.1).toString()
    };

    if (options.mediaId) {
      params.media_id = options.mediaId;
    }

    if (options.contentWeight !== undefined) {
      params.content_weight = options.contentWeight.toString();
    }

    if (options.collaborativeWeight !== undefined) {
      params.collaborative_weight = options.collaborativeWeight.toString();
    }

    const response = await axios.get(
      `${API_BASE_URL}/recommendations/hybrid?${new URLSearchParams(params)}`,
      {
        headers: this.getAuthHeader()
      }
    );

    return response.data;
  }

  /**
   * Track user interaction
   * Records user interactions for improving future recommendations
   */
  async trackInteraction(interaction: InteractionRequest): Promise<{ success: boolean }> {
    const response = await axios.post(
      `${API_BASE_URL}/recommendations/track-interaction`,
      interaction,
      {
        headers: {
          ...this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  /**
   * Track recommendation click
   * Records when a user clicks on a recommended item
   */
  async trackClick(tracking: ClickTrackingRequest): Promise<{ success: boolean }> {
    const response = await axios.post(
      `${API_BASE_URL}/recommendations/track-click`,
      tracking,
      {
        headers: {
          ...this.getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  /**
   * Get recommendation performance metrics (admin only)
   */
  async getMetrics(days: number = 7): Promise<any> {
    const response = await axios.get(
      `${API_BASE_URL}/recommendations/metrics?days=${days}`,
      {
        headers: this.getAuthHeader()
      }
    );

    return response.data;
  }
}

// Export singleton instance
export const recommendationsApi = new RecommendationsAPI();

// Export class for testing
export default RecommendationsAPI;
