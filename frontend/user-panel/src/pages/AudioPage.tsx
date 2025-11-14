import React, { useState, useMemo } from 'react';
import { Search, Filter, Play, Clock, User, ChevronLeft, Headphones, Music, Heart } from 'lucide-react';
import { MediaItem, getImageUrl } from '../services/api';
import LazyImage from '../components/LazyImage';
import { useFavoritesImproved } from '../hooks/useFavoritesImproved';

interface AudioPageProps {
  audioBooks: MediaItem[];
  onMediaClick: (item: MediaItem, type: 'audio') => void;
  onBack: () => void;
}

const AudioPage: React.FC<AudioPageProps> = ({ audioBooks, onMediaClick, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const { isFavorited, toggleFavorite } = useFavoritesImproved();

  // Handle favorite button click
  const handleFavoriteClick = async (e: React.MouseEvent, audioBook: MediaItem) => {
    e.stopPropagation(); // Prevent triggering the audio book click
    await toggleFavorite('audio', audioBook.id);
  };

  // Get unique genres from audio books
  const genres = useMemo(() => {
    const uniqueGenres = [...new Set(audioBooks
      .filter(book => book.genre)
      .map(book => book.genre)
    )];
    return uniqueGenres.sort();
  }, [audioBooks]);

  // Get unique languages
  const languages = useMemo(() => {
    const uniqueLanguages = [...new Set(audioBooks.map(book => book.language))];
    return uniqueLanguages.sort();
  }, [audioBooks]);

  // Filter and sort audio books
  const filteredAndSortedBooks = useMemo(() => {
    let filtered = audioBooks.filter(book => {
      const matchesSearch = !searchQuery.trim() ||
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (book.narrator && book.narrator.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (book.description && book.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesGenre = selectedGenre === 'all' || book.genre === selectedGenre;
      const matchesLanguage = selectedLanguage === 'all' || book.language === selectedLanguage;

      return matchesSearch && matchesGenre && matchesLanguage;
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
        case 'author':
          return (a.author || '').localeCompare(b.author || '');
        case 'duration':
          return (b.duration || 0) - (a.duration || 0);
        default:
          return 0;
      }
    });
  }, [audioBooks, searchQuery, selectedGenre, selectedLanguage, sortBy]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get responsive image srcset for optimal loading
  const getResponsiveImageSrcset = (audioBook: MediaItem) => {
    const sources = [];
    if (audioBook.cover_image_thumbnail) sources.push(`${getImageUrl(audioBook.cover_image_thumbnail)} 150w`);
    if (audioBook.cover_image_small) sources.push(`${getImageUrl(audioBook.cover_image_small)} 300w`);
    if (audioBook.cover_image_medium) sources.push(`${getImageUrl(audioBook.cover_image_medium)} 600w`);
    if (audioBook.cover_image_large) sources.push(`${getImageUrl(audioBook.cover_image_large)} 900w`);

    return sources.length > 0 ? sources.join(', ') : '';
  };

  // Get best cover image URL, prioritizing responsive images
  const getBestCoverUrl = (audioBook: MediaItem) => {
    if (audioBook.cover_image_medium) return getImageUrl(audioBook.cover_image_medium);
    if (audioBook.cover_image_small) return getImageUrl(audioBook.cover_image_small);
    if (audioBook.cover_image_url && audioBook.cover_image_url.trim()) return getImageUrl(audioBook.cover_image_url);
    return '';
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
                <Headphones size={32} className="text-orange-500" />
                <h1 className="text-3xl font-bold text-orange-500" style={{ fontFamily: 'Times New Roman' }}>
                  Audio Library
                </h1>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {filteredAndSortedBooks.length} of {audioBooks.length} audio books
            </div>
          </div>

          {/* Search and Filters */}
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search size={20} className="absolute left-3 text-gray-400 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search audio books by title, author, narrator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                style={{ fontFamily: 'Times New Roman' }}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              {/* Genre Filter */}
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-600" />
                <label className="text-sm font-medium text-gray-700">Genre:</label>
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="all">All Genres</option>
                  {genres.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
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
                  <option value="author">Author</option>
                  <option value="duration">Duration</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredAndSortedBooks.length === 0 ? (
          <div className="text-center py-20">
            <Music size={64} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Times New Roman' }}>
              No audio books found
            </h3>
            <p className="text-gray-500">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedBooks.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden group cursor-pointer"
                onClick={() => onMediaClick(book, 'audio')}
              >
                {/* Cover Image */}
                <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200">
                  <LazyImage
                    src={getBestCoverUrl(book)}
                    srcset={getResponsiveImageSrcset(book)}
                    alt={book.title}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    fallback=""
                    aspectRatio="1/1"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw"
                    priority={false}
                  />
                  {!getBestCoverUrl(book) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Music size={48} className="text-orange-300" />
                    </div>
                  )}

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => handleFavoriteClick(e, book)}
                    className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition-all duration-200 hover:scale-110"
                    aria-label={isFavorited('audio', book.id) ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Heart
                      size={14}
                      className={`transition-colors duration-200 ${
                        isFavorited('audio', book.id)
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
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 group-hover:text-orange-600 transition-colors" style={{ fontFamily: 'Times New Roman' }}>
                    {book.title}
                  </h3>

                  {book.author && (
                    <p className="text-sm text-gray-600 mb-1" style={{ fontFamily: 'Times New Roman' }}>
                      by {book.author}
                    </p>
                  )}

                  {book.narrator && (
                    <p className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                      <User size={12} />
                      Narrated by {book.narrator}
                    </p>
                  )}

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full capitalize">
                      {book.genre || 'Uncategorized'}
                    </span>
                    <span className="capitalize">
                      {book.language}
                    </span>
                  </div>

                  {book.duration && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={12} />
                      {formatDuration(book.duration)}
                    </div>
                  )}

                  {book.description && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                      {book.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioPage;