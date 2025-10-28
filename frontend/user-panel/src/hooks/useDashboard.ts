import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../services/api';
import { MediaItem } from '../services/api';

interface DashboardStats {
  in_progress_count: number;
  completed_count: number;
  not_started_count: number;
  total_time_spent: number;
  recent_views: number;
  completion_rate: number;
}

interface ProgressStats {
  totalInProgress: number;
  totalCompleted: number;
  totalTimeSpent: number;
}

interface UseDashboardReturn {
  // Data
  overview: DashboardStats | null;
  recentlyViewed: MediaItem[];
  recommendations: MediaItem[];
  inProgress: MediaItem[];
  completed: MediaItem[];
  progressStats: ProgressStats;

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  // Actions
  refreshDashboard: () => Promise<void>;
  trackActivity: (mediaType: 'book' | 'audio' | 'video', mediaId: string, activityType: 'viewed' | 'completed' | 'in_progress', metadata?: any) => Promise<void>;
}

export const useDashboard = (): UseDashboardReturn => {
  const [overview, setOverview] = useState<DashboardStats | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<MediaItem[]>([]);
  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);
  const [inProgress, setInProgress] = useState<MediaItem[]>([]);
  const [completed, setCompleted] = useState<MediaItem[]>([]);
  const [progressStats, setProgressStats] = useState<ProgressStats>({
    totalInProgress: 0,
    totalCompleted: 0,
    totalTimeSpent: 0
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard overview
  const fetchOverview = useCallback(async () => {
    try {
      const response = await dashboardApi.getOverview();
      setOverview(response.data.overview);
    } catch (err: any) {
      console.error('Error fetching dashboard overview:', err);
      setError(err.response?.data?.error || 'Failed to fetch overview');
    }
  }, []);

  // Fetch recently viewed items
  const fetchRecentlyViewed = useCallback(async () => {
    try {
      const response = await dashboardApi.getRecentlyViewed({ limit: 10 });
      setRecentlyViewed(response.data.recentlyViewed);
    } catch (err: any) {
      console.error('Error fetching recently viewed:', err);
      setError(err.response?.data?.error || 'Failed to fetch recently viewed');
    }
  }, []);

  // Fetch recommendations
  const fetchRecommendations = useCallback(async () => {
    try {
      const response = await dashboardApi.getRecommendations({ limit: 12 });
      setRecommendations(response.data.recommendations);
    } catch (err: any) {
      console.error('Error fetching recommendations:', err);
      setError(err.response?.data?.error || 'Failed to fetch recommendations');
    }
  }, []);

  // Fetch user progress
  const fetchProgress = useCallback(async () => {
    try {
      const response = await dashboardApi.getProgress();
      setInProgress(response.data.inProgress);
      setCompleted(response.data.completed);
      setProgressStats(response.data.stats);
    } catch (err: any) {
      console.error('Error fetching progress:', err);
      setError(err.response?.data?.error || 'Failed to fetch progress');
    }
  }, []);

  // Refresh all dashboard data
  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      await Promise.all([
        fetchOverview(),
        fetchRecentlyViewed(),
        fetchRecommendations(),
        fetchProgress()
      ]);
    } catch (err) {
      console.error('Error refreshing dashboard:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchOverview, fetchRecentlyViewed, fetchRecommendations, fetchProgress]);

  // Track user activity
  const trackActivity = useCallback(async (
    mediaType: 'book' | 'audio' | 'video',
    mediaId: string,
    activityType: 'viewed' | 'completed' | 'in_progress',
    metadata?: any
  ) => {
    try {
      await dashboardApi.trackActivity({
        media_type: mediaType,
        media_id: mediaId,
        activity_type: activityType,
        metadata
      });

      // Refresh data after tracking activity
      if (activityType === 'completed') {
        await Promise.all([fetchProgress(), fetchRecentlyViewed()]);
      } else if (activityType === 'in_progress') {
        await fetchProgress();
      } else if (activityType === 'viewed') {
        await fetchRecentlyViewed();
      }
    } catch (err: any) {
      console.error('Error tracking activity:', err);
      // Don't set error for tracking - it's non-critical
    }
  }, [fetchProgress, fetchRecentlyViewed]);

  // Initialize dashboard data
  useEffect(() => {
    const initializeDashboard = async () => {
      setIsLoading(true);
      await refreshDashboard();
      setIsLoading(false);
    };

    initializeDashboard();
  }, [refreshDashboard]);

  return {
    // Data
    overview,
    recentlyViewed,
    recommendations,
    inProgress,
    completed,
    progressStats,

    // Loading states
    isLoading,
    isRefreshing,
    error,

    // Actions
    refreshDashboard,
    trackActivity
  };
};

export default useDashboard;