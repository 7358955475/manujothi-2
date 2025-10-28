interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

class DataCache {
  private cache = new Map<string, CacheItem<unknown>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiry: now + ttl
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    this.clearExpired();
    return this.cache.size;
  }
}

export const dataCache = new DataCache();

// Preload critical content
export const preloadCriticalContent = async (items: Array<{ cover_image_url?: string; thumbnail_url?: string }>) => {
  const criticalItems = items.slice(0, 10); // First 10 items
  
  const imagePromises = criticalItems
    .filter(item => item.cover_image_url || item.thumbnail_url)
    .map(item => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve; // Don't fail if image doesn't load
        img.src = item.cover_image_url || item.thumbnail_url;
      });
    });

  try {
    await Promise.allSettled(imagePromises);
  } catch (error) {
    console.warn('Some images failed to preload:', error);
  }
};