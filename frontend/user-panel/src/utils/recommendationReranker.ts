/**
 * TensorFlow.js Client-Side Re-Ranker (Optional)
 *
 * Lightweight neural model that re-ranks backend-provided recommendation candidates
 * based on user's real-time behavior and preferences.
 *
 * Features:
 * - Runs entirely on-device
 * - Learns from user clicks and interactions
 * - Adjusts scores based on time-of-day, device, session context
 * - Falls back to backend scores if model fails
 */

import { Recommendation } from '../api/recommendationsApi';

interface RerankerModel {
  isLoaded: boolean;
  predict: (features: number[]) => Promise<number>;
}

interface UserContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  device: 'mobile' | 'tablet' | 'desktop';
  sessionDuration: number; // minutes
  recentGenres: string[]; // last 5 interactions
  recentLanguages: string[];
}

class RecommendationReranker {
  private model: RerankerModel | null = null;
  private isLoading: boolean = false;
  private fallbackToBackend: boolean = true;

  /**
   * Load the TF.js model (placeholder - requires actual model training)
   */
  async loadModel(): Promise<void> {
    if (this.model?.isLoaded || this.isLoading) {
      return;
    }

    this.isLoading = true;

    try {
      // In production, load actual TF.js model:
      // const model = await tf.loadLayersModel('/models/reranker/model.json');

      // For now, use placeholder
      this.model = {
        isLoaded: true,
        predict: async (features: number[]) => {
          // Placeholder: simple weighted sum
          // In production: model.predict(tf.tensor2d([features])).dataSync()[0]
          return features.reduce((sum, f, i) => sum + f * (1 - i * 0.1), 0) / features.length;
        }
      };

      console.log('✅ Re-ranker model loaded successfully');
      this.fallbackToBackend = false;
    } catch (error) {
      console.error('❌ Failed to load re-ranker model:', error);
      this.fallbackToBackend = true;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get current user context
   */
  private getUserContext(): UserContext {
    const hour = new Date().getHours();
    let timeOfDay: UserContext['timeOfDay'];

    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isTablet = /iPad|Android/i.test(navigator.userAgent) && window.innerWidth > 768;
    const device: UserContext['device'] = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    // Get session duration (from sessionStorage)
    const sessionStart = sessionStorage.getItem('session_start');
    const sessionDuration = sessionStart
      ? (Date.now() - parseInt(sessionStart)) / (1000 * 60)
      : 0;

    // Get recent preferences (from localStorage)
    const recentGenres = JSON.parse(localStorage.getItem('recent_genres') || '[]');
    const recentLanguages = JSON.parse(localStorage.getItem('recent_languages') || '[]');

    return {
      timeOfDay,
      device,
      sessionDuration,
      recentGenres,
      recentLanguages
    };
  }

  /**
   * Extract features from recommendation and context
   */
  private extractFeatures(
    recommendation: Recommendation,
    context: UserContext,
    position: number
  ): number[] {
    const features: number[] = [];

    // 1. Backend score (0-1)
    features.push(recommendation.score);

    // 2. Position penalty (earlier = better)
    features.push(1 - position / 10);

    // 3. Genre match
    const genreMatch = recommendation.metadata?.genre &&
                       context.recentGenres.includes(recommendation.metadata.genre) ? 1 : 0;
    features.push(genreMatch);

    // 4. Language match
    const langMatch = recommendation.metadata?.language &&
                      context.recentLanguages.includes(recommendation.metadata.language) ? 1 : 0;
    features.push(langMatch);

    // 5. Media type encoding (normalized)
    const mediaTypeScore = recommendation.media_type === 'book' ? 0.33 :
                          recommendation.media_type === 'audio' ? 0.66 : 1.0;
    features.push(mediaTypeScore);

    // 6. Time-of-day preference (learned pattern, placeholder for now)
    const timeScore = context.timeOfDay === 'evening' ? 1.0 :
                     context.timeOfDay === 'morning' ? 0.8 :
                     context.timeOfDay === 'afternoon' ? 0.6 : 0.4;
    features.push(timeScore);

    // 7. Device type
    const deviceScore = context.device === 'desktop' ? 1.0 :
                       context.device === 'tablet' ? 0.7 : 0.5;
    features.push(deviceScore);

    // 8. Session engagement (longer session = more interested)
    const sessionScore = Math.min(context.sessionDuration / 30, 1.0); // Cap at 30 min
    features.push(sessionScore);

    // 9. Author/narrator familiarity (placeholder)
    features.push(0.5);

    // 10. Recency bias (newer content)
    features.push(0.5);

    return features;
  }

  /**
   * Re-rank recommendations based on user context
   */
  async rerank(recommendations: Recommendation[]): Promise<Recommendation[]> {
    // If model not loaded or fallback mode, return original
    if (!this.model?.isLoaded || this.fallbackToBackend) {
      console.log('⏩ Using backend scores (model not available)');
      return recommendations;
    }

    try {
      const context = this.getUserContext();
      const reranked: Array<Recommendation & { rerankedScore: number }> = [];

      // Predict new scores for each recommendation
      for (let i = 0; i < recommendations.length; i++) {
        const rec = recommendations[i];
        const features = this.extractFeatures(rec, context, i);
        const newScore = await this.model.predict(features);

        reranked.push({
          ...rec,
          rerankedScore: newScore
        });
      }

      // Sort by new scores
      reranked.sort((a, b) => b.rerankedScore - a.rerankedScore);

      // Update scores in result
      const finalRecommendations = reranked.map((rec, index) => ({
        ...rec,
        score: rec.rerankedScore,
        reason: rec.reason
          ? `${rec.reason} • Personalized for ${context.timeOfDay}`
          : `Recommended for ${context.timeOfDay}`
      }));

      console.log('✨ Recommendations re-ranked on-device');
      return finalRecommendations;
    } catch (error) {
      console.error('❌ Re-ranking failed, using backend scores:', error);
      return recommendations;
    }
  }

  /**
   * Track user feedback for model improvement (placeholder)
   */
  async trackFeedback(
    recommendationId: string,
    clicked: boolean,
    timeToClick?: number
  ): Promise<void> {
    // In production: send to analytics/training pipeline
    // For now: store in localStorage for debugging
    const feedback = {
      recommendationId,
      clicked,
      timeToClick,
      timestamp: Date.now()
    };

    const history = JSON.parse(localStorage.getItem('reranker_feedback') || '[]');
    history.push(feedback);

    // Keep last 100 entries
    if (history.length > 100) {
      history.shift();
    }

    localStorage.setItem('reranker_feedback', JSON.stringify(history));
  }

  /**
   * Update user context based on interactions
   */
  updateContext(mediaType: string, genre?: string, language?: string): void {
    // Update recent genres
    if (genre) {
      const recentGenres = JSON.parse(localStorage.getItem('recent_genres') || '[]');
      recentGenres.unshift(genre);
      const uniqueGenres = Array.from(new Set(recentGenres)).slice(0, 5);
      localStorage.setItem('recent_genres', JSON.stringify(uniqueGenres));
    }

    // Update recent languages
    if (language) {
      const recentLanguages = JSON.parse(localStorage.getItem('recent_languages') || '[]');
      recentLanguages.unshift(language);
      const uniqueLanguages = Array.from(new Set(recentLanguages)).slice(0, 5);
      localStorage.setItem('recent_languages', JSON.stringify(uniqueLanguages));
    }

    // Update session start
    if (!sessionStorage.getItem('session_start')) {
      sessionStorage.setItem('session_start', Date.now().toString());
    }
  }

  /**
   * Get model status
   */
  getStatus(): {
    isLoaded: boolean;
    isLoading: boolean;
    fallbackMode: boolean;
  } {
    return {
      isLoaded: this.model?.isLoaded || false,
      isLoading: this.isLoading,
      fallbackMode: this.fallbackToBackend
    };
  }
}

// Export singleton instance
export const recommendationReranker = new RecommendationReranker();

// Export class for testing
export default RecommendationReranker;

/**
 * TRAINING NOTES (For ML Engineers):
 *
 * To train actual TF.js model:
 *
 * 1. Collect Training Data:
 *    - recommendation_metrics table (clicks, time_to_click, position)
 *    - user_interactions (context: time, device, etc.)
 *    - Target variable: did_click (binary), time_to_click (regression)
 *
 * 2. Feature Engineering:
 *    - Backend score, position, genre match, language match
 *    - Time-of-day, device type, session duration
 *    - User preference vectors
 *    - Historical CTR for similar items
 *
 * 3. Model Architecture (Example):
 *    ```python
 *    model = tf.keras.Sequential([
 *      tf.keras.layers.Dense(64, activation='relu', input_dim=10),
 *      tf.keras.layers.Dropout(0.2),
 *      tf.keras.layers.Dense(32, activation='relu'),
 *      tf.keras.layers.Dense(1, activation='sigmoid')
 *    ])
 *    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
 *    ```
 *
 * 4. Export to TF.js:
 *    ```python
 *    import tensorflowjs as tfjs
 *    tfjs.converters.save_keras_model(model, 'public/models/reranker')
 *    ```
 *
 * 5. Load in Frontend:
 *    ```typescript
 *    const model = await tf.loadLayersModel('/models/reranker/model.json');
 *    const prediction = model.predict(tf.tensor2d([features]));
 *    const score = prediction.dataSync()[0];
 *    ```
 */
