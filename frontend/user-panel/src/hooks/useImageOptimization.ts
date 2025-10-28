import { useEffect, useRef } from 'react';

/**
 * Hook for image optimization and performance monitoring
 */
export const useImageOptimization = () => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const imageCache = useRef(new Set<string>());

  // Preload critical images
  const preloadImage = (src: string, priority: 'high' | 'low' = 'low') => {
    if (imageCache.current.has(src)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;

    if (priority === 'high') {
      link.fetchPriority = 'high';
    }

    document.head.appendChild(link);
    imageCache.current.add(src);

    // Remove the preload link after image loads
    const img = new Image();
    img.onload = () => {
      setTimeout(() => {
        document.head.removeChild(link);
      }, 1000);
    };
    img.src = src;
  };

  // Preload multiple images
  const preloadImages = (urls: string[], priority: 'high' | 'low' = 'low') => {
    urls.forEach((url, index) => {
      // Stagger preloading to avoid blocking main thread
      setTimeout(() => preloadImage(url, priority), index * 100);
    });
  };

  // Create optimized image URL with quality and size parameters
  const getOptimizedImageUrl = (
    originalUrl: string,
    width?: number,
    height?: number,
    quality: number = 80
  ): string => {
    // If it's an external URL (Pexels, etc.), return as is
    if (originalUrl.startsWith('http')) {
      return originalUrl;
    }

    // For local images, we could add optimization parameters
    // This is a placeholder for future CDN integration
    return originalUrl;
  };

  // Monitor image loading performance
  const monitorImageLoad = (src: string, startTime: number) => {
    const loadTime = performance.now() - startTime;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Image Load] ${src.split('/').pop()} - ${loadTime.toFixed(2)}ms`);
    }

    // Report slow loading images
    if (loadTime > 3000) {
      console.warn(`[Slow Image] ${src} took ${loadTime.toFixed(2)}ms to load`);
    }
  };

  // Cleanup function
  const cleanup = () => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  };

  // Auto-cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  return {
    preloadImage,
    preloadImages,
    getOptimizedImageUrl,
    monitorImageLoad,
    cleanup
  };
};