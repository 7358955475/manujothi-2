import React, { useState } from 'react';
import { Book, Headphones, Play, ChevronDown, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { MediaItem, getImageUrl } from '../services/api';
import LazyImage from './LazyImage';
import { useFavoritesImproved } from '../hooks/useFavoritesImproved';

// Helper function to construct proper image URL
const constructImageUrl = (imagePath: string) => {
  if (!imagePath) return '';

  // If it's already an HTTP URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  // If it starts with /public/, it's already a correct relative path
  if (imagePath.startsWith('/public/')) {
    return `http://localhost:3001${imagePath}`;
  }

  // If it starts with / but not /public/, assume it's in the public directory
  if (imagePath.startsWith('/')) {
    return `http://localhost:3001/public${imagePath}`;
  }

  // Default case: assume it's a relative path to public
  return `http://localhost:3001/public/${imagePath}`;
};

interface MediaShelfProps {
  title: string;
  items: MediaItem[];
  type: 'books' | 'audioBooks' | 'videos';
  mediaType: 'pdf' | 'audio' | 'video';
  scrollPosition: number;
  onScrollLeft: () => void;
  onScrollRight: () => void;
  maxScroll: number;
  sortBy: string;
  onSortChange: (value: string) => void;
  onMediaClick: (item: MediaItem, type: 'pdf' | 'audio' | 'video') => void;
  onHeaderClick?: () => void;
}

const MediaShelf: React.FC<MediaShelfProps> = ({
  title,
  items,
  type,
  mediaType: shelfMediaType,
  scrollPosition,
  onScrollLeft,
  onScrollRight,
  maxScroll,
  sortBy,
  onSortChange,
  onMediaClick,
  onHeaderClick
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [loadingFavorites, setLoadingFavorites] = useState<Set<string>>(new Set());
  const { isFavorited, toggleFavorite } = useFavoritesImproved();

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && scrollPosition < maxScroll) {
      onScrollRight();
    }
    if (isRightSwipe && scrollPosition > 0) {
      onScrollLeft();
    }
  };

  // Handle favorite button click with race condition protection
  const handleFavoriteClick = async (e: React.MouseEvent, item: MediaItem, mediaType: 'book' | 'audio' | 'video') => {
    e.stopPropagation(); // Prevent triggering the media item click

    const favoriteKey = `${mediaType}-${item.id}`;

    // Prevent multiple simultaneous clicks on the same item
    if (loadingFavorites.has(favoriteKey)) {
      console.log('Favorite operation already in progress for:', favoriteKey);
      return;
    }

    setLoadingFavorites(prev => new Set(prev).add(favoriteKey));

    try {
      await toggleFavorite(mediaType, item.id);
    } finally {
      setLoadingFavorites(prev => {
        const newSet = new Set(prev);
        newSet.delete(favoriteKey);
        return newSet;
      });
    }
  };

  // Determine media type for favorites
  const getMediaTypeForFavorites = (item: MediaItem): 'book' | 'audio' | 'video' => {
    if (item.audio_file_path) return 'audio';
    if (item.video_file_path || item.youtube_url) return 'video';
    return 'book';
  };

  // Get responsive image srcset for optimal loading
  const getResponsiveImageSrcset = (item: MediaItem, mediaType: string) => {
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

  const getBestThumbnailUrl = (item: MediaItem, mediaType: string) => {
    // Try responsive images first (medium size as default)
    if (mediaType === 'video') {
      if (item.thumbnail_medium) return getImageUrl(item.thumbnail_medium);
      if (item.thumbnail_small) return getImageUrl(item.thumbnail_small);

      // First check for YouTube thumbnail URL from database (any YouTube domain)
      if (item.thumbnail_url && (item.thumbnail_url.includes('youtube.com/vi/') || item.thumbnail_url.includes('ytimg.com/vi/'))) {
        // Extract video ID from any YouTube thumbnail URL format
        const videoId = item.thumbnail_url.match(/vi\/([^\/]+)/)?.[1];
        if (videoId) {
          // Use hqdefault which is reliably available for all YouTube videos
          return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        }
        return item.thumbnail_url;
      }

      // Check if thumbnail_url is a local upload (starts with /public/)
      if (item.thumbnail_url && item.thumbnail_url.startsWith('/public/')) {
        return constructImageUrl(item.thumbnail_url);
      }

      // Check if it's a full URL to an uploaded thumbnail
      if (item.thumbnail_url && item.thumbnail_url.startsWith('http')) {
        return item.thumbnail_url;
      }

      // Generate YouTube thumbnail from youtube_id
      if (item.youtube_id) {
        return `https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`;
      }

      // Extract YouTube ID from URL if available
      if (item.youtube_url) {
        const match = item.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
        if (match && match[1]) {
          return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
        }
      }
    } else {
      // For books and audio: prioritize responsive images
      if (item.cover_image_medium) return getImageUrl(item.cover_image_medium);
      if (item.cover_image_small) return getImageUrl(item.cover_image_small);

      // IMPORTANT: Use constructImageUrl to handle local uploads correctly
      if (item.cover_image_url && item.cover_image_url.trim() !== '') {
        return constructImageUrl(item.cover_image_url);
      }

      if (item.thumbnail_url && item.thumbnail_url.trim() !== '') {
        return constructImageUrl(item.thumbnail_url);
      }
    }

    // Final fallback - empty string
    return "";
  };

  return (
    <div className="mb-2 sm:mb-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-3 gap-2 sm:gap-0">
        <div
          className={`flex items-center gap-2 sm:gap-3 ${onHeaderClick ? 'cursor-pointer hover:bg-orange-50 -mx-2 px-2 py-1 rounded-lg transition-colors duration-200' : ''}`}
          onClick={onHeaderClick}
        >
          <h2
            className="text-xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3"
            style={{ fontFamily: 'Times New Roman' }}
          >
            {type === 'books' && <Book className="text-orange-500 w-6 h-6 sm:w-8 sm:h-8" />}
            {type === 'audioBooks' && <Headphones className="text-orange-500 w-6 h-6 sm:w-8 sm:h-8" />}
            {type === 'videos' && <Play className="text-orange-500 w-6 h-6 sm:w-8 sm:h-8" />}
            {title}
          </h2>
          <span className="text-sm text-gray-600 font-medium bg-gray-100 px-3 py-1 rounded-full" style={{ fontFamily: 'Times New Roman' }}>
            {items.length} items
          </span>
          {onHeaderClick && (
            <span className="text-xs text-orange-500 ml-1">→</span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="relative">
            <select 
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-2 sm:px-4 py-1 sm:py-2 pr-6 sm:pr-8 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              style={{ fontFamily: 'Times New Roman' }}
            >
              <option value="default">Default</option>
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="alphabetical">A-Z</option>
            </select>
            <ChevronDown size={14} className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>
      
      <div
        className="relative overflow-hidden rounded-lg"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation arrows */}
        {maxScroll > 0 && (
          <>
            <button
              onClick={onScrollLeft}
              disabled={scrollPosition === 0}
              className={`absolute left-2 top-1/2 transform -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition-all duration-200 ${
                scrollPosition === 0 ? 'opacity-50 cursor-not-allowed' : 'opacity-100 cursor-pointer hover:scale-110'
              }`}
              aria-label="Scroll left"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={onScrollRight}
              disabled={scrollPosition >= maxScroll}
              className={`absolute right-2 top-1/2 transform -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition-all duration-200 ${
                scrollPosition >= maxScroll ? 'opacity-50 cursor-not-allowed' : 'opacity-100 cursor-pointer hover:scale-110'
              }`}
              aria-label="Scroll right"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        <div
          className="flex transition-transform duration-500 ease-in-out gap-3 sm:gap-5"
          style={{ transform: `translateX(-${scrollPosition}px)` }}
        >
          {items.map((item) => (
            <div key={item.id} className="flex-none">
              <div
                className="bg-white rounded-xl shadow-lg p-2 sm:p-3 w-32 sm:w-40 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer relative"
                onClick={() => onMediaClick(item, shelfMediaType === 'video' ? 'video' : shelfMediaType)}
              >
                {/* Favorite Button */}
                <button
                  onClick={(e) => handleFavoriteClick(e, item, getMediaTypeForFavorites(item))}
                  className="absolute top-3 right-3 z-10 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition-all duration-200 hover:scale-110"
                  aria-label={isFavorited(getMediaTypeForFavorites(item), item.id) ? "Remove from favorites" : "Add to favorites"}
                >
                  <Heart
                    size={14}
                    className={`transition-all duration-200 ${
                      loadingFavorites.has(`${getMediaTypeForFavorites(item)}-${item.id}`)
                        ? 'text-orange-500 animate-pulse'
                        : isFavorited(getMediaTypeForFavorites(item), item.id)
                        ? 'text-red-500 fill-red-500 hover:scale-110'
                        : 'text-gray-400 hover:text-red-500 hover:scale-110'
                    }`}
                  />
                </button>

                <LazyImage
                  src={getBestThumbnailUrl(item, shelfMediaType)}
                  srcset={getResponsiveImageSrcset(item, shelfMediaType)}
                  alt={item.title}
                  className="rounded-lg mb-2 sm:mb-3"
                  fallback=""
                  autoSize={false}
                  aspectRatio={
                    shelfMediaType === 'video' ? '16/9' :
                    shelfMediaType === 'audio' ? '1/1' :
                    '3/4'
                  }
                  sizes="(max-width: 640px) 160px, (max-width: 768px) 160px, 240px"
                  priority={false}
                />
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  {shelfMediaType === 'video' ? (
                    <Play size={12} className="text-red-500 sm:w-4 sm:h-4" />
                  ) : shelfMediaType === 'pdf' ? (
                    <Book size={12} className="text-blue-500 sm:w-4 sm:h-4" />
                  ) : (
                    <Headphones size={12} className="text-green-500 sm:w-4 sm:h-4" />
                  )}
                  <span className="text-xs sm:text-sm text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
                    {shelfMediaType === 'video'
                      ? (item.duration ? `${Math.floor(item.duration / 60)} min` : 'Video')
                      : (shelfMediaType === 'pdf' ? 'Book' : 'Audio')
                    }
                  </span>
                </div>
                <h3
                  className="font-semibold text-gray-800 text-xs sm:text-sm mb-1 line-clamp-2"
                  style={{ fontFamily: 'Times New Roman' }}
                >
                  {item.title}
                </h3>
                {shelfMediaType !== 'video' && (
                  <p
                    className="text-xs text-gray-600 mb-1"
                    style={{ fontFamily: 'Times New Roman' }}
                  >
                    {item.author || item.narrator}
                  </p>
                )}
                <p className="text-xs text-gray-600 capitalize" style={{ fontFamily: 'Times New Roman' }}>
                  {item.language}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MediaShelf;