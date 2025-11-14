import React, { useState, useMemo } from 'react';
import { Heart, Book, Headphones, Video, Search, ChevronLeft, Clock, User, Calendar, FileText, Music, Youtube, Film, Play } from 'lucide-react';
import { MediaItem, getImageUrl } from '../services/api';
import LazyImage from '../components/LazyImage';
import { useFavoritesImproved } from '../hooks/useFavoritesImproved';

interface FavoritesPageProps {
  onMediaClick: (item: MediaItem, type: 'pdf' | 'audio' | 'video') => void;
  onBack: () => void;
}

const FavoritesPage: React.FC<FavoritesPageProps> = ({ onMediaClick, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'book' | 'audio' | 'video'>('all');
  const [sortBy, setSortBy] = useState<'latest' | 'alphabetical' | 'type'>('latest');

  const { favorites, isLoading, error, isFavorited, toggleFavorite } = useFavoritesImproved();

  // Filter and sort favorites
  const filteredAndSortedFavorites = useMemo(() => {
    let filtered = favorites.filter(item => {
      const matchesSearch = !searchQuery.trim() ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.author && item.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesMediaType = selectedMediaType === 'all' ||
        (selectedMediaType === 'book' && !item.audio_file_path && !item.video_file_path && !item.youtube_url) ||
        (selectedMediaType === 'audio' && item.audio_file_path) ||
        (selectedMediaType === 'video' && (item.video_file_path || item.youtube_url));

      return matchesSearch && matchesMediaType;
    });

    // Sort the filtered results
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'type':
          // Group by media type: books, audio, video
          const typeA = item.audio_file_path ? 'audio' : item.video_file_path || item.youtube_url ? 'video' : 'book';
          const typeB = item.audio_file_path ? 'audio' : item.video_file_path || item.youtube_url ? 'video' : 'book';
          return typeA.localeCompare(typeB);
        default:
          return 0;
      }
    });
  }, [favorites, searchQuery, selectedMediaType, sortBy]);

  // Get media type for display
  const getMediaType = (item: MediaItem): 'book' | 'audio' | 'video' => {
    if (item.audio_file_path) return 'audio';
    if (item.video_file_path || item.youtube_url) return 'video';
    return 'book';
  };

  // Get media type for click handler
  const getMediaClickType = (item: MediaItem): 'pdf' | 'audio' | 'video' => {
    if (item.audio_file_path) return 'audio';
    if (item.video_file_path || item.youtube_url) return 'video';
    return 'pdf';
  };

  // Handle favorite button click
  const handleFavoriteClick = async (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation(); // Prevent triggering the media item click
    const mediaType = getMediaType(item);
    await toggleFavorite(mediaType, item.id);
  };

  // Format duration for videos and audio
  const formatDuration = (seconds: number) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get source icon for videos
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'youtube':
        return <Youtube size={16} className="text-red-500" />;
      case 'local':
        return <Film size={16} className="text-blue-500" />;
      default:
        return <Video size={16} className="text-gray-500" />;
    }
  };

  // Get format icon for books
  const getFormatIcon = (format: string) => {
    switch (format?.toLowerCase()) {
      case 'pdf':
        return <FileText size={16} className="text-red-500" />;
      case 'epub':
        return <Book size={16} className="text-green-500" />;
      default:
        return <Book size={16} className="text-blue-500" />;
    }
  };

  // Get responsive image srcset for optimal loading
  const getResponsiveImageSrcset = (item: MediaItem) => {
    const mediaType = getMediaType(item);

    if (mediaType === 'video') {
      // For videos, use thumbnail_* fields
      const sources = [];
      if (item.thumbnail_thumbnail) sources.push(`${getImageUrl(item.thumbnail_thumbnail)} 267w`);
      if (item.thumbnail_small) sources.push(`${getImageUrl(item.thumbnail_small)} 533w`);
      if (item.thumbnail_medium) sources.push(`${getImageUrl(item.thumbnail_medium)} 1067w`);
      if (item.thumbnail_large) sources.push(`${getImageUrl(item.thumbnail_large)} 1600w`);

      return sources.length > 0 ? sources.join(', ') : '';
    } else {
      // For books and audio, use cover_image_* fields
      const sources = [];
      if (item.cover_image_thumbnail) sources.push(`${getImageUrl(item.cover_image_thumbnail)} 150w`);
      if (item.cover_image_small) sources.push(`${getImageUrl(item.cover_image_small)} 300w`);
      if (item.cover_image_medium) sources.push(`${getImageUrl(item.cover_image_medium)} 600w`);
      if (item.cover_image_large) sources.push(`${getImageUrl(item.cover_image_large)} 900w`);

      return sources.length > 0 ? sources.join(', ') : '';
    }
  };

  // Get best thumbnail URL with proper URL construction
  const getBestThumbnailUrl = (item: MediaItem) => {
    const mediaType = getMediaType(item);

    // Try responsive images first (medium size as default)
    if (mediaType === 'video') {
      if (item.thumbnail_medium) return getImageUrl(item.thumbnail_medium);
      if (item.thumbnail_small) return getImageUrl(item.thumbnail_small);
      if (item.thumbnail_url && item.thumbnail_url.trim()) return getImageUrl(item.thumbnail_url);
    } else {
      if (item.cover_image_medium) return getImageUrl(item.cover_image_medium);
      if (item.cover_image_small) return getImageUrl(item.cover_image_small);
      if (item.cover_image_url && item.cover_image_url.trim()) return getImageUrl(item.cover_image_url);
    }

    // Fallbacks based on media type
    if (mediaType === 'video') {
      if (item.youtube_id) {
        // Try multiple YouTube thumbnail qualities as fallbacks
        return `https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`;
      }
      return "";
    }
    return "";
  };

  // Get media type icon
  const getMediaTypeIcon = (item: MediaItem) => {
    const mediaType = getMediaType(item);
    switch (mediaType) {
      case 'book':
        return <Book size={12} className="text-blue-500" />;
      case 'audio':
        return <Headphones size={12} className="text-green-500" />;
      case 'video':
        return <Video size={12} className="text-red-500" />;
    }
  };

  // Get aspect ratio for media
  const getAspectRatio = (item: MediaItem) => {
    const mediaType = getMediaType(item);
    if (mediaType === 'video') return '16/9';  // Landscape
    if (mediaType === 'audio') return '1/1';    // Square
    return '3/4';  // Portrait (books)
  };

  // Get aspect ratio CSS class for media
  const getAspectRatioClass = (item: MediaItem) => {
    const mediaType = getMediaType(item);
    if (mediaType === 'video') return 'aspect-video';  // 16:9
    if (mediaType === 'audio') return 'aspect-square'; // 1:1
    return 'aspect-[3/4]';  // 3:4 portrait
  };

  // Get sizes for responsive images
  const getSizes = (item: MediaItem) => {
    const mediaType = getMediaType(item);
    return mediaType === 'video'
      ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
      : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center">
          <Heart className="animate-pulse text-red-500 mx-auto mb-4" size={48} />
          <p className="text-gray-600" style={{ fontFamily: 'Times New Roman' }}>Loading your favorites...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center">
          <Heart className="text-red-300 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Times New Roman' }}>
            Error loading favorites
          </h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={onBack}
            className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-red-500">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-red-500 hover:text-red-600 transition-colors duration-200"
              >
                <ChevronLeft size={24} />
                <span className="font-semibold" style={{ fontFamily: 'Times New Roman' }}>Back</span>
              </button>
              <div className="flex items-center gap-2">
                <Heart size={32} className="text-red-500 fill-red-500" />
                <h1 className="text-3xl font-bold text-red-500" style={{ fontFamily: 'Times New Roman' }}>
                  My Favorites
                </h1>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {filteredAndSortedFavorites.length} of {favorites.length} items
            </div>
          </div>

          {/* Search and Filters */}
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search size={20} className="absolute left-3 text-gray-400 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search favorites by title, author, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                style={{ fontFamily: 'Times New Roman' }}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              {/* Media Type Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Type:</label>
                <select
                  value={selectedMediaType}
                  onChange={(e) => setSelectedMediaType(e.target.value as any)}
                  className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="book">Books</option>
                  <option value="audio">Audio Books</option>
                  <option value="video">Videos</option>
                </select>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                >
                  <option value="latest">Latest Added</option>
                  <option value="alphabetical">Title</option>
                  <option value="type">Media Type</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredAndSortedFavorites.length === 0 ? (
          <div className="text-center py-20">
            <Heart size={64} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Times New Roman' }}>
              {favorites.length === 0 ? 'No favorites yet' : 'No items match your filters'}
            </h3>
            <p className="text-gray-500">
              {favorites.length === 0
                ? 'Start adding your favorite books, audiobooks, and videos to see them here!'
                : 'Try adjusting your search or filters to find what you\'re looking for.'
              }
            </p>
            {favorites.length === 0 && (
              <button
                onClick={onBack}
                className="mt-4 bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Browse Media
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredAndSortedFavorites.map((item) => {
              const mediaType = getMediaType(item);
              const clickType = getMediaClickType(item);
              // Create unique key combining media type and ID to ensure React can track items properly
              const uniqueKey = `${mediaType}-${item.id}`;

              return (
                <div
                  key={uniqueKey}
                  className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden group cursor-pointer"
                  onClick={() => onMediaClick(item, clickType)}
                >
                  {/* Cover/Thumbnail */}
                  <div className={`relative ${getAspectRatioClass(item)} overflow-hidden bg-gradient-to-br from-red-100 to-red-200`}>
                    <LazyImage
                      src={getBestThumbnailUrl(item)}
                      srcset={getResponsiveImageSrcset(item)}
                      alt={item.title}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      fallback=""
                      aspectRatio={getAspectRatio(item)}
                      sizes={getSizes(item)}
                      priority={false}
                    />

                    {/* Favorite Button */}
                    <button
                      onClick={(e) => handleFavoriteClick(e, item)}
                      className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition-all duration-200 hover:scale-110"
                      aria-label={isFavorited(mediaType, item.id) ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Heart
                        size={14}
                        className={`transition-colors duration-200 ${
                          isFavorited(mediaType, item.id)
                            ? 'text-red-500 fill-red-500'
                            : 'text-gray-400 hover:text-red-500'
                        }`}
                      />
                    </button>

                    {/* Media Type Badge */}
                    <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white p-1 rounded">
                      {getMediaTypeIcon(item)}
                    </div>

                    {/* Duration Badge for Audio/Video */}
                    {item.duration && (mediaType === 'audio' || mediaType === 'video') && (
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                        {formatDuration(item.duration)}
                      </div>
                    )}

                    {/* Play Button Overlay for Audio/Video */}
                    {(mediaType === 'audio' || mediaType === 'video') && (
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-0 group-hover:scale-100 transition-all duration-300">
                          <Play size={24} className="text-white ml-1" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 group-hover:text-red-600 transition-colors text-sm" style={{ fontFamily: 'Times New Roman' }}>
                      {item.title}
                    </h3>

                    {item.author && (
                      <p className="text-xs text-gray-600 mb-1" style={{ fontFamily: 'Times New Roman' }}>
                        by {item.author}
                      </p>
                    )}

                    {item.narrator && mediaType === 'audio' && (
                      <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                        <User size={10} />
                        Narrated by {item.narrator}
                      </p>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full capitalize truncate max-w-[60%]">
                        {item.genre || item.category || 'Uncategorized'}
                      </span>
                      <span className="capitalize">
                        {item.language}
                      </span>
                    </div>

                    {/* Published Year for Books */}
                    {item.published_year && mediaType === 'book' && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                        <Calendar size={10} />
                        {item.published_year}
                      </div>
                    )}

                    {/* Video Source Info */}
                    {mediaType === 'video' && item.video_source && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        {getSourceIcon(item.video_source)}
                        <span className="capitalize">
                          {item.video_source === 'youtube' ? 'YouTube' : 'Local Video'}
                        </span>
                      </div>
                    )}

                    {item.description && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;