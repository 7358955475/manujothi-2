import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Edit3, Save, Upload, FileAudio, Play, Pause, Volume2, Eye, EyeOff } from 'lucide-react';

interface AudioPreviewData {
  title: string;
  description: string;
  author: string;
  narrator: string;
  language: string;
  genre: string;
  duration?: number;
  audioFile?: File;
  coverFile?: File;
  cover_url?: string;
}

interface AudioPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: AudioPreviewData;
  onSave: (editedData: AudioPreviewData) => void;
  onUpload: () => void;
}

const AudioPreview: React.FC<AudioPreviewProps> = ({
  isOpen,
  onClose,
  previewData,
  onSave,
  onUpload
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<AudioPreviewData>(previewData);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [showAudioPreview, setShowAudioPreview] = useState(true);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const languages = [
    { value: 'tamil', label: 'Tamil' },
    { value: 'english', label: 'English' },
    { value: 'telugu', label: 'Telugu' },
    { value: 'hindi', label: 'Hindi' }
  ];

  const genres = [
    'Fiction', 'Non-Fiction', 'Biography', 'Self-Help', 'Business',
    'Technology', 'Science', 'History', 'Religion', 'Philosophy',
    'Literature', 'Romance', 'Mystery', 'Thriller', 'Children',
    'Education', 'Health', 'Psychology', 'Art', 'Music'
  ];

  // Helper function to construct correct image URLs
  const getImageUrl = (imageUrl: string | null) => {
    if (!imageUrl) return null;

    // If it's already a full URL (starts with http), return as is
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }

    // If it's a local path starting with /public, prepend backend URL
    if (imageUrl.startsWith('/public')) {
      return `http://localhost:3003${imageUrl}`;
    }

    // Otherwise, treat as backend-relative path
    return `http://localhost:3003${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
  };

  // Cleanup object URLs when component unmounts or audio file changes
  useEffect(() => {
    return () => {
      if (audioObjectUrl) {
        URL.revokeObjectURL(audioObjectUrl);
        setAudioObjectUrl('');
      }
    };
  }, []);

  useEffect(() => {
    setEditedData(previewData);

    // Cleanup previous object URL
    if (audioObjectUrl) {
      URL.revokeObjectURL(audioObjectUrl);
      setAudioObjectUrl('');
    }

    // Generate cover preview for local audio files
    if (previewData.audioFile) {
      const newObjectUrl = URL.createObjectURL(previewData.audioFile);
      setAudioObjectUrl(newObjectUrl);
      analyzeAudioFile(previewData.audioFile);
    } else if (previewData.cover_url) {
      // Use existing cover URL
      const imageUrl = getImageUrl(previewData.cover_url);
      setCoverPreview(imageUrl || '');
    }
  }, [previewData]);

  // Update audio element when object URL changes
  useEffect(() => {
    if (audioRef.current && audioObjectUrl) {
      audioRef.current.src = audioObjectUrl;
      audioRef.current.load();
    }
  }, [audioObjectUrl]);

  const analyzeAudioFile = (file: File) => {
    if (!file.type.startsWith('audio/')) return;

    try {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';

      audio.onloadedmetadata = () => {
        setAudioDuration(Math.floor(audio.duration));
        setEditedData(prev => ({
          ...prev,
          duration: Math.floor(audio.duration)
        }));
      };

      audio.src = URL.createObjectURL(file);
    } catch (error) {
      console.error('Error analyzing audio file:', error);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedData(previewData);
  };

  const handleSave = () => {
    onSave(editedData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedData(previewData);
    setIsEditing(false);
  };

  const handleInputChange = (field: keyof AudioPreviewData, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverPreview(e.target?.result as string);
        setEditedData(prev => ({
          ...prev,
          coverFile: file
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Audio player controls
  const handlePlayPause = async () => {
    if (audioRef.current) {
      try {
        if (isPlaying) {
          audioRef.current.pause();
        } else {
          // Ensure the audio is loaded before playing
          if (audioRef.current.readyState < 2) {
            await audioRef.current.load();
          }
          await audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
      } catch (error) {
        console.error('Audio playback error:', error);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setAudioDuration(Math.floor(audioRef.current.duration));
      setEditedData(prev => ({
        ...prev,
        duration: Math.floor(audioRef.current.duration)
      }));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const audioSrc = useMemo(() => {
    if (previewData.audioFile && audioObjectUrl) {
      return audioObjectUrl;
    }
    return '';
  }, [previewData.audioFile, audioObjectUrl]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCurrentTime = (time: number) => {
    return formatDuration(time);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-5 flex justify-between items-center border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <FileAudio size={24} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Audiobook Preview
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-white/20 rounded-xl transition-all duration-200 flex-shrink-0 ml-4"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col xl:flex-row h-[calc(95vh-88px)]">
          {/* Audio Preview Section */}
          <div className="xl:w-1/2 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-8 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <h3 className="text-xl font-semibold text-gray-800">Audio Preview</h3>
              </div>
              <button
                onClick={() => setShowAudioPreview(!showAudioPreview)}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-white/80 rounded-lg transition-all duration-200"
                title={showAudioPreview ? 'Hide Audio Player' : 'Show Audio Player'}
              >
                {showAudioPreview ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Cover Image */}
            <div className="flex justify-center mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
                <div className="w-64 h-64 bg-gray-200 rounded-2xl overflow-hidden shadow-2xl border-4 border-white">
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Audiobook cover"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-100 to-gray-200">
                      <FileAudio size={64} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {showAudioPreview && (
              <>
                {/* Audio Player */}
                {previewData.audioFile && (
                  <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 mb-6">
                    <audio
                      ref={audioRef}
                      src={audioSrc}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onLoadStart={() => console.log('Audio loading started...')}
                      onCanPlay={() => console.log('Audio can play')}
                      onError={(e) => console.error('Audio error:', e)}
                      preload="metadata"
                      className="hidden"
                    />

                    {/* Custom Audio Controls */}
                    <div className="space-y-6">
                      {/* Play/Pause Button */}
                      <div className="flex items-center justify-center">
                        <button
                          onClick={handlePlayPause}
                          className="group w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-2xl transform hover:scale-105"
                        >
                          {isPlaying ? (
                            <Pause size={28} className="group-hover:scale-110 transition-transform" />
                          ) : (
                            <Play size={28} className="group-hover:scale-110 transition-transform ml-1" />
                          )}
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type="range"
                            min="0"
                            max={duration || 0}
                            value={currentTime}
                            onChange={handleSeek}
                            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer slider"
                            style={{
                              background: `linear-gradient(to right, #10b981 0%, #10b981 ${(currentTime / duration) * 100}%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)`
                            }}
                          />
                          <div className="absolute -top-1 left-0 w-full h-4 pointer-events-none"></div>
                        </div>
                        <div className="flex justify-between text-sm font-medium text-gray-700">
                          <span className="bg-gray-100 px-2 py-1 rounded">{formatCurrentTime(currentTime)}</span>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">{formatCurrentTime(duration)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Audio Info */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 text-sm">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    Audio Information
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">File Size:</span>
                      <span className="font-semibold text-gray-800">
                        {previewData.audioFile ? `${(previewData.audioFile.size / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 font-medium">Duration:</span>
                      <span className="font-semibold text-gray-800">
                        {audioDuration ? formatDuration(audioDuration) : 'Loading...'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600 font-medium">Format:</span>
                      <span className="font-semibold text-gray-800">
                        {previewData.audioFile ? previewData.audioFile.type.split('/')[1]?.toUpperCase() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Edit Section */}
          <div className="xl:w-1/2 bg-gray-50 p-8 overflow-y-auto flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <h3 className="text-2xl font-bold text-gray-800">Audiobook Details</h3>
              </div>
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Edit3 size={18} />
                  <span className="font-medium">Edit Details</span>
                </button>
              ) : (
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleCancel}
                    className="px-6 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
                  >
                    <Save size={18} />
                    <span>Save</span>
                  </button>
                </div>
              )}
            </div>

            {/* Cover Image Upload */}
            <div className="mb-8">
              <label className="block text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                Cover Image
              </label>
              <div className="flex items-start gap-6">
                <div className="w-32 h-32 bg-gray-200 rounded-2xl overflow-hidden flex-shrink-0 border-4 border-white shadow-lg">
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-100 to-gray-200">
                      <FileAudio size={32} />
                    </div>
                  )}
                </div>
                {isEditing && (
                  <div className="flex-1">
                    <input
                      ref={coverFileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCoverChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => coverFileRef.current?.click()}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
                    >
                      Change Cover
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-6">
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  Title *
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base"
                    placeholder="Enter audiobook title"
                  />
                ) : (
                  <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
                    <p className="text-gray-800 text-base font-medium">{editedData.title || 'No title provided'}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                  Description
                </label>
                {isEditing ? (
                  <textarea
                    value={editedData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base resize-none"
                    rows={4}
                    placeholder="Enter audiobook description"
                  />
                ) : (
                  <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
                    <p className="text-gray-800 text-base whitespace-pre-wrap">
                      {editedData.description || 'No description provided'}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    Author
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.author}
                      onChange={(e) => handleInputChange('author', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base"
                      placeholder="Author name"
                    />
                  ) : (
                    <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
                      <p className="text-gray-800 text-base font-medium">{editedData.author || 'No author'}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                    Narrator
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.narrator}
                      onChange={(e) => handleInputChange('narrator', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base"
                      placeholder="Narrator name"
                    />
                  ) : (
                    <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
                      <p className="text-gray-800 text-base font-medium">{editedData.narrator || 'No narrator'}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                    Language
                  </label>
                  {isEditing ? (
                    <select
                      value={editedData.language}
                      onChange={(e) => handleInputChange('language', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base"
                    >
                      <option value="">Select Language</option>
                      {languages.map(lang => (
                        <option key={lang.value} value={lang.value}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
                      <p className="text-gray-800 text-base font-medium capitalize">
                        {languages.find(l => l.value === editedData.language)?.label || editedData.language}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    Genre
                  </label>
                  {isEditing ? (
                    <select
                      value={editedData.genre}
                      onChange={(e) => handleInputChange('genre', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base"
                    >
                      <option value="">Select Genre</option>
                      {genres.map(genre => (
                        <option key={genre} value={genre}>{genre}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
                      <p className="text-gray-800 text-base font-medium">{editedData.genre || 'No genre'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button
                onClick={onUpload}
                className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105"
              >
                <Upload size={24} />
                <span>Upload Audiobook</span>
              </button>
              <button
                onClick={onClose}
                className="px-8 py-4 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #10b981;
          border-radius: 50%;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #10b981;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default AudioPreview;