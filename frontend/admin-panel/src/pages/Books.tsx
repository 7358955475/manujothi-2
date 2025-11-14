import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Search, Upload, File, Eye, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { booksApi } from '../services/api';
import BookPreview from '../components/BookPreview';

const Books: React.FC = () => {
  const [books, setBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBook, setEditingBook] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string>('');

  const pdfFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();

  // Helper function to construct correct image URLs
  const getImageUrl = (imageUrl: string | null): string | undefined => {
    if (!imageUrl) return undefined;

    // If it's already a full URL (starts with http), return as is
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }

    // If it's a local path starting with /public, prepend backend URL
    if (imageUrl.startsWith('/public')) {
      return `http://localhost:3001${imageUrl}`;
    }

    // Default: assume it's a relative path to images (same logic as user panel)
    return `http://localhost:3001${imageUrl.startsWith('/') ? imageUrl : '/public/images/' + imageUrl}`;
  };

  useEffect(() => {
    fetchBooks();
  }, [currentPage, searchTerm]);

  const fetchBooks = async () => {
    setIsLoading(true);
    try {
      const response = await booksApi.getAll({
        page: currentPage,
        limit: 10,
        search: searchTerm
      });
      setBooks(response.data.books);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error('Error fetching books:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateFiles = () => {
    const errors = [];

    if (selectedPdfFile) {
      if (selectedPdfFile.size > 50 * 1024 * 1024) {
        errors.push('PDF file is too large (max 50MB)');
      }
      if (!selectedPdfFile.name.toLowerCase().endsWith('.pdf')) {
        errors.push('PDF file must have .pdf extension');
      }
    }

    if (selectedCoverFile) {
      if (selectedCoverFile.size > 10 * 1024 * 1024) {
        errors.push('Cover image is too large (max 10MB)');
      }
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(selectedCoverFile.type)) {
        errors.push('Cover image must be JPEG, PNG, or WebP');
      }
    }

    return errors;
  };

  const handleCreateOrUpdate = async (data: any) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('');
    setUploadError('');

    try {
      // Validate files before upload
      const validationErrors = validateFiles();
      if (validationErrors.length > 0) {
        setUploadError(validationErrors.join(', '));
        return;
      }

      setUploadStatus('Preparing upload...');
      setUploadProgress(10);

      const formData = new FormData();

      // Add text fields, but skip cover_image_url if a cover file is being uploaded
      Object.keys(data).forEach(key => {
        // IMPORTANT: Skip cover_image_url if a cover file is being uploaded
        // This ensures uploaded files take priority over URL fields
        if (key === 'cover_image_url' && selectedCoverFile) {
          console.log('Skipping cover_image_url because cover file is being uploaded');
          return;
        }

        // IMPORTANT: Skip pdf_url if a book file is being uploaded
        // This ensures uploaded files take priority over URL fields
        if (key === 'pdf_url' && selectedPdfFile) {
          console.log('Skipping pdf_url because book file is being uploaded');
          return;
        }

        if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
          formData.append(key, data[key]);
        }
      });

      setUploadStatus('Processing files...');
      setUploadProgress(25);

      // Add book file if selected
      if (selectedPdfFile) {
        console.log('Uploading book file:', selectedPdfFile.name);
        formData.append('bookFile', selectedPdfFile);
        setUploadStatus(`Uploading book: ${selectedPdfFile.name}...`);
      }

      // Add cover image file if selected
      if (selectedCoverFile) {
        console.log('Uploading cover file:', selectedCoverFile.name);
        formData.append('coverFile', selectedCoverFile);
        setUploadStatus('Uploading cover image...');
      }

      setUploadProgress(50);

      if (editingBook) {
        setUploadStatus('Updating book...');
        await booksApi.update(editingBook.id, formData);
      } else {
        setUploadStatus('Creating book...');
        await booksApi.create(formData);
      }

      setUploadProgress(85);
      setUploadStatus('Finalizing...');

      setUploadProgress(100);
      setUploadStatus('Success! Book saved successfully.');

      setTimeout(() => {
        setShowModal(false);
        setEditingBook(null);
        setSelectedPdfFile(null);
        setSelectedCoverFile(null);
        setUploadProgress(0);
        setUploadStatus('');
        reset();
        fetchBooks();
      }, 1000);

    } catch (error: any) {
      console.error('Error saving book:', error);

      let errorMessage = 'Error saving book. Please try again.';

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setUploadError(errorMessage);
      setUploadStatus('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleEdit = (book: any) => {
    setEditingBook(book);
    setSelectedPdfFile(null);
    setSelectedCoverFile(null);
    reset(book);
    setShowModal(true);
  };

  const handlePdfFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setUploadError('');

    if (!file) return;

    const errors = [];
    const fileName = file.name.toLowerCase();
    const allowedExtensions = ['.pdf', '.txt'];
    const extension = fileName.substring(fileName.lastIndexOf('.'));

    if (!allowedExtensions.includes(extension)) {
      errors.push('File must be PDF or TXT format');
    }

    if (extension === '.pdf' && file.type !== 'application/pdf') {
      errors.push('File must be a valid PDF');
    }

    if (extension === '.txt' && !file.type.includes('text')) {
      errors.push('File must be a valid text file');
    }

    if (file.size > 50 * 1024 * 1024) {
      errors.push('File is too large (max 50MB)');
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    if (errors.length > 0) {
      setUploadError(`Book file error: ${errors.join(', ')}`);
      if (pdfFileRef.current) {
        pdfFileRef.current.value = '';
      }
      return;
    }

    setSelectedPdfFile(file);
  };

  const handleCoverFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setUploadError('');

    if (!file) return;

    const errors = [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const fileExtension = file.name.toLowerCase().split('.').pop();

    if (!allowedTypes.includes(file.type)) {
      errors.push('File must be JPEG, PNG, or WebP');
    }

    if (!allowedExtensions.includes(`.${fileExtension}`)) {
      errors.push('File must have a valid image extension');
    }

    if (file.size > 10 * 1024 * 1024) {
      errors.push('File is too large (max 10MB)');
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    if (errors.length > 0) {
      setUploadError(`Cover image error: ${errors.join(', ')}`);
      if (coverFileRef.current) {
        coverFileRef.current.value = '';
      }
      setCoverPreviewUrl('');
      return;
    }

    setSelectedCoverFile(file);

    // Create preview URL for the selected cover image
    const reader = new FileReader();
    reader.onload = (e) => {
      setCoverPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const openCreateModal = () => {
    setEditingBook(null);
    setSelectedPdfFile(null);
    setSelectedCoverFile(null);
    setCoverPreviewUrl('');
    setUploadProgress(0);
    setUploadStatus('');
    setUploadError('');
    reset({ language: 'english', is_active: true });
    setShowModal(true);
  };

  const handleDelete = async (bookId: string) => {
    if (confirm('Are you sure you want to delete this book?')) {
      try {
        await booksApi.delete(bookId);
        fetchBooks();
      } catch (error) {
        console.error('Error deleting book:', error);
      }
    }
  };

  // Preview functions
  const handlePreview = () => {
    const currentValues = {
      title: watch('title') || 'Untitled Book',
      description: watch('description') || '',
      author: watch('author') || 'Unknown Author',
      language: watch('language') || 'english',
      genre: watch('genre') || '',
      published_year: watch('published_year') ? parseInt(watch('published_year')) : undefined,
      isbn: watch('isbn') || '',
      fileFormat: 'pdf',
      cover_image_url: watch('cover_image_url')
    };

    const previewData = {
      title: currentValues.title,
      description: currentValues.description,
      author: currentValues.author,
      language: currentValues.language,
      genre: currentValues.genre,
      published_year: currentValues.published_year,
      isbn: currentValues.isbn,
      fileFormat: currentValues.fileFormat,
      bookFile: selectedPdfFile,
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
    setValue('language', editedData.language);
    setValue('genre', editedData.genre);
    setValue('published_year', editedData.published_year);
    setValue('isbn', editedData.isbn);
    setValue('cover_image_url', editedData.cover_url);

    setSelectedPdfFile(editedData.bookFile);
    setSelectedCoverFile(editedData.coverFile);
    setUploadError('');
  };

  const handlePreviewUpload = () => {
    setShowPreview(false);
    // Submit the form
    handleSubmit(handleCreateOrUpdate)();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Books</h1>
        <button onClick={openCreateModal} className="btn-primary flex items-center space-x-2">
          <Plus size={20} />
          <span>Add Book</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4 flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search books..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading books...</div>
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
                      Language
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Genre
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
                  {books.map((book: any) => (
                    <tr key={book.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <img 
                          src={getImageUrl(book.cover_image_url) || 'https://images.pexels.com/photos/1130980/pexels-photo-1130980.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop'} 
                          alt={book.title}
                          className="w-12 h-16 object-contain rounded shadow-sm"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{book.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{book.author}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {book.language}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{book.genre || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          book.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {book.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(book)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(book.id)}
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
              {editingBook ? 'Edit Book' : 'Create Book'}
            </h2>

            {editingBook && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Note:</strong> Your current cover image and PDF file are preserved. Only upload new files if you want to replace them.
                </p>
              </div>
            )}

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
                <label className="form-label">Description</label>
                <textarea
                  {...register('description')}
                  className="input-field w-full"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cover Image</label>
                <div className="space-y-3">
                  {/* Show current cover preview when editing */}
                  {editingBook && watch('cover_image_url') && !selectedCoverFile && (
                    <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                      <img
                        src={getImageUrl((watch('cover_image_url') as string) || '')}
                        alt="Current cover"
                        className="w-16 h-20 object-contain rounded border border-gray-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/1130980/pexels-photo-1130980.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop';
                        }}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">Current cover image</div>
                        <div className="text-xs text-gray-500">This image will be kept unless you upload a new one</div>
                      </div>
                    </div>
                  )}

                  {/* Show new file preview when a new file is selected */}
                  {selectedCoverFile && (
                    <div className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg">
                      {coverPreviewUrl ? (
                        <div className="relative">
                          <img
                            src={coverPreviewUrl}
                            alt="Cover preview"
                            className="w-20 h-28 object-contain rounded border-2 border-green-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCoverFile(null);
                              setCoverPreviewUrl('');
                              if (coverFileRef.current) {
                                coverFileRef.current.value = '';
                              }
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg"
                            title="Remove cover image"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-20 bg-green-100 border border-green-300 rounded flex items-center justify-center">
                          <File size={24} className="text-green-600" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-medium text-green-700">New cover image selected</div>
                        <div className="text-xs text-green-600">{selectedCoverFile.name}</div>
                        <div className="text-xs text-green-500">
                          {(selectedCoverFile.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                  )}

                  <input
                    {...register('cover_image_url')}
                    type="url"
                    placeholder="Or enter image URL"
                    className="input-field w-full"
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => coverFileRef.current?.click()}
                      className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      <Upload size={16} />
                      <span>{editingBook ? 'Change Image' : 'Upload Image'}</span>
                    </button>
                  </div>
                  <input
                    ref={coverFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFileSelect}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Book File (PDF or TXT)</label>
                <div className="space-y-3">
                  {/* Show current file indicator when editing */}
                  {editingBook && watch('pdf_url') && !selectedPdfFile && (
                    <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-16 h-20 bg-red-100 border border-red-300 rounded flex items-center justify-center">
                        <File size={24} className="text-red-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">Current book file</div>
                        <div className="text-xs text-gray-500">This file will be kept unless you upload a new one</div>
                        <div className="text-xs text-gray-400 truncate max-w-xs">{watch('pdf_url')}</div>
                      </div>
                    </div>
                  )}

                  {/* Show new file preview when a new file is selected */}
                  {selectedPdfFile && (
                    <div className="flex items-center space-x-4 p-3 bg-green-50 rounded-lg">
                      <div className="w-16 h-20 bg-green-100 border border-green-300 rounded flex items-center justify-center">
                        <File size={24} className="text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-green-700">New book file selected</div>
                        <div className="text-xs text-green-600">{selectedPdfFile.name}</div>
                        <div className="text-xs text-green-500">
                          {(selectedPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                  )}

                  <input
                    {...register('pdf_url')}
                    type="url"
                    placeholder="Or enter book file URL"
                    className="input-field w-full"
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => pdfFileRef.current?.click()}
                      className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      <Upload size={16} />
                      <span>{editingBook ? 'Change File' : 'Upload Book (PDF/TXT)'}</span>
                    </button>
                  </div>
                  <input
                    ref={pdfFileRef}
                    type="file"
                    accept=".pdf,.txt,application/pdf,text/plain"
                    onChange={handlePdfFileSelect}
                    className="hidden"
                  />
                </div>
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
                <label className="form-label">Published Year</label>
                <input
                  {...register('published_year')}
                  type="number"
                  min="1000"
                  max={new Date().getFullYear()}
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

              {/* Upload Progress and Error Display */}
              {(isUploading || uploadStatus || uploadError) && (
                <div className="form-group">
                  {uploadError && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                      <div className="flex items-center">
                        <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-800 font-medium">Upload Error</span>
                      </div>
                      <p className="text-red-700 mt-1">{uploadError}</p>
                    </div>
                  )}

                  {isUploading && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-blue-800 font-medium">Uploading...</span>
                        <span className="text-blue-600 text-sm">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      {uploadStatus && (
                        <p className="text-blue-700 text-sm">{uploadStatus}</p>
                      )}
                    </div>
                  )}

                  {uploadStatus && !isUploading && !uploadError && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                      <div className="flex items-center">
                        <svg className="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-800 font-medium">{uploadStatus}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isUploading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                >
                  {isUploading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{uploadProgress}%</span>
                    </div>
                  ) : uploadStatus && !uploadError ? (
                    <div className="flex items-center space-x-2">
                      <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Success</span>
                    </div>
                  ) : (
                    editingBook ? 'Update Book' : 'Create Book'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Preview Modal */}
      {showPreview && previewData && (
        <BookPreview
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

export default Books;