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
  fetchFavorites: () => Promise<void>;
  toggleFavorite: (mediaType: 'book' | 'audio' | 'video', mediaId: string) => Promise<void>;
  addFavorite: (mediaType: 'book' | 'audio' | 'video', mediaId: string) => Promise<void>;
  removeFavorite: (mediaType: 'book' | 'audio' | 'video', mediaId: string) => Promise<void>;
  isFavorited: (mediaType: 'book' | 'audio' | 'video', mediaId: string) => boolean;
  refreshFavorites: () => Promise<void>;
}

export const useFavorites = (): UseFavoritesReturn => {
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [favoriteStatus, setFavoriteStatus] = useState<FavoriteStatus>({});
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Helper function to generate the key for favorite status
  const getFavoriteKey = useCallback((mediaType: 'book' | 'audio' | 'video', mediaId: string): string => {
    return `${mediaType}-${mediaId}`;
  }, []);

  // Helper function to remove duplicates from favorites array
  const deduplicateFavorites = useCallback((favoritesList: MediaItem[]): MediaItem[] => {
    const uniqueItems = favoritesList.filter((item, index, self) =>
      index === self.findIndex((t) =>
        t.id === item.id &&
        (item.audio_file_path ? 'audio' :
         item.video_file_path || item.youtube_url ? 'video' : 'book') ===
        (t.audio_file_path ? 'audio' :
         t.video_file_path || t.youtube_url ? 'video' : 'book')
      )
    );

    if (uniqueItems.length !== favoritesList.length) {
      console.log(`🧹 Cleaned ${favoritesList.length - uniqueItems.length} duplicate favorites`);
    }

    return uniqueItems;
  }, []);

  // Fetch all favorites with duplicate prevention
  const fetchFavorites = useCallback(async () => {
    try {
      // Only set loading to true if favorites list is empty (initial load)
      if (favorites.length === 0) {
        setIsLoading(true);
      }
      setError(null);

      const response = await favoritesApi.getAll();
      const favoritesData = response.data.favorites;

      // Remove any duplicates from the server response
      const uniqueFavorites = deduplicateFavorites(favoritesData);

      // Replace favorites list completely (don't merge)
      setFavorites(uniqueFavorites);

      // Create new favorite status mapping from scratch
      const newFavoriteStatus: FavoriteStatus = {};
      uniqueFavorites.forEach((item: MediaItem) => {
        const key = getFavoriteKey(
          item.audio_file_path ? 'audio' :
          item.video_file_path || item.youtube_url ? 'video' : 'book',
          item.id
        );
        newFavoriteStatus[key] = true;
      });

      // Replace favorite status mapping completely
      setFavoriteStatus(newFavoriteStatus);

      console.log(`✅ Fetched ${uniqueFavorites.length} unique favorites`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch favorites');
      console.error('Error fetching favorites:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getFavoriteKey, deduplicateFavorites]);

  // Fetch favorites count
  const fetchFavoritesCount = useCallback(async () => {
    try {
      const response = await favoritesApi.getCount();
      setFavoritesCount(response.data.count);
    } catch (err: any) {
      console.error('Error fetching favorites count:', err);
    }
  }, []);

  // Track pending operations to prevent duplicates
  const pendingOperations = useRef<Set<string>>(new Set());

  // Toggle favorite status with race condition and duplicate protection
  const toggleFavorite = useCallback(async (mediaType: 'book' | 'audio' | 'video', mediaId: string) => {
    const key = getFavoriteKey(mediaType, mediaId);

    // Prevent duplicate operations
    if (pendingOperations.current.has(key)) {
      console.log('Toggle operation already pending for:', key);
      return;
    }

    pendingOperations.current.add(key);

    try {
      setError(null);

      // For immediate UI feedback, check current status before API call
      const isCurrentlyFavorited = favoriteStatus[key] || false;

      // If unliking, remove immediately from UI for instant feedback
      if (isCurrentlyFavorited) {
        console.log('👎 Immediately removing from favorites for instant feedback...');
        setFavorites(prev => {
          // Create a completely new array to ensure React detects the change
          const filtered = [...prev].filter(item => {
            const itemMediaType = item.audio_file_path ? 'audio' :
                                 (item.video_file_path || item.youtube_url) ? 'video' : 'book';
            return !(item.id === mediaId && itemMediaType === mediaType);
          });

          // Force a new array reference to trigger React re-render
          const newFavorites = [...filtered];
          console.log(`✅ Removed item from favorites list. New count: ${newFavorites.length}`);
          return newFavorites;
        });

        // Update favorite status immediately
        setFavoriteStatus(prev => ({
          ...prev,
          [key]: false
        }));

        // Update count instantly
        setFavoritesCount(prev => Math.max(0, prev - 1));
      }

      // Make API call
      const response = await favoritesApi.toggle(mediaType, mediaId);
      const { isFavorited, favorite } = response.data;

      // Update favorites list based on actual server response
      if (isFavorited) {
        // Item was added to favorites - refresh entire list to ensure no duplicates
        console.log('👍 Server confirmed: Adding to favorites, refreshing list...');
        await fetchFavorites();

        // Update status
        setFavoriteStatus(prev => ({
          ...prev,
          [key]: true
        }));

        // Update count
        setFavoritesCount(prev => prev + 1);
      } else {
        // Server confirmed removal - ensure our local state is correct
        console.log('👎 Server confirmed: Removed from favorites');

        // Double-check that item is removed (in case there was any race condition)
        setFavorites(prev => {
          const filtered = prev.filter(item => {
            const itemMediaType = item.audio_file_path ? 'audio' :
                                 (item.video_file_path || item.youtube_url) ? 'video' : 'book';
            return !(item.id === mediaId && itemMediaType === mediaType);
          });

          // Remove any duplicates
          const uniqueItems = filtered.filter((item, index, self) =>
            index === self.findIndex((t) =>
              t.id === item.id &&
              (item.audio_file_path ? 'audio' :
               item.video_file_path || item.youtube_url ? 'video' : 'book') ===
              (t.audio_file_path ? 'audio' :
               t.video_file_path || t.youtube_url ? 'video' : 'book')
            )
          );

          if (uniqueItems.length !== filtered.length) {
            console.log(`🧹 Cleaned ${filtered.length - uniqueItems.length} duplicates during removal`);
          }

          return uniqueItems;
        });
      }

    } catch (err: any) {
      // If there's an error, refresh favorites to ensure consistency
      console.log('❌ Error toggling favorite, refreshing list...');
      await fetchFavorites();
      setError(err.response?.data?.error || 'Failed to toggle favorite');
      console.error('Error toggling favorite:', err);
    } finally {
      pendingOperations.current.delete(key);
    }
  }, [getFavoriteKey, fetchFavorites, favoriteStatus]);

  // Add favorite
  const addFavorite = useCallback(async (mediaType: 'book' | 'audio' | 'video', mediaId: string) => {
    try {
      setError(null);
      await favoritesApi.add(mediaType, mediaId);

      const key = getFavoriteKey(mediaType, mediaId);
      setFavoriteStatus(prev => ({
        ...prev,
        [key]: true
      }));

      // Refresh favorites list to get complete item data
      await fetchFavorites();
      setFavoritesCount(prev => prev + 1);

    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add favorite');
      console.error('Error adding favorite:', err);
    }
  }, [getFavoriteKey, fetchFavorites]);

  // Remove favorite
  const removeFavorite = useCallback(async (mediaType: 'book' | 'audio' | 'video', mediaId: string) => {
    try {
      setError(null);
      await favoritesApi.remove(mediaType, mediaId);

      const key = getFavoriteKey(mediaType, mediaId);
      setFavoriteStatus(prev => ({
        ...prev,
        [key]: false
      }));

      // Update favorites list
      setFavorites(prev => prev.filter(item => !(item.id === mediaId &&
        (mediaType === 'book' ? !item.audio_file_path && !item.video_file_path && !item.youtube_url :
         mediaType === 'audio' ? item.audio_file_path :
         item.video_file_path || item.youtube_url))));

      setFavoritesCount(prev => prev - 1);

    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove favorite');
      console.error('Error removing favorite:', err);
    }
  }, [getFavoriteKey]);

  // Check if an item is favorited
  const isFavorited = useCallback((mediaType: 'book' | 'audio' | 'video', mediaId: string): boolean => {
    const key = getFavoriteKey(mediaType, mediaId);
    return favoriteStatus[key] || false;
  }, [favoriteStatus, getFavoriteKey]);

  // Refresh favorites (alias for fetchFavorites)
  const refreshFavorites = useCallback(async () => {
    await fetchFavorites();
  }, [fetchFavorites]);

  // Initialize favorites on mount
  useEffect(() => {
    fetchFavorites();
    fetchFavoritesCount();
  }, [fetchFavorites, fetchFavoritesCount]);

  // Cleanup duplicates periodically and when favorites array changes
  useEffect(() => {
    if (favorites.length > 0) {
      const uniqueFavorites = deduplicateFavorites(favorites);
      if (uniqueFavorites.length !== favorites.length) {
        console.log('🧹 Auto-cleaning duplicates in favorites array');
        setFavorites(uniqueFavorites);
      }
    }
  }, [favorites.length, deduplicateFavorites]);

  // Debug logging for favorites array changes
  useEffect(() => {
    console.log(`📊 Favorites array updated: ${favorites.length} items`);
    favorites.forEach((item, index) => {
      const mediaType = item.audio_file_path ? 'audio' :
                       (item.video_file_path || item.youtube_url) ? 'video' : 'book';
      console.log(`  ${index + 1}. ${mediaType}-${item.id}: ${item.title}`);
    });
  }, [favorites]);

  return {
    favorites,
    favoriteStatus,
    favoritesCount,
    isLoading,
    error,
    fetchFavorites,
    toggleFavorite,
    addFavorite,
    removeFavorite,
    isFavorited,
    refreshFavorites
  };
};

export default useFavorites;