import React, { useState, useRef, useEffect } from 'react';
import { useImageOptimization } from '../hooks/useImageOptimization';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
  placeholder?: string;
  autoSize?: boolean;
  priority?: boolean; // For above-the-fold images
  sizes?: string; // For responsive images
  aspectRatio?: string; // For consistent aspect ratios
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  fallback = 'https://images.pexels.com/photos/1130980/pexels-photo-1130980.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop',
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+',
  autoSize = false,
  priority = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  aspectRatio
}) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const loadStartTimeRef = useRef<number>(0);
  const { monitorImageLoad, getOptimizedImageUrl } = useImageOptimization();

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Get optimized image URL
    const optimizedSrc = getOptimizedImageUrl(src);

    // For priority images, load immediately
    if (priority) {
      loadStartTimeRef.current = performance.now();
      setImageSrc(optimizedSrc);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadStartTimeRef.current = performance.now();
          // Add a small delay for smoother loading
          setTimeout(() => setImageSrc(optimizedSrc), 100);
          observer.unobserve(img);
        }
      },
      {
        threshold: 0.01, // Start loading earlier
        rootMargin: '200px' // Load images before they come into view
      }
    );

    observer.observe(img);

    return () => {
      if (img) observer.unobserve(img);
    };
  }, [src, priority, getOptimizedImageUrl]);

  const handleLoad = () => {
    setIsLoaded(true);

    // Monitor loading performance
    if (loadStartTimeRef.current > 0) {
      monitorImageLoad(src, loadStartTimeRef.current);
    }

    if (autoSize && imgRef.current) {
      const img = imgRef.current;
      const containerWidth = img.parentElement?.clientWidth || 0;
      const containerHeight = img.parentElement?.clientHeight || 0;

      if (containerWidth > 0 && containerHeight > 0) {
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        let finalWidth, finalHeight;

        if (aspectRatio > containerAspectRatio) {
          // Image is wider than container ratio
          finalWidth = containerWidth;
          finalHeight = containerWidth / aspectRatio;
        } else {
          // Image is taller than container ratio
          finalHeight = containerHeight;
          finalWidth = containerHeight * aspectRatio;
        }

        setImageDimensions({ width: finalWidth, height: finalHeight });
      }
    }
  };

  const handleError = () => {
    setImageSrc(fallback);
  };

  const imageStyle = autoSize && imageDimensions.width > 0 && imageDimensions.height > 0
    ? {
        width: `${imageDimensions.width}px`,
        height: `${imageDimensions.height}px`,
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain' as const
      }
    : aspectRatio
    ? {
        aspectRatio,
        width: '100%',
        height: 'auto'
      }
    : {};

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`transition-all duration-500 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-50 scale-95'} ${className}`}
      style={imageStyle}
      onLoad={handleLoad}
      onError={handleError}
      loading={priority ? 'eager' : 'lazy'}
      sizes={sizes}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
    />
  );
};

export default LazyImage;