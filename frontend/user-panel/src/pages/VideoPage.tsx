import React, { useState, useMemo } from 'react';
import { Search, Filter, Play, Clock, ChevronLeft, Video, Youtube, Film, Heart } from 'lucide-react';
import { MediaItem, getImageUrl } from '../services/api';
import LazyImage from '../components/LazyImage';
import { useFavoritesImproved } from '../hooks/useFavoritesImproved';

interface VideoPageProps {
  videos: MediaItem[];
  onMediaClick: (item: MediaItem, type: 'video') => void;
  onBack: () => void;
}

const VideoPage: React.FC<VideoPageProps> = ({ videos, onMediaClick, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const { isFavorited, toggleFavorite } = useFavoritesImproved();

  // Handle favorite button click
  const handleFavoriteClick = async (e: React.MouseEvent, video: MediaItem) => {
    e.stopPropagation(); // Prevent triggering the video click
    await toggleFavorite('video', video.id);
  };

  // Get unique categories from videos
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(videos
      .filter(video => video.category)
      .map(video => video.category)
    )];
    return uniqueCategories.sort();
  }, [videos]);

  // Get unique languages
  const languages = useMemo(() => {
    const uniqueLanguages = [...new Set(videos.map(video => video.language))];
    return uniqueLanguages.sort();
  }, [videos]);

  // Get unique video sources
  const sources = useMemo(() => {
    const uniqueSources = [...new Set(videos.map(video => video.video_source).filter(Boolean))];
    return uniqueSources;
  }, [videos]);

  // Filter and sort videos
  const filteredAndSortedVideos = useMemo(() => {
    let filtered = videos.filter(video => {
      const matchesSearch = !searchQuery.trim() ||
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (video.description && video.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'all' || video.category === selectedCategory;
      const matchesLanguage = selectedLanguage === 'all' || video.language === selectedLanguage;
      const matchesSource = selectedSource === 'all' || video.video_source === selectedSource;

      return matchesSearch && matchesCategory && matchesLanguage && matchesSource;
    });

    // Sort the filtered results
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'duration':
          return (b.duration || 0) - (a.duration || 0);
        default:
          return 0;
      }
    });
  }, [videos, searchQuery, selectedCategory, selectedLanguage, selectedSource, sortBy]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Helper function to get the best thumbnail URL for a video
  const getBestThumbnailUrl = (video: MediaItem): string => {
    // First check for YouTube thumbnail URL from database (any YouTube domain)
    if (video.thumbnail_url && (video.thumbnail_url.includes('youtube.com/vi/') || video.thumbnail_url.includes('ytimg.com/vi/'))) {
      // Extract video ID from any YouTube thumbnail URL format
      const videoId = video.thumbnail_url.match(/vi\/([^\/]+)/)?.[1];
      if (videoId) {
        return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }
      return video.thumbnail_url;
    }

    // Check if thumbnail_url is a local upload (starts with /public/)
    if (video.thumbnail_url && video.thumbnail_url.startsWith('/public/')) {
      return getImageUrl(video.thumbnail_url);
    }

    // Check if it's a full URL to an uploaded thumbnail
    if (video.thumbnail_url && video.thumbnail_url.startsWith('http')) {
      return video.thumbnail_url;
    }

    // Generate YouTube thumbnail from youtube_id
    if (video.youtube_id) {
      return `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;
    }

    // Extract YouTube ID from URL if available
    if (video.youtube_url) {
      const match = video.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      if (match && match[1]) {
        return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
      }
    }

    // Final fallback - empty string to show fallback UI
    return '';
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b-4 border-orange-500">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-orange-500 hover:text-orange-600 transition-colors duration-200"
              >
                <ChevronLeft size={24} />
                <span className="font-semibold" style={{ fontFamily: 'Times New Roman' }}>Back</span>
              </button>
              <div className="flex items-center gap-2">
                <Video size={32} className="text-orange-500" />
                <h1 className="text-3xl font-bold text-orange-500" style={{ fontFamily: 'Times New Roman' }}>
                  Video Library
                </h1>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {filteredAndSortedVideos.length} of {videos.length} videos
            </div>
          </div>

          {/* Search and Filters */}
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search size={20} className="absolute left-3 text-gray-400 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search videos by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                style={{ fontFamily: 'Times New Roman' }}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-600" />
                <label className="text-sm font-medium text-gray-700">Category:</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {/* Language Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Language:</label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="all">All Languages</option>
                  {languages.map(language => (
                    <option key={language} value={language} className="capitalize">
                      {language.charAt(0).toUpperCase() + language.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Source:</label>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="all">All Sources</option>
                  {sources.map(source => (
                    <option key={source} value={source} className="capitalize">
                      {source.charAt(0).toUpperCase() + source.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="latest">Latest</option>
                  <option value="oldest">Oldest</option>
                  <option value="alphabetical">Title</option>
                  <option value="duration">Duration</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredAndSortedVideos.length === 0 ? (
          <div className="text-center py-20">
            <Video size={64} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Times New Roman' }}>
              No videos found
            </h3>
            <p className="text-gray-500">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedVideos.map((video) => (
              <div
                key={video.id}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden group cursor-pointer"
                onClick={() => onMediaClick(video, 'video')}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                  <LazyImage
                    src={getBestThumbnailUrl(video)}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    fallback=""
                    aspectRatio="16/9"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    priority={false}
                  />
                  {!getBestThumbnailUrl(video) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Video size={48} className="text-gray-400" />
                    </div>
                  )}

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => handleFavoriteClick(e, video)}
                    className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition-all duration-200 hover:scale-110"
                    aria-label={isFavorited('video', video.id) ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Heart
                      size={14}
                      className={`transition-colors duration-200 ${
                        isFavorited('video', video.id)
                          ? 'text-red-500 fill-red-500'
                          : 'text-gray-400 hover:text-red-500'
                      }`}
                    />
                  </button>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                    <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-0 group-hover:scale-100 transition-all duration-300">
                      <Play size={24} className="text-white ml-1" />
                    </div>
                  </div>

                  {/* Duration Badge */}
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {formatDuration(video.duration)}
                    </div>
                  )}

                  {/* Source Badge */}
                  <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white p-1 rounded">
                    {getSourceIcon(video.video_source || 'local')}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors" style={{ fontFamily: 'Times New Roman' }}>
                    {video.title}
                  </h3>

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full capitalize">
                      {video.category || 'Uncategorized'}
                    </span>
                    <span className="capitalize">
                      {video.language}
                    </span>
                  </div>

                  {video.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {video.description}
                    </p>
                  )}

                  {/* Video Source Info */}
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    {getSourceIcon(video.video_source || 'local')}
                    <span className="capitalize">
                      {video.video_source === 'youtube' ? 'YouTube' : 'Local Video'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPage;