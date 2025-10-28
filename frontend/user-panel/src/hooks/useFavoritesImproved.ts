import { useState, useEffect, useCallback, useRef } from 'react';
import { favoritesApi } from '../services/api';
import { MediaItem } from '../services/api';

interface FavoriteStatus {
  [key: string]: boolean; // Key: `${mediaType}-${mediaId}`
}

interface UseFavoritesReturn {
  favorites: MediaItem[];
  favoriteStatus: FavoriteStatus;
  favoritesCount: number;
  isLoading: boolean;
  error: string | null;
  toggleFavorite: (mediaType: 'book' | 'audio' | 'video', mediaId: string) => Promise<void>;
  isFavorited: (mediaType: 'book' | 'audio' | 'video', mediaId: string) => boolean;
  refreshFavorites: () => Promise<void>;
}

// Debounce hook to prevent rapid successive clicks
const useDebounce = <T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

export const useFavoritesImproved = (): UseFavoritesReturn => {
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [favoriteStatus, setFavoriteStatus] = useState<FavoriteStatus>({});
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to generate the key for favorite status
  const getFavoriteKey = useCallback((mediaType: 'book' | 'audio' | 'video', mediaId: string): string => {
    return `${mediaType}-${mediaId}`;
  }, []);

  // Simplified deduplication function
  const deduplicateFavorites = useCallback((favoritesList: MediaItem[]): MediaItem[] => {
    const seen = new Set<string>();
    return favoritesList.filter(item => {
      const key = getFavoriteKey(
        item.audio_file_path ? 'audio' :
        item.video_file_path || item.youtube_url ? 'video' : 'book',
        item.id
      );

      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [getFavoriteKey]);

  // Fetch all favorites
  const fetchFavorites = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await favoritesApi.getAll();
      const favoritesData = response.data.favorites;

      // Remove duplicates
      const uniqueFavorites = deduplicateFavorites(favoritesData);

      setFavorites(uniqueFavorites);

      // Create favorite status mapping
      const newFavoriteStatus: FavoriteStatus = {};
      uniqueFavorites.forEach((item: MediaItem) => {
        const mediaType = item.audio_file_path ? 'audio' :
                         (item.video_file_path || item.youtube_url) ? 'video' : 'book';
        const key = getFavoriteKey(mediaType, item.id);
        newFavoriteStatus[key] = true;
      });

      setFavoriteStatus(newFavoriteStatus);
      setFavoritesCount(uniqueFavorites.length);

    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch favorites');
      console.error('Error fetching favorites:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getFavoriteKey, deduplicateFavorites]);

  // Debounced toggle function to prevent rapid clicks
  const debouncedToggle = useCallback(async (mediaType: 'book' | 'audio' | 'video', mediaId: string) => {
    const key = getFavoriteKey(mediaType, mediaId);

    try {
      setError(null);

      // Check current status before API call
      const isCurrentlyFavorited = favoriteStatus[key] || false;

      // If unliking, remove immediately from UI for instant feedback
      if (isCurrentlyFavorited) {
        setFavorites(prev => prev.filter(item => {
          const itemMediaType = item.audio_file_path ? 'audio' :
                               (item.video_file_path || item.youtube_url) ? 'video' : 'book';
          return !(item.id === mediaId && itemMediaType === mediaType);
        }));

        setFavoriteStatus(prev => ({
          ...prev,
          [key]: false
        }));

        setFavoritesCount(prev => Math.max(0, prev - 1));
      }

      // Make API call
      const response = await favoritesApi.toggle(mediaType, mediaId);
      const { isFavorited } = response.data;

      // Update state based on server response
      if (isFavorited) {
        // Item was added to favorites - refresh entire list
        await fetchFavorites();
      } else {
        // Server confirmed removal - ensure our local state is correct
        setFavorites(prev => {
          const filtered = prev.filter(item => {
            const itemMediaType = item.audio_file_path ? 'audio' :
                                 (item.video_file_path || item.youtube_url) ? 'video' : 'book';
            return !(item.id === mediaId && itemMediaType === mediaType);
          });
          return deduplicateFavorites(filtered);
        });

        setFavoriteStatus(prev => ({
          ...prev,
          [key]: false
        }));

        setFavoritesCount(prev => Math.max(0, prev - 1));
      }

    } catch (err: any) {
      // If there's an error, refresh favorites to ensure consistency
      console.error('Error toggling favorite:', err);
      setError(err.response?.data?.error || 'Failed to toggle favorite');
      await fetchFavorites();
    }
  }, [getFavoriteKey, favoriteStatus, fetchFavorites, deduplicateFavorites]);

  // Export the debounced function
  const toggleFavorite = useDebounce(debouncedToggle, 300); // 300ms debounce

  // Check if an item is favorited
  const isFavorited = useCallback((mediaType: 'book' | 'audio' | 'video', mediaId: string): boolean => {
    const key = getFavoriteKey(mediaType, mediaId);
    return favoriteStatus[key] || false;
  }, [favoriteStatus, getFavoriteKey]);

  // Refresh favorites
  const refreshFavorites = useCallback(async () => {
    await fetchFavorites();
  }, [fetchFavorites]);

  // Initialize favorites on mount
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return {
    favorites,
    favoriteStatus,
    favoritesCount,
    isLoading,
    error,
    toggleFavorite,
    isFavorited,
    refreshFavorites
  };
};

export default useFavoritesImproved;