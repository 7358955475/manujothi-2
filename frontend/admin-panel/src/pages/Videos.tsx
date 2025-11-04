import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Search, ExternalLink, ToggleLeft, ToggleRight, Upload, File, AlertCircle, CheckCircle, Eye, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { videosApi } from '../services/api';
import VideoPreview from '../components/VideoPreview';
import VideoPlayer from '../components/VideoPlayer';

const Videos: React.FC = () => {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [durationSeconds, setDurationSeconds] = useState<string>('');
  const [videoSource, setVideoSource] = useState<'youtube' | 'local'>('youtube');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<any>(null);

  const thumbnailFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, getValues, setValue, formState: { errors } } = useForm();

  // Helper function to construct correct image URLs
  const getImageUrl = (imageUrl: string | null) => {
    if (!imageUrl) return null;

    // If it's a YouTube thumbnail URL, extract video ID and reconstruct with reliable domain
    if (imageUrl.includes('youtube.com/vi/') || imageUrl.includes('ytimg.com/vi/')) {
      const videoId = imageUrl.match(/vi\/([^\/]+)/)?.[1];
      if (videoId) {
        // Use i.ytimg.com with hqdefault which is reliably available (same as user panel)
        return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    // If it's already a full URL (starts with http), return as is
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }

    // If it's a local path starting with /public, prepend backend URL
    if (imageUrl.startsWith('/public')) {
      return `http://localhost:3001${imageUrl}`;
    }

    // Otherwise, treat as backend-relative path
    return `http://localhost:3001${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
  };

  // Helper function to get video URL for playback
  const getVideoUrl = (video: any) => {
    if (video.video_source === 'youtube' && video.youtube_url) {
      return video.youtube_url;
    } else if (video.video_source === 'local' && video.video_file_path) {
      return `http://localhost:3001${video.video_file_path}`;
    }
    return null;
  };

  // Handle playing a video
  const handlePlayVideo = (video: any) => {
    setPlayingVideo(video);
    setShowVideoPlayer(true);
  };

  useEffect(() => {
    fetchVideos();
  }, [currentPage, searchTerm]);

  const fetchVideos = async () => {
    setIsLoading(true);
    try {
      const response = await videosApi.getAll({
        page: currentPage,
        limit: 10
      });
      setVideos(response.data.videos);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced thumbnail validation
  const validateThumbnailFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension) && !allowedTypes.includes(file.type)) {
      return 'Only JPEG, PNG, WebP, and GIF images are allowed';
    }

    if (file.size > 10 * 1024 * 1024) {
      return 'Thumbnail image size must be less than 10MB';
    }

    if (file.size === 0) {
      return 'Thumbnail image file is empty or corrupted';
    }

    return null;
  };

  // Enhanced video file validation
  const validateVideoFile = (file: File): string | null => {
    const allowedTypes = [
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
      'video/webm', 'video/x-matroska', 'video/x-ms-wmv'
    ];
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.mkv', '.mpeg', '.mpg'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension) && !allowedTypes.includes(file.type)) {
      return 'Only MP4, AVI, MOV, WMV, WebM, MKV, MPEG, and MPG video files are allowed';
    }

    if (file.size > 500 * 1024 * 1024) {
      return 'Video file size must be less than 500MB';
    }

    if (file.size === 0) {
      return 'Video file is empty or corrupted';
    }

    return null;
  };

  // Enhanced video file handler
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateVideoFile(file);
      if (error) {
        setUploadError(error);
        setVideoFile(null);
        return;
      }
      setVideoFile(file);
      setUploadError('');
    }
  };

  // Enhanced thumbnail file handler
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateThumbnailFile(file);
      if (error) {
        setUploadError(error);
        setThumbnailFile(null);
        setThumbnailPreview('');
        return;
      }
      setThumbnailFile(file);
      setUploadError('');

      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Enhanced upload with progress tracking
  const uploadWithProgress = async (formData: FormData): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
          setUploadStatus(`Uploading... ${progress}%`);
        }
      });

      // Handle response
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadStatus('Upload completed successfully!');
          resolve();
        } else {
          try {
            const response = JSON.parse(xhr.responseText);
            reject(new Error(response.error || 'Upload failed'));
          } catch {
            reject(new Error('Upload failed'));
          }
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      // Start upload
      xhr.open('POST', editingVideo ?
        videosApi.getEndpoint(`/${editingVideo.id}`) :
        videosApi.getEndpoint('')
      );

      // Add authorization header if needed
      const token = localStorage.getItem('authToken');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Send form data with files
      xhr.send(formData);
    });
  };

  const handleCreateOrUpdate = async (data: any) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Preparing upload...');
    setUploadError('');

    try {
      const formData = new FormData();

      // Convert minutes and seconds to total seconds for duration
      const totalDuration = minutesSecondsToSeconds(durationMinutes, durationSeconds);

      // Validate based on video source
      if (videoSource === 'local' && !videoFile) {
        setUploadError('Video file is required for local uploads');
        return;
      }
      if (videoSource === 'youtube' && !data.youtube_url) {
        setUploadError('YouTube URL is required for YouTube videos');
        return;
      }

      // Add form fields
      Object.keys(data).forEach(key => {
        // Skip special fields that are handled separately
        if (key === 'is_active' || key === 'duration' || key === 'video_source') {
          if (key === 'is_active') {
            formData.append(key, data[key] === 'true' || data[key] === true);
          }
          return;
        }

        // IMPORTANT: Skip thumbnail_url if a thumbnail file is being uploaded
        // This ensures uploaded files take priority over URL fields
        if (key === 'thumbnail_url' && thumbnailFile) {
          console.log('Skipping thumbnail_url because thumbnail file is being uploaded');
          return;
        }

        // IMPORTANT: For YouTube videos, skip youtube_url if it's empty
        // For local videos, we don't need youtube_url at all
        if (key === 'youtube_url' && videoSource === 'local') {
          return;
        }

        if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
          formData.append(key, data[key]);
        }
      });

      // Add video source (use the state value since it's properly controlled)
      formData.append('video_source', videoSource);

      // Add duration as total seconds
      formData.append('duration', totalDuration.toString());

      // Add thumbnail file if selected
      if (thumbnailFile) {
        console.log('Uploading thumbnail file:', thumbnailFile.name);
        formData.append('thumbnailFile', thumbnailFile);
      }

      // Add video file if selected (for local uploads)
      if (videoFile && videoSource === 'local') {
        console.log('Uploading video file:', videoFile.name);
        formData.append('videoFile', videoFile);
      }

      // Add method for update if editing
      if (editingVideo) {
        formData.append('_method', 'PUT');
      }

      setUploadStatus('Uploading files...');
      await uploadWithProgress(formData);

      setShowModal(false);
      setEditingVideo(null);
      setThumbnailFile(null);
      setThumbnailPreview('');
      setDurationMinutes('');
      setDurationSeconds('');
      setVideoFile(null);
      setVideoSource('youtube');
      reset();
      fetchVideos();
    } catch (error: any) {
      console.error('Error saving video:', error);
      setUploadError(error.message || 'Failed to save video');
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStatus('');
        setUploadError('');
      }, 3000);
    }
  };

  const handleEdit = (video: any) => {
    setEditingVideo(video);
    reset(video);

    // Convert video duration to minutes and seconds for editing
    if (video.duration) {
      const { minutes, seconds } = secondsToMinutesSeconds(video.duration);
      setDurationMinutes(minutes);
      setDurationSeconds(seconds);
    } else {
      setDurationMinutes('');
      setDurationSeconds('');
    }

    // Set video source
    setVideoSource(video.video_source || 'youtube');
    setVideoFile(null);
    setThumbnailFile(null);
    setThumbnailPreview('');
    setUploadError('');
    setUploadStatus('');
    setUploadProgress(0);
    setShowModal(true);
  };

  
  const handleToggleActive = async (videoId: string, currentStatus: boolean) => {
    try {
      console.log('Toggling video:', videoId, 'from', currentStatus, 'to', !currentStatus);
      const response = await videosApi.update(videoId, { is_active: !currentStatus });
      console.log('Toggle response:', response);
      fetchVideos();
    } catch (error) {
      console.error('Error updating video status:', error);
      alert('Failed to update video status. Please try again.');
    }
  };

  const handleDelete = async (videoId: string) => {
    if (confirm('Are you sure you want to delete this video?')) {
      try {
        await videosApi.delete(videoId);
        fetchVideos();
      } catch (error) {
        console.error('Error deleting video:', error);
      }
    }
  };

  // Preview functionality
  const openPreview = () => {
    const currentFormData = getWatchValues();

    // Validate required fields for preview
    if (!currentFormData.title) {
      setUploadError('Title is required for preview');
      return;
    }

    if (videoSource === 'youtube' && !currentFormData.youtube_url) {
      setUploadError('YouTube URL is required for preview');
      return;
    }

    if (videoSource === 'local' && !videoFile) {
      setUploadError('Video file is required for preview');
      return;
    }

    const totalDuration = minutesSecondsToSeconds(durationMinutes, durationSeconds);

    const previewData = {
      title: currentFormData.title,
      description: currentFormData.description || '',
      youtube_url: currentFormData.youtube_url,
      language: currentFormData.language || 'english',
      category: currentFormData.category || '',
      duration: totalDuration,
      video_source: videoSource,
      videoFile: videoFile,
      thumbnailFile: thumbnailFile,
      thumbnail_url: thumbnailPreview
    };

    setPreviewData(previewData);
    setShowPreview(true);
  };

  const handlePreviewSave = (editedData: any) => {
    // Convert duration back to minutes and seconds for the form
    const { minutes, seconds } = secondsToMinutesSeconds(editedData.duration);

    // Update form with edited data
    reset({
      ...getWatchValues(),
      title: editedData.title,
      description: editedData.description,
      youtube_url: editedData.youtube_url,
      language: editedData.language,
      category: editedData.category
    });

    setDurationMinutes(minutes);
    setDurationSeconds(seconds);
    setThumbnailFile(editedData.thumbnailFile);
    setThumbnailPreview(editedData.thumbnail_url);

    // Update video file if changed
    if (editedData.videoFile !== videoFile) {
      setVideoFile(editedData.videoFile);
    }

    setUploadError('');
  };

  const handlePreviewUpload = () => {
    setShowPreview(false);
    // Submit the form with the current values
    handleSubmit(handleCreateOrUpdate)(getWatchValues());
  };

  // Helper function to get current form values
  const getWatchValues = () => {
    const values: any = {};
    const watch = getValues();
    Object.keys(watch).forEach(key => {
      values[key] = watch[key];
    });
    return values;
  };

  const openCreateModal = () => {
    setEditingVideo(null);
    reset({ language: 'english', is_active: true, video_source: 'youtube' });
    setThumbnailFile(null);
    setThumbnailPreview('');
    setDurationMinutes('');
    setDurationSeconds('');
    setVideoSource('youtube');
    setVideoFile(null);
    setUploadError('');
    setUploadStatus('');
    setUploadProgress(0);
    setShowModal(true);
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Convert total seconds to minutes and seconds
  const secondsToMinutesSeconds = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds === 0) {
      return { minutes: '', seconds: '' };
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes: minutes.toString(), seconds: seconds.toString() };
  };

  // Convert minutes and seconds to total seconds
  const minutesSecondsToSeconds = (minutes: string, seconds: string) => {
    const mins = parseInt(minutes) || 0;
    const secs = parseInt(seconds) || 0;
    return (mins * 60) + secs;
  };

  // Handle duration input changes
  const handleDurationMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setDurationMinutes(value);
    }
  };

  const handleDurationSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers between 0 and 59
    if (value === '' || /^\d+$/.test(value)) {
      const numValue = parseInt(value);
      if (numValue <= 59) {
        setDurationSeconds(value);
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Videos</h1>
        <button onClick={openCreateModal} className="btn-primary flex items-center space-x-2">
          <Plus size={20} />
          <span>Add Video</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4 flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search videos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading videos...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thumbnail
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Language
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {videos.map((video: any) => (
                    <tr key={video.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {video.thumbnail_url && (
                          <img
                            src={getImageUrl(video.thumbnail_url)}
                            alt={video.title}
                            className="w-16 h-12 object-cover rounded"
                            onError={(e) => {
                              // Fallback to a default image or hide on error
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium text-gray-900">{video.title}</div>
                          <a 
                            href={video.youtube_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          {video.language}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{video.category || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDuration(video.duration)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            video.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {video.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={() => handleToggleActive(video.id, video.is_active)}
                            className={`px-3 py-1 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                              video.is_active
                                ? 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100'
                                : 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                            title={video.is_active ? 'Click to deactivate video' : 'Click to activate video'}
                          >
                            <div className="flex items-center space-x-1">
                              {video.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                              <span className="text-xs font-medium">
                                {video.is_active ? 'ON' : 'OFF'}
                              </span>
                            </div>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handlePlayVideo(video)}
                          className="text-green-600 hover:text-green-900 mr-3"
                          title="Play video"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(video)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(video.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingVideo ? 'Edit Video' : 'Create Video'}
            </h2>
            
            <form onSubmit={handleSubmit(handleCreateOrUpdate)}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  {...register('title', { required: 'Title is required' })}
                  className="input-field w-full"
                />
                {errors.title && (
                  <p className="text-red-500 text-sm mt-1">{errors.title.message as string}</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  {...register('description')}
                  className="input-field w-full"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Video Source</label>
                <select
                  {...register('video_source', { required: 'Video source is required' })}
                  className="input-field w-full"
                  value={videoSource}
                  onChange={(e) => {
                    const value = e.target.value as 'youtube' | 'local';
                    setVideoSource(value);
                    // Update react-hook-form value
                    setValue('video_source', value);
                    // Clear validation errors when switching source
                    setUploadError('');
                  }}
                >
                  <option value="youtube">YouTube</option>
                  <option value="local">Local Upload</option>
                </select>
                {errors.video_source && (
                  <p className="text-red-500 text-sm mt-1">{errors.video_source.message as string}</p>
                )}
              </div>

              {videoSource === 'youtube' && (
                <div className="form-group">
                  <label className="form-label">YouTube URL</label>
                <input
                  {...register('youtube_url', {
                    required: videoSource === 'youtube' ? 'YouTube URL is required' : false,
                    pattern: {
                      value: /^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/,
                      message: 'Invalid YouTube URL'
                    }
                  })}
                  type="url"
                  className="input-field w-full"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                {errors.youtube_url && (
                  <p className="text-red-500 text-sm mt-1">{errors.youtube_url.message as string}</p>
                )}
              </div>
              )}

              {videoSource === 'local' && (
                <div className="form-group">
                  <label className="form-label">Video File</label>
                  <div className="flex items-center space-x-2">
                    <Upload size={20} className="text-gray-500" />
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoChange}
                      ref={videoFileRef}
                      className="input-field w-full"
                    />
                  </div>
                  {videoFile && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center space-x-2">
                        <CheckCircle size={16} className="text-green-600" />
                        <span className="text-sm text-green-800">{videoFile.name}</span>
                        <span className="text-xs text-gray-500">
                          ({formatFileSize(videoFile.size)})
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="text-gray-500 text-sm mt-1">
                    Supported formats: MP4, AVI, MOV, WMV, WebM, MKV, MPEG, MPG (Max 500MB)
                  </p>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Thumbnail {videoSource === 'local' ? '(Required)' : '(Optional)'}</label>
                <div className="flex items-center space-x-2">
                  <Upload size={20} className="text-gray-500" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    ref={thumbnailFileRef}
                    className="input-field w-full"
                  />
                </div>
                {thumbnailFile && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="text-sm text-green-800">{thumbnailFile.name}</span>
                      <span className="text-xs text-gray-500">
                        ({formatFileSize(thumbnailFile.size)})
                      </span>
                    </div>
                  </div>
                )}
                {thumbnailPreview && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                    <div className="relative inline-block">
                      <img
                        src={thumbnailPreview}
                        alt="Thumbnail preview"
                        className="w-40 h-28 object-cover rounded-lg shadow-md border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setThumbnailFile(null);
                          setThumbnailPreview('');
                          if (thumbnailFileRef.current) {
                            thumbnailFileRef.current.value = '';
                          }
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg"
                        title="Remove thumbnail"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-gray-500 text-sm mt-1">
                  {videoSource === 'youtube'
                    ? 'If not provided, YouTube thumbnail will be used automatically'
                    : 'Thumbnail is required for local video uploads'
                  }
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Language</label>
                <select {...register('language', { required: 'Language is required' })} className="input-field w-full">
                  <option value="tamil">Tamil</option>
                  <option value="english">English</option>
                  <option value="telugu">Telugu</option>
                  <option value="hindi">Hindi</option>
                </select>
                {errors.language && (
                  <p className="text-red-500 text-sm mt-1">{errors.language.message as string}</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <input
                  {...register('category')}
                  className="input-field w-full"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Duration</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={durationMinutes}
                    onChange={handleDurationMinutesChange}
                    placeholder="Minutes"
                    className="input-field w-24"
                    maxLength={3}
                  />
                  <span className="text-gray-500">:</span>
                  <input
                    type="text"
                    value={durationSeconds}
                    onChange={handleDurationSecondsChange}
                    placeholder="Seconds"
                    className="input-field w-24"
                    maxLength={2}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Enter video duration in minutes and seconds (e.g., 5:30 for 5 minutes 30 seconds)
                </p>
              </div>

              <div className="form-group">
                <label className="flex items-center">
                  <input
                    {...register('is_active')}
                    type="checkbox"
                    className="mr-2"
                  />
                  <span>Active</span>
                </label>
              </div>

              {/* Upload Progress and Status */}
              {(uploadProgress > 0 || uploadStatus || uploadError) && (
                <div className="form-group">
                  {uploadProgress > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                  {uploadStatus && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="flex items-center space-x-2">
                        <File size={16} className="text-blue-600" />
                        <span className="text-sm text-blue-800">{uploadStatus}</span>
                      </div>
                    </div>
                  )}
                  {uploadError && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="flex items-center space-x-2">
                        <AlertCircle size={16} className="text-red-600" />
                        <span className="text-sm text-red-800">{uploadError}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={openPreview}
                  className="btn-orange disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUploading}
                >
                  <div className="flex items-center space-x-2">
                    <Eye size={16} />
                    <span>Preview</span>
                  </div>
                </button>
                <button
                  type="submit"
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{editingVideo ? 'Updating...' : 'Creating...'}</span>
                    </div>
                  ) : (
                    <span>{editingVideo ? 'Update' : 'Create'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Preview Modal */}
      {showPreview && previewData && (
        <VideoPreview
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          previewData={previewData}
          onSave={handlePreviewSave}
          onUpload={handlePreviewUpload}
        />
      )}

      {/* Video Player Modal */}
      {showVideoPlayer && playingVideo && (
        <VideoPlayer
          isOpen={showVideoPlayer}
          onClose={() => {
            setShowVideoPlayer(false);
            setPlayingVideo(null);
          }}
          video={playingVideo}
        />
      )}
    </div>
  );
};

export default Videos;