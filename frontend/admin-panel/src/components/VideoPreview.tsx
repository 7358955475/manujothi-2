import React, { useState, useRef, useEffect } from 'react';
import { X, Edit3, Save, Upload, FileVideo, Link, Eye, EyeOff } from 'lucide-react';

interface VideoPreviewData {
  title: string;
  description: string;
  youtube_url?: string;
  language: string;
  category: string;
  duration?: number;
  video_source: 'youtube' | 'local';
  videoFile?: File;
  thumbnailFile?: File;
  thumbnail_url?: string;
}

interface VideoPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: VideoPreviewData;
  onSave: (editedData: VideoPreviewData) => void;
  onUpload: () => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  isOpen,
  onClose,
  previewData,
  onSave,
  onUpload
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<VideoPreviewData>(previewData);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [showVideoPreview, setShowVideoPreview] = useState(true);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const languages = [
    { value: 'tamil', label: 'Tamil' },
    { value: 'english', label: 'English' },
    { value: 'telugu', label: 'Telugu' },
    { value: 'hindi', label: 'Hindi' }
  ];

  const categories = [
    'Education', 'Entertainment', 'Music', 'News', 'Sports',
    'Gaming', 'Technology', 'Cooking', 'Travel', 'Comedy',
    'Science', 'Health', 'Business', 'Art', 'Culture'
  ];

  // Helper function to construct correct image URLs
  const getImageUrl = (imageUrl: string | null): string => {
    if (!imageUrl) return '';

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

  // Cleanup object URLs when component unmounts or video file changes
  useEffect(() => {
    return () => {
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
        setVideoObjectUrl('');
      }
    };
  }, []);

  useEffect(() => {
    setEditedData(previewData);

    // Cleanup previous object URL
    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
      setVideoObjectUrl('');
    }

    // Priority order for thumbnail display:
    // 1. Custom uploaded thumbnail (highest priority)
    // 2. YouTube thumbnail (for YouTube videos)
    // 3. Auto-generated thumbnail from local video (only if no custom thumbnail)
    // 4. Existing thumbnail URL from database

    if (previewData.thumbnailFile) {
      // Handle newly uploaded thumbnail file
      const thumbnailUrl = URL.createObjectURL(previewData.thumbnailFile);
      setThumbnailPreview(thumbnailUrl);
    } else if (previewData.thumbnail_url) {
      // Check if it's a data URL (from newly uploaded file) or regular URL
      if (previewData.thumbnail_url.startsWith('data:')) {
        setThumbnailPreview(previewData.thumbnail_url);
      } else {
        setThumbnailPreview(getImageUrl(previewData.thumbnail_url) || '');
      }
    } else if (previewData.video_source === 'youtube' && previewData.youtube_url) {
      // Use YouTube thumbnail if no custom thumbnail
      setThumbnailPreview(`https://img.youtube.com/vi/${extractYouTubeId(previewData.youtube_url)}/hqdefault.jpg`);
    } else if (previewData.video_source === 'local' && previewData.videoFile) {
      // Generate thumbnail from local video only if no custom thumbnail
      const newObjectUrl = URL.createObjectURL(previewData.videoFile);
      setVideoObjectUrl(newObjectUrl);
      generateThumbnail(previewData.videoFile);
    } else if (previewData.thumbnail_url) {
      // Fallback to existing thumbnail URL
      setThumbnailPreview(getImageUrl(previewData.thumbnail_url));
    }

    // Always set up video object URL for local videos
    if (previewData.video_source === 'local' && previewData.videoFile && !videoObjectUrl) {
      const newObjectUrl = URL.createObjectURL(previewData.videoFile);
      setVideoObjectUrl(newObjectUrl);
    }
  }, [previewData]);

  const extractYouTubeId = (url: string): string => {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : '';
  };

  const generateThumbnail = async (file: File) => {
    if (!file.type.startsWith('video/')) return;

    try {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        setVideoDuration(Math.floor(video.duration));
        canvas.width = 320;
        canvas.height = (video.videoHeight / video.videoWidth) * 320;

        video.currentTime = 1; // Seek to 1 second for thumbnail
      };

      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Only set auto-generated thumbnail if no custom thumbnail is already set
          setThumbnailPreview(prev => {
            // If no custom thumbnail exists, use the auto-generated one
            return prev || canvas.toDataURL('image/jpeg', 0.8);
          });
        }
      };

      video.src = URL.createObjectURL(file);
    } catch (error) {
      console.error('Error generating thumbnail:', error);
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

  const handleInputChange = (field: keyof VideoPreviewData, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const thumbnailData = e.target?.result as string;
        // Set the custom thumbnail preview (this will override any auto-generated thumbnail)
        setThumbnailPreview(thumbnailData);
        setEditedData(prev => ({
          ...prev,
          thumbnailFile: file,
          thumbnail_url: thumbnailData // Also store as data URL for consistency
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getVideoSrc = () => {
    if (previewData.video_source === 'local' && previewData.videoFile) {
      return videoObjectUrl;
    } else if (previewData.video_source === 'youtube' && previewData.youtube_url) {
      const videoId = extractYouTubeId(previewData.youtube_url);
      return `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1&modestbranding=1&rel=0&showinfo=0`;
    }
    return '';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl w-full max-w-[95vw] max-h-[95vh] sm:max-w-[98vw] sm:max-h-[98vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 sm:p-6 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {previewData.video_source === 'local' ? (
              <FileVideo size={24} className="flex-shrink-0" />
            ) : (
              <Link size={24} className="flex-shrink-0" />
            )}
            <h2 className="text-lg sm:text-2xl font-bold truncate">
              {previewData.video_source === 'local' ? 'Local Video' : 'YouTube Video'} Preview
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors flex-shrink-0 ml-2"
          >
            <X size={20} className="sm:hidden" />
            <X size={24} className="hidden sm:block" />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Video Preview Section - Full Screen */}
          <div className="w-full bg-gray-900 p-4 sm:p-6 flex flex-col flex-grow min-h-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-lg font-semibold">Video Preview</h3>
              <button
                onClick={() => setShowVideoPreview(!showVideoPreview)}
                className="text-white/70 hover:text-white transition-colors"
                title={showVideoPreview ? 'Hide Video' : 'Show Video'}
              >
                {showVideoPreview ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {showVideoPreview && (
              <div className="flex-1 bg-black rounded-lg overflow-hidden relative min-h-[300px] sm:min-h-[400px]">
                {previewData.video_source === 'local' ? (
                  <video
                    ref={videoRef}
                    src={getVideoSrc()}
                    controls
                    className="absolute inset-0 w-full h-full object-contain"
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget;
                      setVideoDuration(Math.floor(video.duration));
                      setEditedData(prev => ({
                        ...prev,
                        duration: Math.floor(video.duration)
                      }));
                    }}
                    onError={(e) => {
                      const video = e.currentTarget as HTMLVideoElement;
                      console.error('Local video error:', video.error?.message);
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : previewData.video_source === 'youtube' ? (
                  <div className="absolute inset-0 w-full h-full">
                    <iframe
                      src={getVideoSrc()}
                      className="absolute inset-0 w-full h-full"
                      title="YouTube video preview"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      onError={(e) => {
                        // Fallback to showing thumbnail with link
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
                      <div className="text-center w-full h-full relative">
                        <img
                          src={`https://img.youtube.com/vi/${extractYouTubeId(previewData.youtube_url || '')}/hqdefault.jpg`}
                          alt="YouTube thumbnail"
                          className="absolute inset-0 w-full h-full object-contain rounded"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'block';
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                          <div className="text-center">
                            <p className="text-white mb-2">YouTube Video Preview</p>
                            <a
                              href={previewData.youtube_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 underline"
                            >
                              Watch on YouTube
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <div className="text-center">
                      <FileVideo size={48} className="mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-400">No video source available</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Please select a YouTube URL or upload a local video file
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Video Info */}
            <div className="mt-4 text-white text-sm">
              <div className="flex justify-between">
                <span>Source:</span>
                <span className="text-orange-400 capitalize">{previewData.video_source}</span>
              </div>
              {previewData.video_source === 'local' && previewData.videoFile && (
                <>
                  <div className="flex justify-between mt-1">
                    <span>File Size:</span>
                    <span>{(previewData.videoFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Duration:</span>
                    <span>{videoDuration ? formatDuration(videoDuration) : 'Loading...'}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Edit Section - Below Video */}
          <div className="w-full p-4 sm:p-6 overflow-y-auto flex flex-col min-h-0 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">Video Details</h3>
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm sm:text-base"
                >
                  <Edit3 size={16} className="sm:hidden" />
                  <Edit3 size={18} className="hidden sm:block" />
                  <span className="hidden sm:inline">Edit Details</span>
                  <span className="sm:hidden">Edit</span>
                </button>
              ) : (
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleCancel}
                    className="px-3 sm:px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm sm:text-base"
                  >
                    <Save size={16} className="sm:hidden" />
                    <Save size={18} className="hidden sm:block" />
                    <span className="hidden sm:inline">Save</span>
                    <span className="sm:hidden">Save</span>
                  </button>
                </div>
              )}
            </div>

            {/* Thumbnail Preview */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="w-24 h-20 sm:w-32 sm:h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  {thumbnailPreview ? (
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <FileVideo size={20} className="sm:hidden" />
                      <FileVideo size={24} className="hidden sm:block" />
                    </div>
                  )}
                </div>
                {isEditing && (
                  <div className="w-full sm:w-auto">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors w-full sm:w-auto"
                    >
                      Change Thumbnail
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Enter video title"
                  />
                ) : (
                  <p className="text-gray-800">{editedData.title || 'No title provided'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                {isEditing ? (
                  <textarea
                    value={editedData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    rows={4}
                    placeholder="Enter video description"
                  />
                ) : (
                  <p className="text-gray-800 whitespace-pre-wrap">
                    {editedData.description || 'No description provided'}
                  </p>
                )}
              </div>

              {previewData.video_source === 'youtube' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">YouTube URL</label>
                  <p className="text-gray-800 text-sm break-all">{previewData.youtube_url}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  {isEditing ? (
                    <select
                      value={editedData.language}
                      onChange={(e) => handleInputChange('language', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    >
                      <option value="">Select Language</option>
                      {languages.map(lang => (
                        <option key={lang.value} value={lang.value}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-800 capitalize text-sm">
                      {languages.find(l => l.value === editedData.language)?.label || editedData.language}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  {isEditing ? (
                    <select
                      value={editedData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-800 text-sm">{editedData.category || 'No category'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={onUpload}
                className="flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold text-sm sm:text-base"
              >
                <Upload size={18} className="sm:hidden" />
                <Upload size={20} className="hidden sm:block" />
                <span className="hidden sm:inline">Upload Video</span>
                <span className="sm:hidden">Upload</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 sm:px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold text-sm sm:text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;