import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: any) =>
    api.post('/auth/register', data),
};

export const usersApi = {
  getAll: (params?: any) => api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  getCurrentUser: () => api.get('/users/me'),
};

export const booksApi = {
  getAll: (params?: any) => api.get('/books', { params }),
  getById: (id: string) => api.get(`/books/${id}`),
  create: (data: FormData) => api.post('/books', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id: string, data: FormData) => api.put(`/books/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id: string) => api.delete(`/books/${id}`),
  getEndpoint: (path: string = '') => `${API_BASE_URL}/books${path ? '/' + path.replace(/^\//, '') : ''}`,
};

export const videosApi = {
  getAll: (params?: any) => api.get('/videos/admin/all', { params }),
  getById: (id: string) => api.get(`/videos/${id}`),
  create: (data: any) => api.post('/videos', data),
  update: (id: string, data: any) => api.put(`/videos/${id}`, data),
  delete: (id: string) => api.delete(`/videos/${id}`),
  getEndpoint: (path: string = '') => `${API_BASE_URL}/videos${path ? '/' + path.replace(/^\//, '') : ''}`,
};

export const audioBooksApi = {
  getAll: (params?: any) => api.get('/audio-books', { params }),
  getById: (id: string) => api.get(`/audio-books/${id}`),
  create: (data: FormData) => api.post('/audio-books', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id: string, data: FormData) => api.put(`/audio-books/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  delete: (id: string) => api.delete(`/audio-books/${id}`),
  getEndpoint: (path: string = '') => `${API_BASE_URL}/audio-books${path ? '/' + path.replace(/^\//, '') : ''}`,
};

export const analyticsApi = {
  getContentPerformance: (params?: any) => api.get('/analytics/content-performance', { params }),
  getUserEngagement: (params?: any) => api.get('/analytics/user-engagement', { params }),
  getActivityTrends: (params?: any) => api.get('/analytics/activity-trends', { params }),
  getPeakUsage: (params?: any) => api.get('/analytics/peak-usage', { params }),
  getComparativeStats: (params?: any) => api.get('/analytics/comparative-stats', { params }),
  getRealTime: () => api.get('/analytics/real-time'),
};

export default api;