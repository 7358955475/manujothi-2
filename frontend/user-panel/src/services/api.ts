import axios from 'axios';
import { AuthResponse, RegisterRequest } from '../types/auth';
import { dataCache } from '../utils/cache';
import { SecurityUtils } from '../utils/security';

const API_BASE_URL = 'http://localhost:3001/api';
const MEDIA_BASE_URL = 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor to add auth token and performance monitoring
api.interceptors.request.use((config) => {
  const token = SecurityUtils.getSecureToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add request timestamp for performance monitoring
  config.metadata = { startTime: performance.now() };
  
  return config;
});

// Response interceptor to handle errors and cache responses
api.interceptors.response.use(
  (response) => {
    // Log performance metrics
    const endTime = performance.now();
    const duration = endTime - response.config.metadata.startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration.toFixed(2)}ms`);
    }
    
    // Cache GET responses for media endpoints with shorter duration
    if (response.config.method === 'get' &&
        (response.config.url?.includes('/books') ||
         response.config.url?.includes('/audio-books') ||
         response.config.url?.includes('/videos'))) {
      const cacheKey = `api-${response.config.url}-${JSON.stringify(response.config.params)}`;
      dataCache.set(cacheKey, response.data, 30 * 1000); // 30 seconds - allows quicker updates
    }
    
    return response;
  },
  (error) => {
    const endTime = performance.now();
    const duration = error.config ? endTime - error.config.metadata?.startTime : 0;
    
    console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${duration.toFixed(2)}ms:`, 
      error.response?.data || error.message);
    
    return Promise.reject(error);
  }
);

export interface MediaItem {
  id: string;
  title: string;
  author?: string;
  narrator?: string;
  description?: string;
  cover_image_url?: string;
  cover_image_thumbnail?: string;
  cover_image_small?: string;
  cover_image_medium?: string;
  cover_image_large?: string;
  pdf_url?: string;
  file_url?: string;
  file_format?: string;
  file_size?: number;
  mime_type?: string;
  audio_file_path?: string;
  youtube_url?: string;
  youtube_id?: string;
  thumbnail_url?: string;
  thumbnail_thumbnail?: string;
  thumbnail_small?: string;
  thumbnail_medium?: string;
  thumbnail_large?: string;
  video_source?: 'youtube' | 'local';
  video_file_path?: string;
  language: 'tamil' | 'english' | 'telugu' | 'hindi';
  genre?: string;
  category?: string;
  duration?: number;
  published_year?: number;
  is_active: boolean;
  created_at: string;

