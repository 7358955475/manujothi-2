import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Search, Calendar, Bell, User as UserIcon, ChevronLeft, ChevronRight, LogOut, Play, Book, Headphones, Heart, BarChart3 } from 'lucide-react';
import { booksApi, audioBooksApi, videosApi, MediaItem } from './services/api';
import Login from './components/Login';
import { User } from './types/auth';
import { SecurityUtils } from './utils/security';
import { usePerformance } from './hooks/usePerformance';
import { useClickOutside } from './hooks/useClickOutside';
import { useFavorites } from './hooks/useFavorites';
import { useDashboard } from './hooks/useDashboard';
import { dataCache, preloadCriticalContent } from './utils/cache';

// Lazy load heavy components
const AudioPlayer = lazy(() => import('./components/AudioPlayer'));
const MediaViewer = lazy(() => import('./components/MediaViewer'));
const Billboard = lazy(() => import('./components/Billboard'));
const MediaShelf = lazy(() => import('./components/MediaShelf'));

// Lazy load page components
const AudioPage = lazy(() => import('./pages/AudioPage'));
const VideoPage = lazy(() => import('./pages/VideoPage'));
const BooksPage = lazy(() => import('./pages/BooksPage'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

const MediaLibraryApp = () => {
  const { logCustomMetric } = usePerformance('MediaLibraryApp');
  const { favoritesCount } = useFavorites();
  const { trackActivity } = useDashboard();

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState('home');
  const [currentAudio, setCurrentAudio] = useState<MediaItem | null>(null);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [mediaType, setMediaType] = useState<'pdf' | 'audio' | 'video' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sortBy, setSortBy] = useState({
    books: 'default',
    audio: 'default',
    videos: 'default'
  });

  // State for API data
  const [books, setBooks] = useState<MediaItem[]>([]);
  const [audio, setAudio] = useState<MediaItem[]>([]);
  const [videos, setVideos] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [billboardIndex, setBillboardIndex] = useState(0);
  const [latestContent, setLatestContent] = useState<MediaItem[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Click outside refs for dropdowns
  const calendarRef = useClickOutside(() => setShowCalendar(false));
  const notificationsRef = useClickOutside(() => setShowNotifications(false));
  const userMenuRef = useClickOutside(() => setShowUserMenu(false));

  const languages = [
    { code: 'all', name: 'All Languages' },
    { code: 'tamil', name: 'Tamil' },
    { code: 'english', name: 'English' },
    { code: 'telugu', name: 'Telugu' },
    { code: 'hindi', name: 'Hindi' }
  ];

  // Fetch notifications from API
  const fetchNotifications = async () => {
    try {
      const userId = user?.id || 'anonymous';
      const response = await fetch(`http://localhost:3001/api/latest-content?limit=10&user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  // Mark notifications as read when viewing content
  const markNotificationsAsReadForContent = async (contentId: string, contentType: string) => {
    try {
      const userId = user?.id || 'anonymous';
      await fetch('http://localhost:3001/api/latest-content/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          content_id: contentId,
          content_type: contentType
        })
      });

      // Update local state to mark matching notifications as read
      setNotifications(prev =>
        prev.map(n => n.id === contentId && n.content_type === contentType
          ? { ...n, read: true }
          : n
        )
      );
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
  };

  // Refetch notifications when user changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [user]);

  const calendarEvents = [
    { id: 1, date: '2025-08-30', title: 'New Content Release', type: 'content' },
    { id: 2, date: '2025-08-31', title: 'System Maintenance', type: 'maintenance' },
    { id: 3, date: '2025-09-02', title: 'Weekly Update', type: 'update' },
    { id: 4, date: '2025-09-05', title: 'New Audio Session', type: 'content' }
  ];

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getDateString = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const hasEvent = (date: Date) => {
    const dateString = getDateString(date);
    return calendarEvents.some(event => event.date === dateString);
  };

  const getEventsForDate = (date: Date) => {
    const dateString = getDateString(date);
    return calendarEvents.filter(event => event.date === dateString);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  // Check authentication on app load
  useEffect(() => {
    // Initialize security measures
    SecurityUtils.initialize();
    
    // Register service worker for offline support
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
        })
        .catch(error => {
          console.log('Service Worker registration failed:', error);
        });
    }
    
    const checkAuth = () => {
      const token = SecurityUtils.getSecureToken();
      const userData = localStorage.getItem('userData');
      
      if (token && userData && SecurityUtils.validateSession()) {
        try {
          setUser(JSON.parse(userData));
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Error parsing user data:', error);
          SecurityUtils.clearSecureToken();
        }
      } else {
        SecurityUtils.clearSecureToken();
      }
      setAuthLoading(false);
    };

    checkAuth();
  }, []);

  // Load data from backend when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadData = async () => {
      const startTime = performance.now();
      
      try {
        setLoading(true);
        
        // Check cache first
        const cacheKey = 'media-data-v2'; // Updated cache key to force refresh
        const cachedData = dataCache.get(cacheKey);
        
        if (cachedData) {
          setBooks(cachedData.books || []);
          setAudio(cachedData.audio || []);
          setVideos(cachedData.videos || []);
          setLatestContent(cachedData.latest || []);
          setLoading(false);
          logCustomMetric('Cache Load Time', performance.now() - startTime);
          
          // Preload critical images
          preloadCriticalContent([...cachedData.books, ...cachedData.audioBooks, ...cachedData.videos]);
          return;
        }

        // Fetch fresh data - get all books and audio books
        const [booksResponse, audioBooksResponse, videosResponse] = await Promise.all([
          booksApi.getAll({ limit: 100 }), // Get all books (you have 18 total)
          audioBooksApi.getAll({ limit: 100 }),
          videosApi.getAll({ limit: 15 })
        ]);

        const booksData = booksResponse.data.books || [];
        const audioData = audioBooksResponse.data.audioBooks || [];
        const videosData = videosResponse.data.videos || [];

        setBooks(booksData);
        setAudio(audioData);
        setVideos(videosData);

        // Get latest content for billboard (3 most recent items)
        const allContent = [...booksData, ...audioData, ...videosData];
        const latest = allContent
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3);
        setLatestContent(latest);

        // Cache the data
        dataCache.set(cacheKey, {
          books: booksData,
          audioBooks: audioData,
          videos: videosData,
          latest
        }, 3 * 60 * 1000); // 3 minutes cache

        logCustomMetric('API Load Time', performance.now() - startTime);
        
        // Preload critical images asynchronously
        setTimeout(() => {
          preloadCriticalContent(allContent);
        }, 100);

        // Fetch notifications after data is loaded
        fetchNotifications();

      } catch (error) {
        console.error('Error loading data:', error);
        setBooks([]);
        setAudio([]);
        setVideos([]);
        setLatestContent([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated, logCustomMetric]);

  // Prevent right-click on media elements
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Prevent context menu on images, videos, and iframes
      if (
        target.tagName === 'IMG' ||
        target.tagName === 'VIDEO' ||
        target.tagName === 'AUDIO' ||
        target.tagName === 'IFRAME' ||
        target.closest('.media-protected') ||
        target.closest('.no-download')
      ) {
        e.preventDefault();
      }
    };

    const preventKeyDown = (e: KeyboardEvent) => {
      // Prevent common download shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C')
      ) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'IMG' ||
          target.tagName === 'VIDEO' ||
          target.tagName === 'AUDIO' ||
          target.tagName === 'IFRAME' ||
          target.closest('.media-protected')
        ) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventKeyDown);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventKeyDown);
    };
  }, []);

  // Billboard auto-rotation
  useEffect(() => {
    if (latestContent.length <= 1) return;

    const interval = setInterval(() => {
      setBillboardIndex(prev => (prev + 1) % latestContent.length);
    }, 5000); // 5 seconds per slide

    return () => clearInterval(interval);
  }, [latestContent.length]);


  // Helper function to sort items
  const sortItems = (items: MediaItem[], sortType: string) => {
    const sorted = [...items];
    switch (sortType) {
      case 'latest':
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'alphabetical':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      default:
        return sorted;
    }
  };

  // Filtered and sorted data
  const filteredBooks = sortItems(
    books.filter(item => {
      const matchesLanguage = selectedLanguage === 'all' || item.language === selectedLanguage;
      const matchesSearch = !searchQuery.trim() || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.author && item.author.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesLanguage && matchesSearch;
    }),
    sortBy.books
  );

  const filteredAudio = sortItems(
    audio.filter(item => {
      const matchesLanguage = selectedLanguage === 'all' || item.language === selectedLanguage;
      const matchesSearch = !searchQuery.trim() || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.author && item.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.narrator && item.narrator.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesLanguage && matchesSearch;
    }),
    sortBy.audio
  );

  const filteredVideos = sortItems(
    videos.filter(item => {
      const matchesLanguage = selectedLanguage === 'all' || item.language === selectedLanguage;
      const matchesSearch = !searchQuery.trim() || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesLanguage && matchesSearch;
    }),
    sortBy.videos
  );

  const handleLogin = (token: string, userData: User) => {
    SecurityUtils.setSecureToken(token);
    localStorage.setItem('userData', JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    SecurityUtils.clearSecureToken();
    setUser(null);
    setIsAuthenticated(false);
    setShowUserMenu(false);
    // Reset all data when logging out
    setBooks([]);
    setAudio([]);
    setVideos([]);
    setSelectedMedia(null);
    setMediaType(null);
  };

  const handleMediaClick = async (item: MediaItem, type: 'pdf' | 'audio' | 'video') => {
    // Mark notifications as read for this content
    const contentType = type === 'pdf' ? 'book' : type;
    markNotificationsAsReadForContent(item.id, contentType);

    // Track activity for dashboard
    try {
      await trackActivity(contentType, item.id, 'viewed');
    } catch (error) {
      console.error('Failed to track activity:', error);
      // Don't block the media interaction if tracking fails
    }

    if (type === 'audio') {
      const audioIndex = filteredAudio.findIndex(book => book.id === item.id);
      setCurrentAudio(item);
      setCurrentAudioIndex(audioIndex >= 0 ? audioIndex : 0);
      setCurrentPage('player');
    } else {
      setSelectedMedia(item);
      setMediaType(type);
    }
  };

  const handleTrackChange = (index: number) => {
    if (index >= 0 && index < filteredAudio.length) {
      setCurrentAudio(filteredAudio[index]);
      setCurrentAudioIndex(index);
    }
  };

  const closeMediaViewer = () => {
    setSelectedMedia(null);
    setMediaType(null);
  };

  // Handle notification click to redirect to respective content
  const handleNotificationClick = async (notification: any) => {
    setShowNotifications(false); // Close notification dropdown

    // Mark notification as read via API
    try {
      const userId = user?.id || 'anonymous';
      await fetch('http://localhost:3001/api/latest-content/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          content_id: notification.id,
          content_type: notification.content_type
        })
      });

      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }

    // Find the full media item from the respective data based on content_type
    let mediaItem: MediaItem | null = null;
    let mediaType: 'pdf' | 'audio' | 'video' | null = null;

    if (notification.content_type === 'book' && notification.item) {
      // Find the book in the books array
      mediaItem = books.find(book => book.id === notification.item.id) || null;
      mediaType = 'pdf';
    } else if (notification.content_type === 'audio' && notification.item) {
      // Find the audio book in the audio array
      mediaItem = audio.find(audio => audio.id === notification.item.id) || null;
      mediaType = 'audio';
    } else if (notification.content_type === 'video' && notification.item) {
      // Find the video in the videos array
      mediaItem = videos.find(video => video.id === notification.item.id) || null;
      mediaType = 'video';
    }

    if (mediaItem && mediaType) {
      handleMediaClick(mediaItem, mediaType);
    }
  };

  // Profile Component
  const ProfilePage = () => (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center">
              <UserIcon size={48} className="text-orange-500" />
            </div>
            <div className="text-white">
              <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Times New Roman' }}>
                {user?.first_name} {user?.last_name}
              </h1>
              <p className="text-orange-100 text-lg" style={{ fontFamily: 'Times New Roman' }}>
                {user?.email}
              </p>
              <span className="inline-block bg-white/20 text-white text-sm px-3 py-1 rounded-full mt-2 capitalize">
                {user?.role} Account
              </span>
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account Information */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4" style={{ fontFamily: 'Times New Roman' }}>
                Account Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">First Name</label>
                  <input
                    type="text"
                    value={user?.first_name || ''}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                    style={{ fontFamily: 'Times New Roman' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={user?.last_name || ''}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                    style={{ fontFamily: 'Times New Roman' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                    style={{ fontFamily: 'Times New Roman' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Account Type</label>
                  <input
                    type="text"
                    value={user?.role || ''}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed capitalize"
                    style={{ fontFamily: 'Times New Roman' }}
                  />
                </div>
              </div>
            </div>

            {/* Activity & Settings */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4" style={{ fontFamily: 'Times New Roman' }}>
                Account Settings
              </h2>
              <div className="space-y-4">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-800 mb-2">Privacy Settings</h3>
                  <p className="text-sm text-gray-600 mb-3">Manage your privacy preferences</p>
                  <button className="text-orange-500 hover:text-orange-600 text-sm font-medium">
                    Update Preferences
                  </button>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-800 mb-2">Notifications</h3>
                  <p className="text-sm text-gray-600 mb-3">Configure notification settings</p>
                  <button className="text-orange-500 hover:text-orange-600 text-sm font-medium">
                    Manage Notifications
                  </button>
                </div>
                <div className="p-4 border border-gray-200 rounded-lg">
                  <h3 className="font-medium text-gray-800 mb-2">Security</h3>
                  <p className="text-sm text-gray-600 mb-3">Change password and security settings</p>
                  <button className="text-orange-500 hover:text-orange-600 text-sm font-medium">
                    Security Settings
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Back to Home Button */}
          <div className="flex justify-center mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => setCurrentPage('home')}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
              style={{ fontFamily: 'Times New Roman' }}
            >
              Back to Media Library
            </button>
          </div>
        </div>
      </div>
    </div>
  );



  // Scroll functionality for shelves
  const [scrollPositions, setScrollPositions] = useState({
    books: 0,
    audioBooks: 0,
    videos: 0
  });

  const scrollLeft = (type: 'books' | 'audioBooks' | 'videos') => {
    setScrollPositions(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] - 320)
    }));
  };

  const scrollRight = (type: 'books' | 'audioBooks' | 'videos') => {
    setScrollPositions(prev => ({
      ...prev,
      [type]: prev[type] + 320
    }));
  };

  const getMaxScroll = (itemsCount: number) => {
    return Math.max(0, (itemsCount * 200) - 1000); // Approximate calculation
  };



  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return authLoading ? (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500"></div>
      </div>
    ) : <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100" style={{ fontFamily: 'Times New Roman' }}>
      {currentPage === 'player' && currentAudio ? (
        <Suspense fallback={
          <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500"></div>
          </div>
        }>
          <AudioPlayer 
            audioBook={currentAudio}
            allAudioBooks={filteredAudio}
            currentIndex={currentAudioIndex}
            onBack={() => {
              setCurrentPage('home');
              setCurrentAudio(null);
            }}
            onTrackChange={handleTrackChange}
          />
        </Suspense>
      ) : (
        <>
          {/* Header */}
          <header className="bg-white shadow-lg border-b-4 border-orange-500">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center">
              <h1 className="text-2xl sm:text-4xl font-bold text-orange-500 mr-4 sm:mr-8" style={{ fontFamily: 'Times New Roman' }}>
                MANUJOTHI
              </h1>

              {/* Navigation Buttons - show when not on home page */}
              {currentPage !== 'home' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage('home')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 ${
                      currentPage === 'home'
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-600 hover:text-orange-500 hover:bg-orange-50'
                    }`}
                    style={{ fontFamily: 'Times New Roman' }}
                  >
                    <Book size={16} />
                    Home
                  </button>

                  {currentPage !== 'favorites' && (
                    <button
                      onClick={() => setCurrentPage('favorites')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 ${
                        currentPage === 'favorites'
                          ? 'bg-red-500 text-white'
                          : 'text-gray-600 hover:text-red-500 hover:bg-red-50'
                      }`}
                      style={{ fontFamily: 'Times New Roman' }}
                    >
                      <Heart size={16} />
                      Favorites
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="relative">
                <div className="flex items-center">
                  <Search size={16} className="absolute left-3 text-gray-400 sm:w-5 sm:h-5" />
                  <input
                    type="text"
                    placeholder="Search books, audiobooks, videos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 sm:pl-10 pr-4 py-2 w-48 sm:w-64 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                    style={{ fontFamily: 'Times New Roman' }}
                  />
                </div>
              </div>
              
              <div className="relative" ref={calendarRef}>
                <button
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="p-2 text-gray-600 hover:text-orange-500 transition-colors duration-200"
                >
                  <Calendar size={20} className="sm:w-6 sm:h-6" />
                </button>
                {showCalendar && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl z-50 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <button 
                        onClick={() => navigateMonth('prev')}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <h3 className="font-semibold text-gray-800" style={{ fontFamily: 'Times New Roman' }}>
                        {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h3>
                      <button 
                        onClick={() => navigateMonth('next')}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                        <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: getFirstDayOfMonth(currentDate) }, (_, i) => (
                        <div key={`empty-${i}`} className="h-8"></div>
                      ))}
                      
                      {Array.from({ length: getDaysInMonth(currentDate) }, (_, i) => {
                        const day = i + 1;
                        const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        const isToday = getDateString(cellDate) === getDateString(new Date());
                        const eventExists = hasEvent(cellDate);
                        
                        return (
                          <button
                            key={day}
                            onClick={() => setSelectedDate(cellDate)}
                            className={`h-8 w-8 text-xs rounded-lg transition-colors duration-200 ${
                              isToday 
                                ? 'bg-orange-500 text-white' 
                                : eventExists
                                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    
                    {selectedDate && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="font-medium text-sm mb-2" style={{ fontFamily: 'Times New Roman' }}>
                          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h4>
                        {getEventsForDate(selectedDate).length > 0 ? (
                          <div className="space-y-2">
                            {getEventsForDate(selectedDate).map(event => (
                              <div key={event.id} className="p-2 bg-orange-50 rounded-lg">
                                <div className="font-medium text-sm" style={{ fontFamily: 'Times New Roman' }}>{event.title}</div>
                                <div className="text-xs text-gray-600 capitalize" style={{ fontFamily: 'Times New Roman' }}>{event.type}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500" style={{ fontFamily: 'Times New Roman' }}>No events on this date</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-gray-600 hover:text-orange-500 transition-colors duration-200 relative"
                >
                  <Bell size={20} className="sm:w-6 sm:h-6" />
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications.filter(n => !n.read).length}
                  </span>
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl z-50">
                    {/* Notification Header */}
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-800" style={{ fontFamily: 'Times New Roman' }}>
                        Notifications
                      </h3>
                    </div>

                    {/* Notification Items with click functionality */}
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <Bell size={32} className="mx-auto mb-2 opacity-50" />
                          <p>No new notifications</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="p-4 hover:bg-orange-50 cursor-pointer border-b border-orange-100 transition-colors"
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                {notification.content_type === 'book' && <Book size={20} className="text-orange-500" />}
                                {notification.content_type === 'audio' && <Headphones size={20} className="text-green-500" />}
                                {notification.content_type === 'video' && <Play size={20} className="text-blue-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {notification.title}
                                </p>
                                <p className="text-sm text-gray-600 line-clamp-2">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {notification.time}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className="flex-shrink-0">
                                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Dashboard Button */}
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`p-2 transition-colors duration-200 ${
                  currentPage === 'dashboard'
                    ? 'text-purple-500'
                    : 'text-gray-600 hover:text-purple-500'
                }`}
              >
                <BarChart3 size={20} className="sm:w-6 sm:h-6" />
              </button>

              {/* Favorites Button */}
              <button
                onClick={() => setCurrentPage('favorites')}
                className={`p-2 transition-colors duration-200 relative ${
                  currentPage === 'favorites'
                    ? 'text-red-500'
                    : 'text-gray-600 hover:text-red-500'
                }`}
              >
                <Heart size={20} className="sm:w-6 sm:h-6" />
                {favoritesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {favoritesCount > 99 ? '99+' : favoritesCount}
                  </span>
                )}
              </button>

              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="p-2 text-gray-600 hover:text-orange-500 transition-colors duration-200"
                >
                  <UserIcon size={20} className="sm:w-6 sm:h-6" />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-50 p-4">
                    <div className="pb-3 mb-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-800" style={{ fontFamily: 'Times New Roman' }}>
                        {user?.first_name} {user?.last_name}
                      </h3>
                      <p className="text-sm text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
                        {user?.email}
                      </p>
                      <p className="text-xs text-gray-500 capitalize" style={{ fontFamily: 'Times New Roman' }}>
                        {user?.role}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setCurrentPage('profile');
                        setShowUserMenu(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200 mb-2"
                      style={{ fontFamily: 'Times New Roman' }}
                    >
                      <UserIcon size={16} />
                      View Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                      style={{ fontFamily: 'Times New Roman' }}
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Language Filter - Only show on home page */}
      {currentPage === 'home' && (
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-1 sm:py-2">
            <div className="flex flex-wrap gap-2 sm:gap-4">
              {languages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`px-3 sm:px-6 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 ${
                    selectedLanguage === lang.code 
                      ? 'bg-orange-500 text-white shadow-lg transform scale-105' 
                      : 'bg-gray-100 text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                  }`}
                  style={{ fontFamily: 'Times New Roman' }}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-1 sm:py-2">
            {currentPage === 'profile' ? (
              <ProfilePage />
            ) : currentPage === 'books' ? (
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500"></div>
                </div>
              }>
                <BooksPage
                  books={books}
                  onMediaClick={(item, type) => handleMediaClick(item, 'pdf')}
                  onBack={() => setCurrentPage('home')}
                />
              </Suspense>
            ) : currentPage === 'audio' ? (
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500"></div>
                </div>
              }>
                <AudioPage
                  audioBooks={audio}
                  onMediaClick={(item, type) => handleMediaClick(item, 'audio')}
                  onBack={() => setCurrentPage('home')}
                />
              </Suspense>
            ) : currentPage === 'videos' ? (
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500"></div>
                </div>
              }>
                <VideoPage
                  videos={videos}
                  onMediaClick={(item, type) => handleMediaClick(item, 'video')}
                  onBack={() => setCurrentPage('home')}
                />
              </Suspense>
            ) : currentPage === 'favorites' ? (
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500"></div>
                </div>
              }>
                <FavoritesPage
                  onMediaClick={(item, type) => handleMediaClick(item, type)}
                  onBack={() => setCurrentPage('home')}
                />
              </Suspense>
            ) : currentPage === 'dashboard' ? (
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500"></div>
                </div>
              }>
                <DashboardPage
                  onMediaClick={(item, type) => handleMediaClick(item, type)}
                  onBack={() => setCurrentPage('home')}
                />
              </Suspense>
            ) : loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
                  <p className="text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
                    Loading Media Library...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <Suspense fallback={
                  <div className="w-full h-[60vh] bg-gray-200 rounded-xl mb-6 animate-pulse"></div>
                }>
                  <Billboard
                    latestContent={latestContent}
                    billboardIndex={billboardIndex}
                    setBillboardIndex={setBillboardIndex}
                    onMediaClick={handleMediaClick}
                  />
                </Suspense>

                <Suspense fallback={
                  <div className="mb-6 bg-gray-200 h-64 rounded-xl animate-pulse"></div>
                }>
                  <MediaShelf
                    title="Books"
                    items={filteredBooks}
                    type="books"
                    mediaType="pdf"
                    scrollPosition={scrollPositions.books}
                    onScrollLeft={() => scrollLeft('books')}
                    onScrollRight={() => scrollRight('books')}
                    maxScroll={getMaxScroll(filteredBooks.length)}
                    sortBy={sortBy.books}
                    onSortChange={(value) => setSortBy(prev => ({ ...prev, books: value }))}
                    onMediaClick={handleMediaClick}
                    onHeaderClick={() => setCurrentPage('books')}
                  />
                </Suspense>

                <Suspense fallback={
                  <div className="mb-6 bg-gray-200 h-64 rounded-xl animate-pulse"></div>
                }>
                  <MediaShelf
                    title="Audio"
                    items={filteredAudio}
                    type="audioBooks"
                    mediaType="audio"
                    scrollPosition={scrollPositions.audioBooks}
                    onScrollLeft={() => scrollLeft('audioBooks')}
                    onScrollRight={() => scrollRight('audioBooks')}
                    maxScroll={getMaxScroll(filteredAudio.length)}
                    sortBy={sortBy.audio}
                    onSortChange={(value) => setSortBy(prev => ({ ...prev, audio: value }))}
                    onMediaClick={handleMediaClick}
                    onHeaderClick={() => setCurrentPage('audio')}
                  />
                </Suspense>

                <Suspense fallback={
                  <div className="mb-6 bg-gray-200 h-64 rounded-xl animate-pulse"></div>
                }>
                  <MediaShelf
                    title="Videos"
                    items={filteredVideos}
                    type="videos"
                    mediaType="video"
                    scrollPosition={scrollPositions.videos}
                    onScrollLeft={() => scrollLeft('videos')}
                    onScrollRight={() => scrollRight('videos')}
                    maxScroll={getMaxScroll(filteredVideos.length)}
                    sortBy={sortBy.videos}
                    onSortChange={(value) => setSortBy(prev => ({ ...prev, videos: value }))}
                    onMediaClick={handleMediaClick}
                    onHeaderClick={() => setCurrentPage('videos')}
                  />
                </Suspense>
              </>
            )}
          </main>

          {/* Media Viewer Modal */}
      {selectedMedia && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500"></div>
          </div>
        }>
          <MediaViewer 
            selectedMedia={selectedMedia}
            mediaType={mediaType!}
            onClose={closeMediaViewer}
          />
        </Suspense>
      )}
        </>
      )}
    </div>
  );
};

export default MediaLibraryApp;