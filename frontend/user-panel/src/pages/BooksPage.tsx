import React, { useState, useMemo } from 'react';
import { Search, Filter, Book, User, Calendar, ChevronLeft, FileText, Heart } from 'lucide-react';
import { MediaItem } from '../services/api';
import LazyImage from '../components/LazyImage';
import { useFavorites } from '../hooks/useFavorites';

interface BooksPageProps {
  books: MediaItem[];
  onMediaClick: (item: MediaItem, type: 'pdf') => void;
  onBack: () => void;
}

const BooksPage: React.FC<BooksPageProps> = ({ books, onMediaClick, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const { isFavorited, toggleFavorite } = useFavorites();

  // Handle favorite button click
  const handleFavoriteClick = async (e: React.MouseEvent, book: MediaItem) => {
    e.stopPropagation(); // Prevent triggering the book click
    await toggleFavorite('book', book.id);
  };

  // Get unique genres from books
  const genres = useMemo(() => {
    const uniqueGenres = [...new Set(books
      .filter(book => book.genre)
      .map(book => book.genre)
    )];
    return uniqueGenres.sort();
  }, [books]);

  // Get unique languages
  const languages = useMemo(() => {
    const uniqueLanguages = [...new Set(books.map(book => book.language))];
    return uniqueLanguages.sort();
  }, [books]);

  // Get unique file formats
  const formats = useMemo(() => {
    const uniqueFormats = [...new Set(books.map(book => book.file_format).filter(Boolean))];
    return uniqueFormats;
  }, [books]);

  // Filter and sort books
  const filteredAndSortedBooks = useMemo(() => {
    let filtered = books.filter(book => {
      const matchesSearch = !searchQuery.trim() ||
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (book.author && book.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (book.description && book.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesGenre = selectedGenre === 'all' || book.genre === selectedGenre;
      const matchesLanguage = selectedLanguage === 'all' || book.language === selectedLanguage;
      const matchesFormat = selectedFormat === 'all' || book.file_format === selectedFormat;

      return matchesSearch && matchesGenre && matchesLanguage && matchesFormat;
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
        case 'year':
          return (b.published_year || 0) - (a.published_year || 0);
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [books, searchQuery, selectedGenre, selectedLanguage, selectedFormat, sortBy]);

  const getFormatIcon = (format: string) => {
    switch (format?.toLowerCase()) {
      case 'pdf':
        return <FileText size={16} className="text-red-500" />;
      case 'txt':
        return <FileText size={16} className="text-blue-500" />;
      case 'epub':
        return <Book size={16} className="text-green-500" />;
      default:
        return <FileText size={16} className="text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
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
                <Book size={32} className="text-orange-500" />
                <h1 className="text-3xl font-bold text-orange-500" style={{ fontFamily: 'Times New Roman' }}>
                  Book Library
                </h1>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {filteredAndSortedBooks.length} of {books.length} books
            </div>
          </div>

          {/* Search and Filters */}
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search size={20} className="absolute left-3 text-gray-400 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search books by title, author, or description..."
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

              {/* Format Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Format:</label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                >
                  <option value="all">All Formats</option>
                  {formats.map(format => (
                    <option key={format} value={format} className="uppercase">
                      {format}
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
                  <option value="year">Published Year</option>
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
            <Book size={64} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2" style={{ fontFamily: 'Times New Roman' }}>
              No books found
            </h3>
            <p className="text-gray-500">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredAndSortedBooks.map((book) => (
              <div
                key={book.id}
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden group cursor-pointer"
                onClick={() => onMediaClick(book, 'pdf')}
              >
                {/* Cover Image */}
                <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200">
                  <LazyImage
                    src={book.cover_image_url || ''}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    fallback=""
                    aspectRatio="3/4"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw"
                    priority={false}
                  />
                  {!book.cover_image_url && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Book size={48} className="text-orange-300" />
                    </div>
                  )}

                  {/* Favorite Button */}
                  <button
                    onClick={(e) => handleFavoriteClick(e, book)}
                    className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md transition-all duration-200 hover:scale-110"
                    aria-label={isFavorited('book', book.id) ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Heart
                      size={14}
                      className={`transition-colors duration-200 ${
                        isFavorited('book', book.id)
                          ? 'text-red-500 fill-red-500'
                          : 'text-gray-400 hover:text-red-500'
                      }`}
                    />
                  </button>

                  {/* Format Badge */}
                  <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white p-1 rounded">
                    {getFormatIcon(book.file_format || 'pdf')}
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-orange-500 bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300"></div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 group-hover:text-orange-600 transition-colors text-sm" style={{ fontFamily: 'Times New Roman' }}>
                    {book.title}
                  </h3>

                  {book.author && (
                    <p className="text-xs text-gray-600 mb-1" style={{ fontFamily: 'Times New Roman' }}>
                      by {book.author}
                    </p>
                  )}

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full capitalize truncate max-w-[60%]">
                      {book.genre || 'Uncategorized'}
                    </span>
                    <span className="capitalize">
                      {book.language}
                    </span>
                  </div>

                  {/* Published Year */}
                  {book.published_year && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                      <Calendar size={10} />
                      {book.published_year}
                    </div>
                  )}

                  {/* File Size */}
                  {book.file_size && (
                    <div className="text-xs text-gray-500">
                      {formatFileSize(parseInt(book.file_size.toString()))}
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

export default BooksPage;