  // Dashboard-specific fields
  media_type?: 'book' | 'audio' | 'video';
  media_id?: string;
  content_url?: string;
  pdf_file_path?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const booksApi = {
  getAll: (params?: { 
    page?: number; 
    limit?: number; 
    language?: string; 
    search?: string;
  }): Promise<{ data: { books: MediaItem[], pagination: ApiResponse<MediaItem>['pagination'] } }> => 
    api.get('/books', { params }),
    
  getById: (id: string) => api.get(`/books/${id}`),
};

export const audioBooksApi = {
  getAll: (params?: { 
    page?: number; 
    limit?: number; 
    language?: string; 
    search?: string;
  }): Promise<{ data: { audioBooks: MediaItem[], pagination: ApiResponse<MediaItem>['pagination'] } }> => 
    api.get('/audio-books', { params }),
    
  getById: (id: string) => api.get(`/audio-books/${id}`),
  
  streamAudio: (id: string) => api.get(`/audio-books/${id}/stream`, {
    responseType: 'blob'
  }),
};

export const videosApi = {
  getAll: (params?: { 
    page?: number; 
    limit?: number; 
    language?: string; 
    search?: string;
  }): Promise<{ data: { videos: MediaItem[], pagination: ApiResponse<MediaItem>['pagination'] } }> => 
    api.get('/videos', { params }),
    
  getById: (id: string) => api.get(`/videos/${id}`),
};

export const favoritesApi = {
  // Get all favorites for the authenticated user
  getAll: (): Promise<{ data: { favorites: MediaItem[], pagination: ApiResponse<MediaItem>['pagination'] } }> =>
    api.get('/favorites'),

  // Get favorites count
  getCount: (): Promise<{ data: { count: number } }> =>
    api.get('/favorites/count'),

  // Add a favorite
  add: (mediaType: 'book' | 'audio' | 'video', mediaId: string): Promise<{ data: { message: string, favorite: any } }> =>
    api.post('/favorites', { media_type: mediaType, media_id: mediaId }),

  // Toggle favorite status
  toggle: (mediaType: 'book' | 'audio' | 'video', mediaId: string): Promise<{ data: { isFavorited: boolean, message: string, favorite?: any } }> =>
    api.post('/favorites/toggle', { media_type: mediaType, media_id: mediaId }),

  // Check if an item is favorited
  check: (mediaType: 'book' | 'audio' | 'video', mediaId: string): Promise<{ data: { isFavorited: boolean } }> =>
    api.get(`/favorites/check/${mediaType}/${mediaId}`),

  // Remove a favorite
  remove: (mediaType: 'book' | 'audio' | 'video', mediaId: string): Promise<{ data: { message: string, deleted: boolean } }> =>
    api.delete(`/favorites/${mediaType}/${mediaId}`),
};

export const dashboardApi = {
  // Get dashboard overview stats
  getOverview: (): Promise<{ data: any }> =>
    api.get('/dashboard/overview'),

  // Get recently viewed items
  getRecentlyViewed: (params?: { limit?: number }): Promise<{ data: { recentlyViewed: MediaItem[], count: number } }> =>
    api.get('/dashboard/recently-viewed', { params }),

  // Get personalized recommendations
  getRecommendations: (params?: { limit?: number }): Promise<{ data: { recommendations: MediaItem[], count: number } }> =>
    api.get('/dashboard/recommendations', { params }),

  // Get user's media progress
  getProgress: (): Promise<{ data: { inProgress: MediaItem[], completed: MediaItem[], stats: any } }> =>
    api.get('/dashboard/progress'),

  // Track user activity
  trackActivity: (data: {
    media_type: 'book' | 'audio' | 'video';
    media_id: string;
    activity_type: 'viewed' | 'completed' | 'in_progress';
    metadata?: any;
  }): Promise<{ data: { message: string } }> =>
    api.post('/dashboard/track-activity', data),
};

export const authApi = {
  login: (email: string, password: string): Promise<{ data: AuthResponse }> =>
    api.post('/auth/login', { email, password }),
  register: (data: RegisterRequest): Promise<{ data: AuthResponse }> =>
    api.post('/auth/register', data),
};

export interface UserSettings {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'user' | 'admin';
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  preferences: {
    preferred_genres: string[];
    preferred_languages: string[];
    preferred_media_types: string[];
    interaction_data: Record<string, any>;
  };
  notifications: {
    total: number;
    unread: number;
    enabled: boolean;
  };
  activity: {
    book?: { count: number; lastAccessed: string };
    audio?: { count: number; lastAccessed: string };
    video?: { count: number; lastAccessed: string };
  };
  stats: {
    favoritesCount: number;
  };
}

export const settingsApi = {
  // Get all user settings - 100% dynamic from backend
  getSettings: (): Promise<{ data: { success: boolean; data: UserSettings } }> =>
    api.get('/settings'),

  // Update user profile
  updateProfile: (data: {
    first_name: string;
    last_name: string;
    email: string;
  }): Promise<{ data: { success: boolean; data: any; message: string } }> =>
    api.put('/settings/profile', data),

  // Update user preferences
  updatePreferences: (data: {
    preferred_genres: string[];
    preferred_languages: string[];
    preferred_media_types: string[];
  }): Promise<{ data: { success: boolean; data: any; message: string } }> =>
    api.put('/settings/preferences', data),

  // Change password
  changePassword: (data: {
    current_password: string;
    new_password: string;
  }): Promise<{ data: { success: boolean; message: string } }> =>
    api.post('/settings/change-password', data),

  // Delete account
  deleteAccount: (password: string): Promise<{ data: { success: boolean; message: string } }> =>
    api.delete('/settings/account', { data: { password } }),

  // Get activity statistics
  getActivityStats: (): Promise<{ data: { success: boolean; data: any } }> =>
    api.get('/settings/activity'),
};

// Helper functions for media URLs
export const getMediaUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  
  // If it's already a full URL, return as is
  if (path.startsWith('http')) {
    return path;
  }
  
  // If it starts with /public, use it directly
  if (path.startsWith('/public')) {
    return `${MEDIA_BASE_URL}${path}`;
  }
  
  // If it's an absolute file system path, extract filename and construct proper URL
  if (path.startsWith('/home/') || path.startsWith('/Users/')) {
    const fileName = path.split('/').pop();
    return `${MEDIA_BASE_URL}/public/audio/${fileName}`;
  }
  
  // Default: assume it's a relative path
  return `${MEDIA_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
};

export const getImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl) return '';
  
  // If it's already a full URL, return as is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  // If it starts with /public, use it directly
  if (imageUrl.startsWith('/public')) {
    return `${MEDIA_BASE_URL}${imageUrl}`;
  }
  
  // Default: assume it's a relative path to images
  return `${MEDIA_BASE_URL}${imageUrl.startsWith('/') ? imageUrl : '/public/images/' + imageUrl}`;
};

export const getPdfUrl = (pdfPath: string | null | undefined): string => {
  if (!pdfPath) return '';
  
  // If it's already a full URL, return as is
  if (pdfPath.startsWith('http')) {
    return pdfPath;
  }
  
  // If it starts with /public, use it directly
  if (pdfPath.startsWith('/public')) {
    return `${MEDIA_BASE_URL}${pdfPath}`;
  }
  
  // Default: assume it's a relative path to PDFs
  return `${MEDIA_BASE_URL}${pdfPath.startsWith('/') ? pdfPath : '/public/pdfs/' + pdfPath}`;
};

export const getVideoUrl = (videoPath: string | null | undefined): string => {
  if (!videoPath) return '';
  
  // If it's already a full URL, return as is
  if (videoPath.startsWith('http')) {
    return videoPath;
  }
  
  // If it starts with /public, use it directly
  if (videoPath.startsWith('/public')) {
    return `${MEDIA_BASE_URL}${videoPath}`;
  }
  
  // Default: assume it's a relative path to videos
  return `${MEDIA_BASE_URL}${videoPath.startsWith('/') ? videoPath : '/public/videos/' + videoPath}`;
};

export default api;