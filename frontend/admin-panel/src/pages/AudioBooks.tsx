import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Search, Upload, File, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { audioBooksApi } from '../services/api';
import AudioPreview from '../components/AudioPreview';

const AudioBooks: React.FC = () => {
  const [audioBooks, setAudioBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAudioBook, setEditingAudioBook] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const audioFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  // Enhanced file validation
  const validateAudioFile = (file: File): string | null => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/x-m4a'];
    const allowedExtensions = ['.mp3', '.wav', '.ogg', '.m4a'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension) && !allowedTypes.includes(file.type)) {
      return 'Only MP3, WAV, OGG, and M4A audio files are allowed';
    }

    if (file.size > 100 * 1024 * 1024) {
      return 'Audio file size must be less than 100MB';
    }

    if (file.size === 0) {
      return 'Audio file is empty or corrupted';
    }

    return null;
  };

  const validateCoverFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension) && !allowedTypes.includes(file.type)) {
      return 'Only JPEG, PNG, and WebP images are allowed';
    }

    if (file.size > 10 * 1024 * 1024) {
      return 'Cover image size must be less than 10MB';
    }

    if (file.size === 0) {
      return 'Cover image file is empty or corrupted';
    }

    return null;
  };

  // Enhanced file selection handlers
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateAudioFile(file);
      if (error) {
        setUploadError(error);
        setSelectedAudioFile(null);
        return;
      }
      setSelectedAudioFile(file);
      setUploadError('');
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateCoverFile(file);
      if (error) {
        setUploadError(error);
        setSelectedCoverFile(null);
        return;
      }
      setSelectedCoverFile(file);
      setUploadError('');
    }
  };

  // Enhanced file upload with progress tracking
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
      xhr.open('POST', editingAudioBook ?
        audioBooksApi.getEndpoint(`/${editingAudioBook.id}`) :
        audioBooksApi.getEndpoint('')
      );

      // Add authorization header if needed
      const token = localStorage.getItem('adminToken');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Send form data with files
      xhr.send(formData);
    });
  };

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();

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

  useEffect(() => {
    fetchAudioBooks();
  }, [currentPage, searchTerm]);

  const fetchAudioBooks = async () => {
    setIsLoading(true);
    try {
      const response = await audioBooksApi.getAll({
        page: currentPage,
        limit: 10
      });
      setAudioBooks(response.data.audioBooks);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching audio books:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrUpdate = async (data: any) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('Preparing upload...');
    setUploadError('');

    try {
      const formData = new FormData();

      // Append form fields
      Object.keys(data).forEach(key => {
        if (key !== 'audio' && key !== 'coverFile' && data[key] !== undefined && data[key] !== '') {
          formData.append(key, data[key]);
        }
      });

      // Append audio file if provided
      if (data.audio && data.audio[0]) {
        formData.append('audioFile', data.audio[0]);
      } else if (selectedAudioFile) {
        formData.append('audioFile', selectedAudioFile);
      }

      // Append cover image file if provided
      if (data.coverFile && data.coverFile[0]) {
        formData.append('coverFile', data.coverFile[0]);
      } else if (selectedCoverFile) {
        formData.append('coverFile', selectedCoverFile);
      }

      // Add method for update if editing
      if (editingAudioBook) {
        formData.append('_method', 'PUT');
      }

      setUploadStatus('Uploading files...');
      await uploadWithProgress(formData);

      setShowModal(false);
      setEditingAudioBook(null);
      setSelectedAudioFile(null);
      setSelectedCoverFile(null);
      reset();
      fetchAudioBooks();
    } catch (error: any) {
      console.error('Error saving audio book:', error);
      setUploadError(error.message || 'Failed to save audio book');
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStatus('');
        setUploadError('');
      }, 3000);
    }
  };

  const handleEdit = (audioBook: any) => {
    setEditingAudioBook(audioBook);
    reset(audioBook);
    setShowModal(true);
  };

  const handleDelete = async (audioBookId: string) => {
    if (confirm('Are you sure you want to delete this audio book?')) {
      try {
        await audioBooksApi.delete(audioBookId);
        fetchAudioBooks();
      } catch (error) {
        console.error('Error deleting audio book:', error);
      }
    }
  };

  const openCreateModal = () => {
    setEditingAudioBook(null);
    setSelectedAudioFile(null);
    setSelectedCoverFile(null);
    setUploadError('');
    setUploadStatus('');
    setUploadProgress(0);
    reset({ language: 'english', is_active: true });
    setShowModal(true);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Preview functions
  const handlePreview = () => {
    const currentValues = {
      title: watch('title') || 'Untitled Audiobook',
      description: watch('description') || '',
      author: watch('author') || 'Unknown Author',
      narrator: watch('narrator') || 'Unknown Narrator',
      language: watch('language') || 'english',
      genre: watch('genre') || '',
      cover_image_url: watch('cover_image_url')
    };

    const previewData = {
      title: currentValues.title,
      description: currentValues.description,
      author: currentValues.author,
      narrator: currentValues.narrator,
      language: currentValues.language,
      genre: currentValues.genre,
      audioFile: selectedAudioFile,
      coverFile: selectedCoverFile,
      cover_url: currentValues.cover_image_url
    };

    setPreviewData(previewData);
    setShowPreview(true);
  };

  const handlePreviewSave = (editedData: any) => {
    // Update form with edited data
    setValue('title', editedData.title);
    setValue('description', editedData.description);
    setValue('author', editedData.author);
    setValue('narrator', editedData.narrator);
    setValue('language', editedData.language);
    setValue('genre', editedData.genre);
    setValue('cover_image_url', editedData.cover_url);

    setSelectedAudioFile(editedData.audioFile);
    setSelectedCoverFile(editedData.coverFile);
    setUploadError('');
  };

  const handlePreviewUpload = () => {
    setShowPreview(false);
    // Submit the form
    handleSubmit(handleCreateOrUpdate)();
  };

  
  const formatDuration = (seconds: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Audio Books</h1>
        <button onClick={openCreateModal} className="btn-primary flex items-center space-x-2">
          <Plus size={20} />
          <span>Add Audio Book</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4 flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search audio books..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading audio books...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cover
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Author
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Narrator
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Language
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Size
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
                  {audioBooks.map((audioBook: any) => (
                    <tr key={audioBook.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <img 
                          src={getImageUrl(audioBook.cover_image_url) || 'https://images.pexels.com/photos/3184419/pexels-photo-3184419.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop'} 
                          alt={audioBook.title}
                          className="w-12 h-16 object-cover rounded shadow-sm"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{audioBook.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{audioBook.author}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{audioBook.narrator || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                          {audioBook.language}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDuration(audioBook.duration)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatFileSize(audioBook.file_size)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          audioBook.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {audioBook.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(audioBook)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(audioBook.id)}
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
              {editingAudioBook ? 'Edit Audio Book' : 'Create Audio Book'}
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
                <label className="form-label">Author</label>
                <input
                  {...register('author', { required: 'Author is required' })}
                  className="input-field w-full"
                />
                {errors.author && (
                  <p className="text-red-500 text-sm mt-1">{errors.author.message as string}</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Narrator</label>
                <input
                  {...register('narrator')}
                  className="input-field w-full"
                />
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
                <label className="form-label">Cover Image URL</label>
                <input
                  {...register('cover_image_url')}
                  type="url"
                  className="input-field w-full"
                  placeholder="Or upload cover image file below"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cover Image File</label>
                <div className="flex items-center space-x-2">
                  <Upload size={20} className="text-gray-500" />
                  <input
                    type="file"
                    accept="image/*"
                    className="input-field w-full"
                    onChange={handleCoverFileChange}
                    ref={coverFileRef}
                  />
                </div>
                {selectedCoverFile && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="text-sm text-green-800">{selectedCoverFile.name}</span>
                      <span className="text-xs text-gray-500">
                        ({formatFileSize(selectedCoverFile.size)})
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: JPEG, PNG, WebP (Max: 10MB)
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Audio File {!editingAudioBook && <span className="text-red-500">*</span>}
                </label>
                <div className="flex items-center space-x-2">
                  <Upload size={20} className="text-gray-500" />
                  <input
                    type="file"
                    accept="audio/*"
                    className="input-field w-full"
                    onChange={handleAudioFileChange}
                    ref={audioFileRef}
                  />
                </div>
                {selectedAudioFile && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="text-sm text-green-800">{selectedAudioFile.name}</span>
                      <span className="text-xs text-gray-500">
                        ({formatFileSize(selectedAudioFile.size)})
                      </span>
                    </div>
                  </div>
                )}
                {errors.audio && (
                  <p className="text-red-500 text-sm mt-1">{errors.audio.message as string}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: MP3, WAV, M4A, OGG (Max: 100MB)
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
                <label className="form-label">Genre</label>
                <input
                  {...register('genre')}
                  className="input-field w-full"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Duration (seconds)</label>
                <input
                  {...register('duration')}
                  type="number"
                  min="0"
                  className="input-field w-full"
                />
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
                  onClick={handlePreview}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUploading}
                >
                  <Eye size={16} />
                  <span>Preview</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{editingAudioBook ? 'Updating...' : 'Creating...'}</span>
                    </div>
                  ) : (
                    <span>{editingAudioBook ? 'Update' : 'Create'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audio Preview Modal */}
      {showPreview && previewData && (
        <AudioPreview
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          previewData={previewData}
          onSave={handlePreviewSave}
          onUpload={handlePreviewUpload}
        />
      )}
    </div>
  );
};

export default AudioBooks;