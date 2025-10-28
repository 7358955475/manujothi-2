import React, { useState, useRef, useEffect } from 'react';

interface OptimizedVideoProps {
  youtubeId: string;
  title: string;
  autoplay?: boolean;
  className?: string;
}

const OptimizedVideo: React.FC<OptimizedVideoProps> = ({
  youtubeId,
  title,
  autoplay = false,
  className = ''
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Generate thumbnail URL with fallback
  const getThumbnailUrl = () => {
    const baseUrl = 'https://img.youtube.com/vi/';
    // Try multiple thumbnail options in order of preference
    const thumbnailOptions = ['maxresdefault.jpg', 'hqdefault.jpg', 'mqdefault.jpg', 'default.jpg'];
    return `${baseUrl}${youtubeId}/${thumbnailOptions[0]}`;
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Intersection observer for lazy loading
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoaded) {
          setIsLoaded(true);
          setShowPlayer(true);
        }
      },
      { threshold: 0.25, rootMargin: '100px' }
    );

    observerRef.current.observe(iframe);

    return () => {
      if (observerRef.current && iframe) {
        observerRef.current.unobserve(iframe);
      }
    };
  }, [isLoaded]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    console.error('YouTube video failed to load:', youtubeId);
  };

  // Generate optimized YouTube URL
  const getOptimizedYouTubeUrl = () => {
    const params = new URLSearchParams({
      enablejsapi: '1',
      origin: window.location.origin,
      rel: '0',
      modestbranding: '1',
      fs: '1',
      playsinline: '1',
      controls: '1',
      disablekb: '0',
      iv_load_policy: '3',
      cc_load_policy: '0',
      autoplay: autoplay ? '1' : '0'
    });
    
    return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
  };

  const handleThumbnailError = () => {
    setThumbnailError(true);
  };

  const getFallbackThumbnailUrl = () => {
    const baseUrl = 'https://img.youtube.com/vi/';
    // Try fallback thumbnail options
    const fallbackOptions = ['hqdefault.jpg', 'mqdefault.jpg', 'default.jpg'];
    for (const option of fallbackOptions) {
      return `${baseUrl}${youtubeId}/${option}`;
    }
    return null;
  };

  return (
    <div className={`relative w-full ${className}`} style={{ paddingBottom: '56.25%' }}>
      {!showPlayer ? (
        // Thumbnail placeholder with play button
        <div
          className="absolute inset-0 bg-gray-200 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden"
          onClick={() => setShowPlayer(true)}
        >
          {!thumbnailError ? (
            <img
              src={getThumbnailUrl()}
              alt={`${title} thumbnail`}
              className="absolute inset-0 w-full h-full object-cover"
              onError={handleThumbnailError}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
                <p className="text-gray-700 font-medium">Click to play video</p>
              </div>
            </div>
          )}

          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          className="absolute top-0 left-0 w-full h-full rounded-lg"
          src={getOptimizedYouTubeUrl()}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {!isLoaded && showPlayer && (
        <div className="absolute inset-0 bg-gray-200 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      )}
    </div>
  );
};

export default OptimizedVideo;