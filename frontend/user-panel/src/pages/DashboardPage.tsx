import React from 'react';
import {
  BookOpen,
  Headphones,
  Play,
  Clock,
  TrendingUp,
  Star,
  Book,
  Eye,
  User,
  Calendar,
  ChevronRight,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { MediaItem } from '../services/api';
import { useDashboard } from '../hooks/useDashboard';
import LazyImage from '../components/LazyImage';

interface DashboardPageProps {
  onMediaClick: (item: MediaItem, type: 'pdf' | 'audio' | 'video') => void;
  onBack: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onMediaClick, onBack }) => {
  const {
    overview,
    recentlyViewed,
    recommendations,
    inProgress,
    completed,
    progressStats,
    isLoading,
    isRefreshing,
    error,
    refreshDashboard,
    trackActivity
  } = useDashboard();

  // Fallback placeholder images (SVG data URIs)
  const FALLBACK_IMAGES = {
    book: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTdmNWZmIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTUwLCAyMDApIj48cmVjdCB4PSItNDAiIHk9Ii02MCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iIzkzMzNlYSIgcng9IjQiLz48cmVjdCB4PSItMzUiIHk9Ii01NSIgd2lkdGg9IjcwIiBoZWlnaHQ9IjExMCIgZmlsbD0iI2E4NTVmNyIgcng9IjMiLz48bGluZSB4MT0iLTM1IiB5MT0iLTM1IiB4Mj0iLTE1IiB5Mj0iLTM1IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMyIvPjxsaW5lIHgxPSItMzUiIHkxPSItMTUiIHgyPSIxNSIgeTI9Ii0xNSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjMiLz48bGluZSB4MT0iLTM1IiB5MT0iNSIgeDI9IjEwIiB5Mj0iNSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjMiLz48L2c+PHRleHQgeD0iNTAlIiB5PSI4NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzkzMzNlYSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPkJvb2s8L3RleHQ+PC9zdmc+',
    audio: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWNmY2YxIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTUwLCAyMDApIj48Y2lyY2xlIGN4PSIwIiBjeT0iMCIgcj0iNjAiIGZpbGw9IiMxMGIzODEiIG9wYWNpdHk9IjAuMiIvPjxjaXJjbGUgY3g9IjAiIGN5PSIwIiByPSI0NSIgZmlsbD0iIzEwYjM4MSIgb3BhY2l0eT0iMC4zIi8+PGNpcmNsZSBjeD0iMCIgY3k9IjAiIHI9IjMwIiBmaWxsPSIjMTBiMzgxIi8+PHBhdGggZD0iTSAtMTUsLTE1IEwgMTUsMCBMIC0xNSwxNSBaIiBmaWxsPSIjZmZmIi8+PC9nPjx0ZXh0IHg9IjUwJSIgeT0iODUlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiMxMGIzODEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtd2VpZ2h0PSJib2xkIj5BdWRpbzwvdGV4dD48L3N2Zz4=',
    video: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIyNSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmVlMmUyIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjAwLCAxMTIuNSkiPjxyZWN0IHg9Ii02MCIgeT0iLTQ1IiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiBmaWxsPSIjZWYyNDQ0IiByeD0iOCIvPjxjaXJjbGUgY3g9IjAiIGN5PSIwIiByPSIyNSIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC45Ii8+PHBhdGggZD0iTSAtOCwtMTIgTCAxNSwwIEwgLTgsMTIgWiIgZmlsbD0iI2VmMjQ0NCIvPjwvZz48dGV4dCB4PSI1MCUiIHk9Ijg1JSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4IiBmaWxsPSIjZWYyNDQ0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXdlaWdodD0iYm9sZCI+VmlkZW88L3RleHQ+PC9zdmc+'
  };

  // Helper functions
  const getMediaType = (item: MediaItem): 'book' | 'audio' | 'video' => {
    // For dashboard items, use the media_type field directly
    if (item.media_type) return item.media_type as 'book' | 'audio' | 'video';

    // For regular items, use file paths to determine type
    if (item.audio_file_path) return 'audio';
    if (item.video_file_path || item.youtube_url) return 'video';
    return 'book';
  };

  const getMediaClickType = (item: MediaItem): 'pdf' | 'audio' | 'video' => {
    const mediaType = getMediaType(item);
    return mediaType === 'book' ? 'pdf' : mediaType as 'audio' | 'video';
  };

  const getBestThumbnailUrl = (item: MediaItem) => {
    // First, try to get the actual cover/thumbnail URL
    if (item.cover_image_url && item.cover_image_url.trim()) return item.cover_image_url;
    if (item.thumbnail_url && item.thumbnail_url.trim()) return item.thumbnail_url;

    // For videos, try YouTube thumbnail
    const mediaType = getMediaType(item);
    if (mediaType === 'video' && item.youtube_id) {
      return `https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`;
    }

    // Return fallback image based on media type
    return FALLBACK_IMAGES[mediaType];
  };

  const getFallbackImage = (item: MediaItem) => {
    const mediaType = getMediaType(item);
    return FALLBACK_IMAGES[mediaType];
  };

  const getAspectRatio = (item: MediaItem) => {
    const mediaType = getMediaType(item);
    return mediaType === 'video' ? '16/9' : '3/4';
  };

  const formatTimeSpent = (seconds: number | null | undefined) => {
    if (!seconds || seconds === null || seconds === undefined || seconds === 0) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds || seconds === null || seconds === undefined || seconds === 0) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleMediaClick = async (item: MediaItem) => {
    const mediaType = getMediaType(item);
    const clickType = getMediaClickType(item);

    // For dashboard items, use media_id as the ID
    const itemId = item.media_id || item.id;

    // Track viewing activity
    await trackActivity(mediaType, itemId, 'viewed');

    // Create a properly formatted MediaItem for the media viewer
    const normalizedItem: MediaItem = {
      ...item,
      id: itemId, // Ensure the item has the correct ID field
      // Ensure file URLs are properly mapped
      pdf_file_path: item.content_url || item.file_url || item.pdf_url || item.pdf_file_path,
      audio_file_path: item.content_url || item.file_url || item.audio_url || item.audio_file_path,
      video_file_path: item.content_url || item.file_url || item.video_url || item.video_file_path,
    };

    // Open media viewer
    onMediaClick(normalizedItem, clickType);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600" style={{ fontFamily: 'Times New Roman' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="text-orange-300 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Times New Roman' }}>
            Error loading dashboard
          </h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={onBack}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-orange-500">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-orange-500 hover:text-orange-600 transition-colors duration-200"
              >
                <ChevronRight size={24} className="rotate-180" />
                <span className="font-semibold" style={{ fontFamily: 'Times New Roman' }}>Back</span>
              </button>
              <div className="flex items-center gap-2">
                <BarChart3 size={32} className="text-orange-500" />
                <h1 className="text-3xl font-bold text-orange-500" style={{ fontFamily: 'Times New Roman' }}>
                  My Dashboard
                </h1>
              </div>
            </div>
            <button
              onClick={refreshDashboard}
              disabled={isRefreshing}
              className="flex items-center gap-2 text-orange-500 hover:text-orange-600 transition-colors duration-200 disabled:opacity-50"
            >
              <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="font-medium" style={{ fontFamily: 'Times New Roman' }}>
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Overview */}
        {overview && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">In Progress</p>
                  <p className="text-2xl font-bold text-gray-800">{overview.in_progress_count}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <BookOpen size={24} className="text-blue-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Completed</p>
                  <p className="text-2xl font-bold text-gray-800">{overview.completed_count}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <Star size={24} className="text-green-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Time Spent</p>
                  <p className="text-2xl font-bold text-gray-800">{formatTimeSpent(overview.total_time_spent)}</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <Clock size={24} className="text-purple-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Completion Rate</p>
                  <p className="text-2xl font-bold text-gray-800">{overview.completion_rate}%</p>
                </div>
                <div className="bg-orange-100 p-3 rounded-full">
                  <TrendingUp size={24} className="text-orange-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recently Viewed */}
        {recentlyViewed && recentlyViewed.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2" style={{ fontFamily: 'Times New Roman' }}>
                <Eye size={24} className="text-orange-500" />
                Recently Viewed
              </h2>
              <span className="text-sm text-gray-600">{recentlyViewed.length} items</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {recentlyViewed.slice(0, 5).map((item, index) => {
                const mediaType = getMediaType(item);
                const itemId = item.media_id || item.id || `temp-${index}`;
                return (
                  <div
                    key={`${mediaType}-${itemId}`}
                    className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden cursor-pointer group"
                    onClick={() => handleMediaClick(item)}
                  >
                    <div className={`relative ${mediaType === 'video' ? 'aspect-video' : 'aspect-[3/4]'} overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200`}>
                      <LazyImage
                        src={getBestThumbnailUrl(item)}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        fallback={getFallbackImage(item)}
                        aspectRatio={getAspectRatio(item)}
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                        priority={false}
                      />
                      <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white p-1 rounded">
                        {mediaType === 'book' && <Book size={12} className="text-blue-300" />}
                        {mediaType === 'audio' && <Headphones size={12} className="text-green-300" />}
                        {mediaType === 'video' && <Play size={12} className="text-red-300" />}
                      </div>
                      {(item.progress_percentage !== null && item.progress_percentage !== undefined) && (
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                          {item.progress_percentage}%
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 text-sm group-hover:text-orange-600 transition-colors" style={{ fontFamily: 'Times New Roman' }}>
                        {item.title}
                      </h3>
                      {item.author && (
                        <p className="text-xs text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
                          {item.author}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* In Progress */}
        {inProgress && inProgress.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2" style={{ fontFamily: 'Times New Roman' }}>
                <BookOpen size={24} className="text-blue-500" />
                In Progress
              </h2>
              <span className="text-sm text-gray-600">{inProgress.length} items</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {inProgress.slice(0, 4).map((item, index) => {
                const mediaType = getMediaType(item);
                const itemId = item.media_id || item.id || `temp-${index}`;
                return (
                  <div
                    key={`${mediaType}-${itemId}`}
                    className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden cursor-pointer group"
                    onClick={() => handleMediaClick(item)}
                  >
                    <div className={`relative ${mediaType === 'video' ? 'aspect-video' : 'aspect-[3/4]'} overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200`}>
                      <LazyImage
                        src={getBestThumbnailUrl(item)}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        fallback={getFallbackImage(item)}
                        aspectRatio={getAspectRatio(item)}
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                        priority={false}
                      />
                      <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white p-1 rounded">
                        {mediaType === 'book' && <Book size={12} className="text-blue-300" />}
                        {mediaType === 'audio' && <Headphones size={12} className="text-green-300" />}
                        {mediaType === 'video' && <Play size={12} className="text-red-300" />}
                      </div>
                      <div className="absolute bottom-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                        Progress: {item.progress_percentage || 0}%
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 text-sm group-hover:text-blue-600 transition-colors" style={{ fontFamily: 'Times New Roman' }}>
                        {item.title}
                      </h3>
                      {item.author && (
                        <p className="text-xs text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
                          {item.author}
                        </p>
                      )}
                      {item.last_accessed && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last accessed: {new Date(item.last_accessed).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2" style={{ fontFamily: 'Times New Roman' }}>
                <TrendingUp size={24} className="text-purple-500" />
                Recommended for You
              </h2>
              <span className="text-sm text-gray-600">{recommendations.length} items</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {recommendations.slice(0, 10).map((item, index) => {
                const mediaType = getMediaType(item);
                const itemId = item.media_id || item.id || `temp-${index}`;
                return (
                  <div
                    key={`rec-${mediaType}-${itemId}`}
                    className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden cursor-pointer group"
                    onClick={() => handleMediaClick(item)}
                  >
                    <div className={`relative ${mediaType === 'video' ? 'aspect-video' : 'aspect-[3/4]'} overflow-hidden bg-gradient-to-br from-purple-100 to-purple-200`}>
                      <LazyImage
                        src={getBestThumbnailUrl(item)}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        fallback={getFallbackImage(item)}
                        aspectRatio={getAspectRatio(item)}
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                        priority={false}
                      />
                      <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white p-1 rounded">
                        {mediaType === 'book' && <Book size={12} className="text-blue-300" />}
                        {mediaType === 'audio' && <Headphones size={12} className="text-green-300" />}
                        {mediaType === 'video' && <Play size={12} className="text-red-300" />}
                      </div>
                      <div className="absolute top-2 right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded">
                        Recommended
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 text-sm group-hover:text-purple-600 transition-colors" style={{ fontFamily: 'Times New Roman' }}>
                        {item.title}
                      </h3>
                      {item.author && (
                        <p className="text-xs text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
                          {item.author}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Items */}
        {completed && completed.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2" style={{ fontFamily: 'Times New Roman' }}>
                <Star size={24} className="text-green-500" />
                Completed
              </h2>
              <span className="text-sm text-gray-600">{completed.length} items</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {completed.slice(0, 4).map((item, index) => {
                const mediaType = getMediaType(item);
                const itemId = item.media_id || item.id || `temp-${index}`;
                return (
                  <div
                    key={`completed-${mediaType}-${itemId}`}
                    className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden cursor-pointer group"
                    onClick={() => handleMediaClick(item)}
                  >
                    <div className={`relative ${mediaType === 'video' ? 'aspect-video' : 'aspect-[3/4]'} overflow-hidden bg-gradient-to-br from-green-100 to-green-200`}>
                      <LazyImage
                        src={getBestThumbnailUrl(item)}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        fallback={getFallbackImage(item)}
                        aspectRatio={getAspectRatio(item)}
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                        priority={false}
                      />
                      <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white p-1 rounded">
                        {mediaType === 'book' && <Book size={12} className="text-blue-300" />}
                        {mediaType === 'audio' && <Headphones size={12} className="text-green-300" />}
                        {mediaType === 'video' && <Play size={12} className="text-red-300" />}
                      </div>
                      <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                        <Star size={12} />
                        Completed
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 text-sm group-hover:text-green-600 transition-colors" style={{ fontFamily: 'Times New Roman' }}>
                        {item.title}
                      </h3>
                      {item.author && (
                        <p className="text-xs text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
                          {item.author}
                        </p>
                      )}
                      {item.time_spent && (
                        <p className="text-xs text-gray-500 mt-1">
                          Time spent: {formatTimeSpent(item.time_spent || 0)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!recentlyViewed || recentlyViewed.length === 0) &&
         (!inProgress || inProgress.length === 0) &&
         (!completed || completed.length === 0) &&
         (!recommendations || recommendations.length === 0) && (
          <div className="text-center py-20">
            <BarChart3 size={64} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Times New Roman' }}>
              Start Your Journey
            </h3>
            <p className="text-gray-500 mb-4">
              Begin exploring books, audiobooks, and videos to see your personalized dashboard here!
            </p>
            <button
              onClick={onBack}
              className="mt-4 bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Browse Media
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;