import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, MoreHorizontal, ArrowLeft, Shuffle, Repeat, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { MediaItem, getImageUrl, getMediaUrl } from '../services/api';

interface AudioPlayerProps {
  audioBook: MediaItem;
  allAudioBooks: MediaItem[];
  currentIndex: number;
  onBack: () => void;
  onTrackChange: (index: number) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioBook, allAudioBooks, currentIndex, onBack, onTrackChange }) => {


  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlaylist, setShowPlaylist] = useState(false);

  // Track navigation functions - defined before useEffect to avoid initialization errors
  const nextTrack = useCallback(() => {
    if (isShuffled) {
      const randomIndex = Math.floor(Math.random() * allAudioBooks.length);
      onTrackChange(randomIndex);
    } else {
      const nextIndex = (currentIndex + 1) % allAudioBooks.length;
      onTrackChange(nextIndex);
    }
  }, [isShuffled, allAudioBooks.length, currentIndex, onTrackChange]);

  const previousTrack = useCallback(() => {
    if (isShuffled) {
      const randomIndex = Math.floor(Math.random() * allAudioBooks.length);
      onTrackChange(randomIndex);
    } else {
      const prevIndex = currentIndex === 0 ? allAudioBooks.length - 1 : currentIndex - 1;
      onTrackChange(prevIndex);
    }
  }, [isShuffled, allAudioBooks.length, currentIndex, onTrackChange]);

  // Control functions - defined before useEffect to avoid initialization errors
  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume > 0 ? volume : 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setLoading(false);
      setError(null);
    };

    const handleLoadError = () => {
      console.error('Audio loading error');
      setError('Failed to load audio file');
      setLoading(false);
    };

    const handleCanPlay = () => {
      setLoading(false);
      setError(null);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = async () => {
      setIsPlaying(false);
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        try {
          await audio.play();
          setIsPlaying(true);
        } catch (error) {
          console.error('Auto-repeat play error:', error);
        }
      } else if (repeatMode === 'all' || repeatMode === 'off') {
        nextTrack();
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleLoadError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleLoadError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [repeatMode, nextTrack]);

  // Playback control functions (moved here to fix initialization order)
  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const skipForward = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const newTime = Math.min(audio.currentTime + 15, duration);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const skipBackward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Math.max(audio.currentTime - 15, 0);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; // Don't interfere with input fields
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            previousTrack();
          } else {
            skipBackward();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            nextTrack();
          } else {
            skipForward();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => Math.min(1, prev + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => Math.max(0, prev - 0.1));
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [nextTrack, previousTrack, togglePlayPause, skipForward, toggleMute]);

  // Sync volume changes with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (!isMuted) {
      audio.volume = volume;
    }
  }, [volume, isMuted]);

  // Helper function to construct proper audio URL
  const constructAudioUrl = (audioPath: string) => {
    return getMediaUrl(audioPath);
  };

  // Reset player state when track changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoading(true);
    setError(null);
  }, [audioBook.id]);

  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const newTime = parseFloat(e.target.value);
    if (newTime >= 0 && newTime <= duration) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/20 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors duration-200"
        >
          <ArrowLeft size={24} />
          <span className="hidden sm:inline" style={{ fontFamily: 'Times New Roman' }}>Back to Library</span>
        </button>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className={`p-2 rounded-full transition-colors duration-200 ${
              isLiked ? 'text-green-500' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
          <button 
            onClick={() => setShowPlaylist(!showPlaylist)}
            className={`text-gray-400 hover:text-white transition-colors duration-200 ${showPlaylist ? 'text-white' : ''}`}
            title="Toggle playlist"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 lg:px-8 mb-4">
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                const audio = audioRef.current;
                if (audio) {
                  audio.load();
                }
              }}
              className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded text-sm transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Player Content */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto p-4 lg:p-8 gap-8">
        {/* Left Side - Album Art */}
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className={`w-72 h-72 sm:w-96 sm:h-96 rounded-2xl overflow-hidden shadow-2xl ${
              isPlaying ? 'animate-pulse' : ''
            }`}>
              <img
                src={getImageUrl(audioBook.cover_image_url) || ''}
                alt={audioBook.title}
                className="w-full h-full object-contain"
              />
            </div>
            
            {/* Loading overlay */}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl"
              >
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-2"></div>
                  <p className="text-white text-sm">Loading audio...</p>
                </div>
              </motion.div>
            )}
            
            {/* Floating play indicator */}
            {isPlaying && !loading && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl"
              >
                <div className="w-16 h-16 border-4 border-white/50 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Right Side - Player Controls & Info */}
        <div className="flex-1 flex flex-col justify-center space-y-6">
          {/* Track Info */}
          <div className="text-center lg:text-left">
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4"
              style={{ fontFamily: 'Times New Roman' }}
            >
              {audioBook.title}
            </motion.h1>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="space-y-2"
            >
              {audioBook.author && (
                <p className="text-xl text-gray-300" style={{ fontFamily: 'Times New Roman' }}>
                  By {audioBook.author}
                </p>
              )}
              {audioBook.narrator && (
                <p className="text-lg text-gray-400" style={{ fontFamily: 'Times New Roman' }}>
                  Narrated by {audioBook.narrator}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-gray-400 justify-center lg:justify-start">
                <span className="capitalize">{audioBook.language}</span>
                <span>•</span>
                <span>{audioBook.genre || 'Audio'}</span>
                {audioBook.published_year && (
                  <>
                    <span>•</span>
                    <span>{audioBook.published_year}</span>
                  </>
                )}
              </div>
            </motion.div>
          </div>

          {/* Progress Bar */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-2"
          >
            <div className="relative">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                disabled={!duration || loading}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(to right, #22c55e 0%, #22c55e ${progressPercentage}%, #374151 ${progressPercentage}%, #374151 100%)`
                }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </motion.div>

          {/* Main Controls */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex items-center justify-center gap-6"
          >
            <button
              onClick={() => setIsShuffled(!isShuffled)}
              className={`p-2 rounded-full transition-colors duration-200 ${
                isShuffled ? 'text-green-500' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Shuffle size={20} />
            </button>

            <button
              onClick={previousTrack}
              disabled={loading || allAudioBooks.length <= 1}
              className="p-3 text-gray-300 hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous track"
            >
              <SkipBack size={24} />
            </button>

            <button
              onClick={togglePlayPause}
              disabled={loading || !!error}
              className="bg-green-500 hover:bg-green-400 p-4 rounded-full transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
              ) : isPlaying ? (
                <Pause size={28} />
              ) : (
                <Play size={28} className="ml-1" />
              )}
            </button>

            <button
              onClick={nextTrack}
              disabled={loading || allAudioBooks.length <= 1}
              className="p-3 text-gray-300 hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next track"
            >
              <SkipForward size={24} />
            </button>

            <button
              onClick={() => setRepeatMode(prev => 
                prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'
              )}
              className={`p-2 rounded-full transition-colors duration-200 relative ${
                repeatMode !== 'off' ? 'text-green-500' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Repeat size={20} />
              {repeatMode === 'one' && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center text-xs">
                  1
                </span>
              )}
            </button>
          </motion.div>

          {/* Volume Control */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex items-center justify-center gap-4"
          >
            <button
              onClick={toggleMute}
              className="text-gray-300 hover:text-white transition-colors duration-200"
            >
              {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #22c55e 0%, #22c55e ${(isMuted ? 0 : volume) * 100}%, #374151 ${(isMuted ? 0 : volume) * 100}%, #374151 100%)`
              }}
            />
            <span className="text-xs text-gray-400 w-8">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
          </motion.div>

          {/* Additional Info */}
          {audioBook.description && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="max-w-md mx-auto lg:mx-0 text-center lg:text-left"
            >
              <h3 className="text-lg font-semibold mb-2 text-gray-300" style={{ fontFamily: 'Times New Roman' }}>
                About This Audio
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed" style={{ fontFamily: 'Times New Roman' }}>
                {audioBook.description}
              </p>
            </motion.div>
          )}

          {/* Keyboard Shortcuts Help */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center lg:text-left"
          >
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-400 mb-2">Keyboard Shortcuts</summary>
              <div className="space-y-1 pl-4">
                <p>Space: Play/Pause</p>
                <p>← →: Skip backward/forward (15s)</p>
                <p>↑ ↓: Volume up/down</p>
                <p>M: Mute/Unmute</p>
              </div>
            </details>
          </motion.div>
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={constructAudioUrl(audioBook.audio_file_path || '')}
        preload="metadata"
        crossOrigin="anonymous"
        onError={(e) => {
          console.error('Audio loading error:', e);
          setError('Failed to load audio file. Please check if the file exists.');
          setLoading(false);
        }}
      />

      {/* Playlist Sidebar */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: showPlaylist ? '0%' : '100%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed right-0 top-0 h-full w-80 sm:w-96 bg-gray-900/95 backdrop-blur-sm border-l border-gray-700 z-50 overflow-hidden"
      >
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'Times New Roman' }}>
              Audio Queue ({allAudioBooks.length})
            </h3>
            <button
              onClick={() => setShowPlaylist(false)}
              className="text-gray-400 hover:text-white transition-colors duration-200"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="overflow-y-auto h-full pb-20">
          {allAudioBooks.map((book, index) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              onClick={() => {
                onTrackChange(index);
                setShowPlaylist(false);
              }}
              className={`p-4 border-b border-gray-700/50 cursor-pointer hover:bg-gray-800/50 transition-colors duration-200 ${
                index === currentIndex ? 'bg-green-900/30 border-green-500/30' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={getImageUrl(book.cover_image_url) || ''}
                  alt={book.title}
                  className="w-12 h-12 rounded-lg object-contain"
                />
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-sm truncate ${
                    index === currentIndex ? 'text-green-400' : 'text-white'
                  }`} style={{ fontFamily: 'Times New Roman' }}>
                    {book.title}
                  </h4>
                  <p className="text-xs text-gray-400 truncate" style={{ fontFamily: 'Times New Roman' }}>
                    {book.author || book.narrator}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{book.language}</p>
                </div>
                {index === currentIndex && isPlaying && (
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Background Gradient Effect */}
      <div 
        className="fixed inset-0 opacity-20 -z-10"
        style={{
          background: `radial-gradient(circle at center, rgba(34, 197, 94, 0.3) 0%, transparent 70%)`
        }}
      />
    </div>
  );
};

export default AudioPlayer;