import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward } from 'lucide-react';
import { getVideoUrl, getImageUrl } from '../services/api';

interface VideoPlayerProps {
  video: {
    id: string;
    title: string;
    description?: string;
    video_source: 'youtube' | 'local';
    video_file_path?: string;
    youtube_url?: string;
    youtube_id?: string;
    thumbnail_url?: string;
  };
  onClose: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('ended', handleEnded);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'f':
          // F key toggles fullscreen
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'escape':
          // ESC exits fullscreen
          if (isFullscreen) {
            toggleFullscreen();
          }
          break;
        case ' ':
          // Spacebar toggles play/pause
          e.preventDefault();
          togglePlay();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFullscreen]);

  const togglePlay = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isPlaying) {
      videoElement.pause();
    } else {
      videoElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    videoElement.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const newVolume = parseFloat(e.target.value);
    videoElement.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const newTime = parseFloat(e.target.value);
    videoElement.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skip = (seconds: number) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    videoElement.currentTime = Math.max(0, Math.min(duration, videoElement.currentTime + seconds));
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen - try different vendor prefixes
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          await (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          await (container as any).msRequestFullscreen();
        }
      } else {
        // Exit fullscreen - try different vendor prefixes
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getVideoSrc = () => {
    console.log('[VideoPlayer] Getting video source:', {
      video_source: video.video_source,
      youtube_id: video.youtube_id,
      youtube_url: video.youtube_url,
      video_file_path: video.video_file_path
    });

    if (video.video_source === 'local' && video.video_file_path) {
      const localUrl = getVideoUrl(video.video_file_path);
      console.log('[VideoPlayer] Using local video URL:', localUrl);
      return localUrl;
    } else if (video.video_source === 'youtube' && video.youtube_id) {
      const embedUrl = `https://www.youtube.com/embed/${video.youtube_id}?autoplay=1&rel=0&origin=${window.location.origin}`;
      console.log('[VideoPlayer] Using YouTube embed URL:', embedUrl);
      return embedUrl;
    } else if (video.youtube_url) {
      // Fallback: try to extract youtube_id from youtube_url
      const match = video.youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      if (match && match[1]) {
        const embedUrl = `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0&origin=${window.location.origin}`;
        console.log('[VideoPlayer] Extracted YouTube ID from URL, using embed:', embedUrl);
        return embedUrl;
      }
    }

    console.error('[VideoPlayer] No valid video source found!');
    return '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div ref={containerRef} className={`relative w-full mx-4 ${isFullscreen ? 'max-w-none h-full' : 'max-w-6xl'}`}>
        {/* Header */}
        <div className={`bg-gray-900 text-white p-4 flex justify-between items-center ${isFullscreen ? '' : 'rounded-t-lg'}`}>
          <div>
            <h2 className="text-xl font-bold">{video.title}</h2>
            {video.description && (
              <p className="text-gray-300 text-sm mt-1">{video.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Fullscreen button for YouTube videos */}
            {video.video_source === 'youtube' && (
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                <Maximize size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Video Container */}
        <div className={`bg-black overflow-hidden ${isFullscreen ? 'h-[calc(100%-4rem)]' : 'rounded-b-lg'}`}>
          {video.video_source === 'youtube' ? (
            <div className={`relative ${isFullscreen ? 'h-full' : 'pb-[56.25%]'}`}>
              <iframe
                src={getVideoSrc()}
                title={video.title}
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                onLoad={() => console.log('[VideoPlayer] YouTube iframe loaded successfully')}
                onError={(e) => {
                  console.error('[VideoPlayer] YouTube iframe failed to load:', e);
                  alert('Failed to load YouTube video. Please check:\n1. Your internet connection\n2. If YouTube is accessible\n3. Browser extensions blocking the video');
                }}
              />
            </div>
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                src={getVideoSrc()}
                className={`w-full ${isFullscreen ? 'h-full object-contain' : 'h-auto max-h-[70vh]'}`}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onDoubleClick={toggleFullscreen}
                poster={getImageUrl(video.thumbnail_url)}
                crossOrigin="anonymous"
                onError={(e) => {
                  console.error('Video loading error:', e);
                  alert('Failed to load video file. Please check if the file exists.');
                }}
              />

              {/* Custom Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                {/* Progress Bar */}
                <div className="mb-4">
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-white text-xs mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Play/Pause */}
                    <button
                      onClick={togglePlay}
                      className="text-white hover:text-gray-300 transition-colors"
                    >
                      {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                    </button>

                    {/* Skip Backward */}
                    <button
                      onClick={() => skip(-10)}
                      className="text-white hover:text-gray-300 transition-colors"
                    >
                      <SkipBack size={20} />
                    </button>

                    {/* Skip Forward */}
                    <button
                      onClick={() => skip(10)}
                      className="text-white hover:text-gray-300 transition-colors"
                    >
                      <SkipForward size={20} />
                    </button>

                    {/* Volume */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={toggleMute}
                        className="text-white hover:text-gray-300 transition-colors"
                      >
                        {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Playback Speed */}
                    <select
                      value={playbackRate}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value);
                        setPlaybackRate(rate);
                        if (videoRef.current) {
                          videoRef.current.playbackRate = rate;
                        }
                      }}
                      className="bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600"
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={0.75}>0.75x</option>
                      <option value={1}>1x</option>
                      <option value={1.25}>1.25x</option>
                      <option value={1.5}>1.5x</option>
                      <option value={2}>2x</option>
                    </select>
                  </div>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="text-white hover:text-gray-300 transition-colors"
                    title="Fullscreen (F key or double-click)"
                  >
                    <Maximize size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;