import React, { useState, useRef, useEffect } from 'react';
import { X, Download, ExternalLink, FileVideo, Link } from 'lucide-react';

interface VideoPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  video: any;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  isOpen,
  onClose,
  video
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Helper function to get video URL for playback
  const getVideoUrl = () => {
    if (video.video_source === 'youtube' && video.youtube_url) {
      return video.youtube_url;
    } else if (video.video_source === 'local' && video.video_file_path) {
      return `http://localhost:3003${video.video_file_path}`;
    }
    return null;
  };

  // Helper function to extract YouTube ID
  const extractYouTubeId = (url: string): string => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : '';
  };

  // Get YouTube embed URL
  const getYouTubeEmbedUrl = () => {
    const videoUrl = getVideoUrl();
    if (!videoUrl) return '';
    const videoId = extractYouTubeId(videoUrl);
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&showinfo=0`;
  };

  // Handle video load events
  const handleVideoLoadStart = () => {
    setIsLoading(true);
    setError('');
  };

  const handleVideoCanPlay = () => {
    setIsLoading(false);
    setError('');
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = e.currentTarget;
    setIsLoading(false);
    setError(videoElement.error?.message || 'Failed to load video');
  };

  // Reset state when video changes
  useEffect(() => {
    if (isOpen && video) {
      setIsLoading(true);
      setError('');
    }
  }, [isOpen, video]);

  if (!isOpen || !video) return null;

  const videoUrl = getVideoUrl();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {video.video_source === 'local' ? (
              <FileVideo size={28} />
            ) : (
              <Link size={28} />
            )}
            <div>
              <h2 className="text-2xl font-bold">Video Player</h2>
              <p className="text-green-100">{video.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Video Content */}
        <div className="p-6">
          {/* Video Info */}
          <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Source:</span>
              <span className="ml-2 capitalize text-gray-600">{video.video_source}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Language:</span>
              <span className="ml-2 capitalize text-gray-600">{video.language}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Category:</span>
              <span className="ml-2 text-gray-600">{video.category || 'N/A'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Duration:</span>
              <span className="ml-2 text-gray-600">
                {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : 'N/A'}
              </span>
            </div>
          </div>

          {video.description && (
            <div className="mb-4">
              <span className="font-medium text-gray-700">Description:</span>
              <p className="mt-1 text-gray-600 whitespace-pre-wrap">{video.description}</p>
            </div>
          )}

          {/* Video Player */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
            {video.video_source === 'local' ? (
              <div className="absolute inset-0">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                      <p>Loading video...</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="text-white text-center">
                      <FileVideo size={48} className="mx-auto mb-4 text-red-400" />
                      <p className="text-red-400 mb-2">Error loading video</p>
                      <p className="text-gray-400 text-sm">{error}</p>
                    </div>
                  </div>
                )}

                <video
                  ref={videoRef}
                  src={videoUrl || ''}
                  controls
                  className="w-full h-full object-contain"
                  onLoadStart={handleVideoLoadStart}
                  onCanPlay={handleVideoCanPlay}
                  onError={handleVideoError}
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : video.video_source === 'youtube' ? (
              <div className="absolute inset-0">
                <iframe
                  src={getYouTubeEmbedUrl()}
                  className="w-full h-full"
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onError={(e) => {
                    const iframe = e.target as HTMLIFrameElement;
                    iframe.style.display = 'none';
                    const fallback = iframe.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />

                {/* Fallback for blocked YouTube videos */}
                <div
                  className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white"
                  style={{ display: 'none' }}
                >
                  <div className="text-center">
                    <img
                      src={`https://img.youtube.com/vi/${extractYouTubeId(videoUrl)}/hqdefault.jpg`}
                      alt="YouTube thumbnail"
                      className="w-full h-full object-cover rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'block';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                      <div className="text-center">
                        <p className="text-white mb-2">YouTube Video</p>
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline flex items-center gap-2"
                        >
                          <ExternalLink size={16} />
                          Watch on YouTube
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                  <FileVideo size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-400">No video source available</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {video.video_source === 'local' && video.file_size && (
                <span>File size: {(video.file_size / (1024 * 1024)).toFixed(2)} MB</span>
              )}
            </div>

            <div className="flex gap-2">
              {video.video_source === 'youtube' && videoUrl && (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <ExternalLink size={16} />
                  Open on YouTube
                </a>
              )}

              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;