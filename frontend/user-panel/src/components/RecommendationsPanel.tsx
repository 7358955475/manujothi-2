/**
 * Recommendations Panel Component
 *
 * Displays personalized recommendations with loading states, error handling,
 * and click tracking.
 */

import React, { useEffect, useState } from 'react';
import { recommendationsApi, Recommendation } from '../api/recommendationsApi';

interface RecommendationsPanelProps {
  type?: 'personalized' | 'content-based' | 'hybrid';
  mediaId?: string;
  mediaType?: 'book' | 'audio' | 'video';
  limit?: number;
  title?: string;
  className?: string;
  onMediaClick?: (recommendation: Recommendation) => void;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  position: number;
  onClick: () => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  position,
  onClick
}) => {
  const imageUrl = recommendation.metadata?.cover_image_url ||
                   recommendation.metadata?.thumbnail_url ||
                   '/placeholder-image.jpg';

  const getMediaTypeLabel = (type: string) => {
    switch (type) {
      case 'book': return '📚 Book';
      case 'audio': return '🎧 Audio Book';
      case 'video': return '📹 Video';
      default: return type;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-blue-600';
    return 'text-gray-600';
  };

  return (
    <div
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-200">
        <img
          src={imageUrl}
          alt={recommendation.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
          }}
        />
        {/* Score badge */}
        <div className="absolute top-2 right-2 bg-white bg-opacity-90 rounded-full px-2 py-1">
          <span className={`text-xs font-semibold ${getScoreColor(recommendation.score)}`}>
            {(recommendation.score * 100).toFixed(0)}% match
          </span>
        </div>
        {/* Position badge */}
        <div className="absolute top-2 left-2 bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
          {position}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-2">
          <span className="text-xs text-gray-500">
            {getMediaTypeLabel(recommendation.media_type)}
          </span>
        </div>

        <h3 className="font-semibold text-gray-900 text-lg mb-2 line-clamp-2">
          {recommendation.title}
        </h3>

        {recommendation.metadata?.author && (
          <p className="text-sm text-gray-600 mb-2">
            by {recommendation.metadata.author}
          </p>
        )}

        {recommendation.metadata?.narrator && (
          <p className="text-xs text-gray-500 mb-2">
            Narrated by {recommendation.metadata.narrator}
          </p>
        )}

        {recommendation.metadata?.genre && (
          <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded mb-2">
            {recommendation.metadata.genre}
          </span>
        )}

        {recommendation.reason && (
          <p className="text-xs text-gray-500 italic mt-2">
            {recommendation.reason}
          </p>
        )}
      </div>
    </div>
  );
};

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  type = 'personalized',
  mediaId,
  mediaType,
  limit = 10,
  title,
  className = '',
  onMediaClick
}) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendationId] = useState(`rec_${Date.now()}_${Math.random()}`);

  useEffect(() => {
    fetchRecommendations();
  }, [type, mediaId, limit]);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      let response;

      switch (type) {
        case 'content-based':
          if (!mediaId || !mediaType) {
            throw new Error('mediaId and mediaType are required for content-based recommendations');
          }
          response = await recommendationsApi.getContentBasedRecommendations(
            mediaId,
            mediaType,
            { limit }
          );
          break;

        case 'hybrid':
          response = await recommendationsApi.getHybridRecommendations({
            mediaId,
            limit
          });
          break;

        case 'personalized':
        default:
          response = await recommendationsApi.getPersonalizedRecommendations({
            limit
          });
          break;
      }

      setRecommendations(response.recommendations);
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);
      setError(err.response?.data?.error || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleMediaClick = async (recommendation: Recommendation, position: number) => {
    // Track click
    try {
      await recommendationsApi.trackClick({
        recommendation_id: recommendationId,
        media_id: recommendation.media_id,
        media_type: recommendation.media_type,
        position
      });

      // Track view interaction
      await recommendationsApi.trackInteraction({
        media_id: recommendation.media_id,
        media_type: recommendation.media_type,
        interaction_type: 'view'
      });
    } catch (err) {
      console.error('Error tracking click:', err);
    }

    // Call parent handler
    if (onMediaClick) {
      onMediaClick(recommendation);
    }
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {title || 'Recommended for You'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-80 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {title || 'Recommended for You'}
        </h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchRecommendations}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className={`${className}`}>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {title || 'Recommended for You'}
        </h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg mb-4">
            No recommendations available yet.
          </p>
          <p className="text-gray-500 text-sm">
            Start exploring content to get personalized recommendations!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {title || 'Recommended for You'}
        </h2>
        <button
          onClick={fetchRecommendations}
          className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {recommendations.map((rec, index) => (
          <RecommendationCard
            key={`${rec.media_type}-${rec.media_id}`}
            recommendation={rec}
            position={index + 1}
            onClick={() => handleMediaClick(rec, index + 1)}
          />
        ))}
      </div>
    </div>
  );
};

export default RecommendationsPanel;
