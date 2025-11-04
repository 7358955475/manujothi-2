import React, { useState, useRef, useEffect } from 'react';
import { X, Edit3, Save, Upload, Book, FileText, Download, Eye, EyeOff, Calendar, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface BookPreviewData {
  title: string;
  description: string;
  author: string;
  language: string;
  genre: string;
  published_year?: number;
  isbn?: string;
  fileFormat: string;
  bookFile?: File;
  coverFile?: File;
  cover_url?: string;
}

interface BookPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: BookPreviewData;
  onSave: (editedData: BookPreviewData) => void;
  onUpload: () => void;
}

const BookPreview: React.FC<BookPreviewProps> = ({
  isOpen,
  onClose,
  previewData,
  onSave,
  onUpload
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<BookPreviewData>(previewData);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [showBookPreview, setShowBookPreview] = useState(true);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string>('');
  const [pdfPreview, setPdfPreview] = useState<string>('');
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pdfError, setPdfError] = useState<string>('');
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [textContent, setTextContent] = useState<string>('');
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [textError, setTextError] = useState<string>('');
  const [showTextViewer, setShowTextViewer] = useState(false);

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
    'Education', 'Health', 'Psychology', 'Art', 'Comics'
  ];

  const fileFormats = [
    { value: 'pdf', label: 'PDF', accept: '.pdf' },
    { value: 'epub', label: 'EPUB', accept: '.epub' },
    { value: 'mobi', label: 'MOBI', accept: '.mobi' },
    { value: 'txt', label: 'TXT', accept: '.txt' }
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

  // Cleanup object URLs when component unmounts or book file changes
  useEffect(() => {
    return () => {
      if (pdfObjectUrl) {
        URL.revokeObjectURL(pdfObjectUrl);
        setPdfObjectUrl('');
      }
    };
  }, []);

  useEffect(() => {
    setEditedData(previewData);

    // Cleanup previous object URL
    if (pdfObjectUrl) {
      URL.revokeObjectURL(pdfObjectUrl);
      setPdfObjectUrl('');
    }

    // Generate cover preview for local books
    if (previewData.bookFile) {
      const newObjectUrl = URL.createObjectURL(previewData.bookFile);
      setPdfObjectUrl(newObjectUrl);

      const extension = previewData.bookFile.name.toLowerCase().split('.').pop();
      if (extension === 'pdf' || previewData.bookFile.type === 'application/pdf') {
        loadPdfPages(previewData.bookFile);
      } else if (extension === 'txt' || previewData.bookFile.type === 'text/plain') {
        loadTextContent(previewData.bookFile);
      }
    } else if (previewData.cover_url) {
      // Use existing cover URL
      setCoverPreview(getImageUrl(previewData.cover_url));
    }
  }, [previewData]);

  const analyzeBookFile = async (file: File) => {
    const extension = file.name.toLowerCase().split('.').pop();

    if (file.type === 'application/pdf' || extension === 'pdf') {
      await loadPdfPages(file);
    } else if (extension === 'txt' || file.type === 'text/plain') {
      await loadTextContent(file);
    }

    // Update file format based on file
    const format = fileFormats.find(f => f.value === extension);
    if (format) {
      setEditedData(prev => ({
        ...prev,
        fileFormat: format.value
      }));
    }
  };

  const loadTextContent = async (file: File) => {
    setIsTextLoading(true);
    setTextError('');
    setTextContent('');

    try {
      const text = await file.text();
      setTextContent(text);
      setIsTextLoading(false);
    } catch (error) {
      console.error('Error loading text file:', error);
      setTextError('Failed to load text file');
      setIsTextLoading(false);
    }
  };

  const openTextViewer = () => {
    setShowTextViewer(true);
  };

  const closeTextViewer = () => {
    setShowTextViewer(false);
  };

  const loadPdfPages = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      setPdfError('Please upload a valid PDF file');
      return;
    }

    setIsPdfLoading(true);
    setPdfError('');
    setPdfPages([]);
    setCurrentPage(1);
    setTotalPages(0);
    setZoomLevel(1);
    setRotation(0);

    try {
      // Load PDF.js from CDN for PDF rendering
      const pdfjsScript = document.createElement('script');
      pdfjsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      pdfjsScript.onload = async () => {
        const pdfWorkerScript = document.createElement('script');
        pdfWorkerScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        pdfWorkerScript.onload = async () => {
          // @ts-ignore - PDF.js global
          const pdfjsLib = (window as any).pdfjsLib;

          // Set the worker
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

          try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            const pageImages: string[] = [];

            // Render first few pages as thumbnails
            const maxPreviewPages = Math.min(pdf.numPages, 5);

            for (let pageNum = 1; pageNum <= maxPreviewPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: 1.5 });

              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.width = viewport.width;
              canvas.height = viewport.height;

              await page.render({
                canvasContext: context,
                viewport: viewport
              }).promise;

              pageImages.push(canvas.toDataURL('image/png', 0.8));
            }

            // Create full-resolution pages for viewer
            const fullPageImages: string[] = [];
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: 2.0 });

              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.width = viewport.width;
              canvas.height = viewport.height;

              await page.render({
                canvasContext: context,
                viewport: viewport
              }).promise;

              fullPageImages.push(canvas.toDataURL('image/png', 1.0));
            }

            setPdfPages(fullPageImages);
            setTotalPages(pdf.numPages);
            setPdfPreview(pageImages[0] || ''); // Show first page as thumbnail
            setIsPdfLoading(false);

          } catch (error) {
            console.error('Error loading PDF:', error);
            setPdfError('Failed to load PDF. Please try again.');
            setIsPdfLoading(false);

            // Fallback to simple preview
            setPdfPreview(`data:image/svg+xml;base64,${btoa(`
              <svg width="200" height="280" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="280" fill="#ffffff" stroke="#ddd" stroke-width="1"/>
                <rect x="10" y="10" width="180" height="260" fill="#fafafa"/>
                <text x="100" y="130" text-anchor="middle" font-family="Arial" font-size="12" fill="#333">${file.name}</text>
                <text x="100" y="150" text-anchor="middle" font-family="Arial" font-size="10" fill="#666">PDF Preview</text>
                <text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="8" fill="#999">${(file.size / 1024).toFixed(1)} KB</text>
              </svg>
            `)}`);
          }
        };

        document.head.appendChild(pdfWorkerScript);

      };

      document.head.appendChild(pdfjsScript);

    } catch (error) {
      console.error('Error setting up PDF viewer:', error);
      setPdfError('Failed to initialize PDF viewer.');
      setIsPdfLoading(false);
    }
  };

  // PDF viewer navigation functions
  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setZoomLevel(1);
  };

  const rotatePdf = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const openPdfViewer = () => {
    setShowPdfViewer(true);
  };

  const closePdfViewer = () => {
    setShowPdfViewer(false);
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

  const handleInputChange = (field: keyof BookPreviewData, value: any) => {
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

  const handleBookFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditedData(prev => ({
        ...prev,
        bookFile: file
      }));
      // Analyze the book file to extract metadata and generate preview
      analyzeBookFile(file);
    }
  };

  const handleDownloadPreview = () => {
    if (previewData.bookFile) {
      const url = URL.createObjectURL(previewData.bookFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = previewData.title || 'book-preview';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getFileDisplayInfo = () => {
    const format = fileFormats.find(f => f.value === previewData.fileFormat);
    return {
      name: format?.label || previewData.fileFormat.toUpperCase(),
      icon: previewData.fileFormat === 'pdf' ? FileText : Book,
      color: previewData.fileFormat === 'pdf' ? 'red' : 'blue'
    };
  };

  if (!isOpen) return null;

  const fileInfo = getFileDisplayInfo();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl w-full max-w-7xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 sm:p-6 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {React.createElement(fileInfo.icon, { size: 24, className: "flex-shrink-0" })}
            <h2 className="text-lg sm:text-2xl font-bold truncate">
              {fileInfo.name} Book Preview
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

        <div className="flex flex-col lg:flex-row h-[calc(95vh-8rem)] sm:h-[calc(90vh-8rem)]">
          {/* Book Preview Section */}
          <div className="w-full lg:w-1/2 bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-800 text-lg font-semibold">Book Preview</h3>
              <button
                onClick={() => setShowBookPreview(!showBookPreview)}
                className="text-gray-600 hover:text-gray-800 transition-colors"
                title={showBookPreview ? 'Hide Book Preview' : 'Show Book Preview'}
              >
                {showBookPreview ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {showBookPreview && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                {/* Cover Image */}
                <div className="relative">
                  <div className="w-48 h-64 bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                    {coverPreview ? (
                      <img
                        src={coverPreview}
                        alt="Book cover"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gradient-to-br from-gray-50 to-gray-100">
                        {React.createElement(fileInfo.icon, { size: 48 })}
                        <span className="text-sm mt-2">{fileInfo.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* PDF Document Preview */}
                {(previewData.fileFormat === 'pdf' && pdfPreview) && (
                  <div className="relative">
                    <div className="w-32 h-44 bg-white rounded shadow-md overflow-hidden border border-gray-300 cursor-pointer hover:shadow-lg transition-shadow"
                         onClick={() => pdfPages.length > 0 && openPdfViewer()}>
                      {isPdfLoading ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                      ) : (
                        <img
                          src={pdfPreview}
                          alt="PDF preview"
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>
                    {pdfPages.length > 0 && (
                      <button
                        onClick={() => openPdfViewer()}
                        className="mt-2 w-full text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 transition-colors"
                      >
                        View All Pages ({totalPages})
                      </button>
                    )}
                    {pdfError && (
                      <p className="mt-1 text-xs text-red-600 text-center">{pdfError}</p>
                    )}
                  </div>
                )}

                {/* Text Content Preview */}
                {(previewData.fileFormat === 'txt' && textContent) && (
                  <div className="w-full max-w-md">
                    <div className="bg-white rounded-lg shadow-md border border-gray-300 overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                        <h4 className="text-sm font-semibold text-gray-700">Text Preview</h4>
                      </div>
                      <div className="p-4 max-h-64 overflow-y-auto">
                        {isTextLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                            {textContent.substring(0, 500)}
                            {textContent.length > 500 && '...'}
                          </div>
                        )}
                      </div>
                      {textContent && textContent.length > 500 && (
                        <div className="bg-gray-50 px-4 py-2 border-t border-gray-300">
                          <button
                            onClick={openTextViewer}
                            className="w-full text-xs bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition-colors"
                          >
                            View Full Content ({textContent.length.toLocaleString()} characters)
                          </button>
                        </div>
                      )}
                      {textError && (
                        <p className="px-4 py-2 text-xs text-red-600 text-center bg-red-50">{textError}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Book Info */}
                <div className="bg-white rounded-lg p-4 shadow-md w-full max-w-xs">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Format:</span>
                      <span className={`font-medium text-${fileInfo.color}-600`}>{fileInfo.name}</span>
                    </div>
                    {previewData.bookFile && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">File Size:</span>
                          <span className="font-medium">
                            {(previewData.bookFile.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">File Name:</span>
                          <span className="font-medium truncate max-w-[120px]">
                            {previewData.bookFile.name}
                          </span>
                        </div>
                      </>
                    )}
                    {previewData.published_year && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Published:</span>
                        <span className="font-medium">{previewData.published_year}</span>
                      </div>
                    )}
                    {previewData.isbn && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">ISBN:</span>
                        <span className="font-medium">{previewData.isbn}</span>
                      </div>
                    )}
                  </div>

                  {/* Download Button */}
                  {previewData.bookFile && (
                    <button
                      onClick={handleDownloadPreview}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                    >
                      <Download size={16} />
                      Download Sample
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Edit Section */}
          <div className="w-full lg:w-1/2 p-4 sm:p-6 overflow-y-auto flex flex-col min-h-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">Book Details</h3>
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm sm:text-base"
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
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                  >
                    <Save size={16} className="sm:hidden" />
                    <Save size={18} className="hidden sm:block" />
                    <span className="hidden sm:inline">Save</span>
                    <span className="sm:hidden">Save</span>
                  </button>
                </div>
              )}
            </div>

            {/* Cover Image Upload */}
            <div className="mb-4 sm:mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="w-24 h-20 sm:w-32 sm:h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  {coverPreview ? (
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {React.createElement(fileInfo.icon, { size: 20, className: "sm:hidden" })}
                      {React.createElement(fileInfo.icon, { size: 24, className: "hidden sm:block" })}
                    </div>
                  )}
                </div>
                {isEditing && (
                  <div className="w-full sm:w-auto">
                    <input
                      ref={coverFileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCoverChange}
                      className="hidden"
                    />
                    <button
                      onClick={() => coverFileRef.current?.click()}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors w-full sm:w-auto"
                    >
                      Change Cover
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter book title"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="Enter book description"
                  />
                ) : (
                  <p className="text-gray-800 whitespace-pre-wrap">
                    {editedData.description || 'No description provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedData.author}
                    onChange={(e) => handleInputChange('author', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Author name"
                  />
                ) : (
                  <p className="text-gray-800">{editedData.author || 'No author'}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  {isEditing ? (
                    <select
                      value={editedData.language}
                      onChange={(e) => handleInputChange('language', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                  {isEditing ? (
                    <select
                      value={editedData.genre}
                      onChange={(e) => handleInputChange('genre', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Select Genre</option>
                      {genres.map(genre => (
                        <option key={genre} value={genre}>{genre}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-800 text-sm">{editedData.genre || 'No genre'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Published Year</label>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editedData.published_year || ''}
                      onChange={(e) => handleInputChange('published_year', parseInt(e.target.value) || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="e.g., 2024"
                      min="1900"
                      max={new Date().getFullYear()}
                    />
                  ) : (
                    <p className="text-gray-800 text-sm">{editedData.published_year || 'Not specified'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.isbn || ''}
                      onChange={(e) => handleInputChange('isbn', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="ISBN number"
                    />
                  ) : (
                    <p className="text-gray-800 text-sm">{editedData.isbn || 'No ISBN'}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Book File</label>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept={fileFormats.map(f => f.accept).join(',')}
                      onChange={handleBookFileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {editedData.bookFile && (
                      <p className="text-xs text-gray-600">
                        Current: {editedData.bookFile.name} ({(editedData.bookFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-800">
                    {previewData.bookFile ? (
                      <div>
                        <p className="font-medium">{previewData.bookFile.name}</p>
                        <p className="text-xs text-gray-600">
                          {(previewData.bookFile.size / (1024 * 1024)).toFixed(2)} MB • {fileInfo.name}
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500">No file uploaded</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Format</label>
                {isEditing ? (
                  <select
                    value={editedData.fileFormat}
                    onChange={(e) => handleInputChange('fileFormat', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    {fileFormats.map(format => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-gray-800 text-sm">{fileInfo.name}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={onUpload}
                className="flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold text-sm sm:text-base"
              >
                <Upload size={18} className="sm:hidden" />
                <Upload size={20} className="hidden sm:block" />
                <span className="hidden sm:inline">Upload Book</span>
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

      {/* Text Viewer Modal */}
      {showTextViewer && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden">
            {/* Text Viewer Header */}
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <FileText size={24} />
                <h3 className="text-lg font-semibold">Text Book Viewer</h3>
                <span className="text-sm text-gray-300">
                  {textContent.length.toLocaleString()} characters
                </span>
              </div>
              <button
                onClick={closeTextViewer}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Text Viewer Controls */}
            <div className="bg-gray-100 p-3 flex items-center justify-between border-b">
              <div className="flex items-center gap-2">
                <Book size={20} className="text-gray-600" />
                <span className="text-sm text-gray-700 font-medium">{previewData.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([textContent], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${previewData.title || 'book'}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm flex items-center gap-2"
                >
                  <Download size={16} />
                  Download
                </button>
              </div>
            </div>

            {/* Text Content */}
            <div className="flex-1 overflow-auto bg-white p-6">
              <div className="max-w-4xl mx-auto">
                <div className="prose prose-sm max-w-none">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <pre className="whitespace-pre-wrap font-serif text-base leading-relaxed text-gray-800">
                      {textContent}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-100 p-4 border-t flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Lines: {textContent.split('\n').length} | Words: {textContent.split(/\s+/).length}
              </div>
              <button
                onClick={closeTextViewer}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {showPdfViewer && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden">
            {/* PDF Viewer Header */}
            <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold">PDF Page Viewer</h3>
                <span className="text-sm text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
              <button
                onClick={closePdfViewer}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* PDF Viewer Controls */}
            <div className="bg-gray-100 p-3 flex items-center justify-between border-b">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevPage}
                  disabled={currentPage <= 1}
                  className="p-2 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="number"
                  value={currentPage}
                  onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 border rounded text-center text-sm"
                  min={1}
                  max={totalPages}
                />
                <button
                  onClick={nextPage}
                  disabled={currentPage >= totalPages}
                  className="p-2 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
                <span className="text-sm text-gray-600">/ {totalPages}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={zoomOut}
                  disabled={zoomLevel <= 0.5}
                  className="p-2 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-sm text-gray-600 min-w-[50px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  disabled={zoomLevel >= 3}
                  className="p-2 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  onClick={resetZoom}
                  className="px-3 py-1 bg-white border rounded hover:bg-gray-50 text-sm transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={rotatePdf}
                  className="p-2 bg-white border rounded hover:bg-gray-50 transition-colors"
                >
                  <RotateCw size={16} />
                </button>
              </div>
            </div>

            {/* PDF Content */}
            <div className="flex-1 overflow-auto bg-gray-200 p-4">
              <div className="flex justify-center">
                {pdfPages.length > 0 && pdfPages[currentPage - 1] ? (
                  <div
                    className="bg-white shadow-lg"
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transformOrigin: 'center',
                      transition: 'transform 0.3s ease'
                    }}
                  >
                    <img
                      src={pdfPages[currentPage - 1]}
                      alt={`Page ${currentPage}`}
                      className="max-w-none"
                      style={{
                        maxWidth: 'none',
                        height: 'auto'
                      }}
                    />
                  </div>
                ) : (
                  <div className="bg-white rounded-lg p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading page {currentPage}...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Page Thumbnails */}
            {pdfPages.length > 1 && (
              <div className="bg-gray-100 p-3 border-t">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {pdfPages.map((page, index) => (
                    <button
                      key={index}
                      onClick={() => goToPage(index + 1)}
                      className={`flex-shrink-0 border-2 rounded overflow-hidden transition-all ${
                        currentPage === index + 1
                          ? 'border-blue-500 shadow-lg'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <img
                        src={page}
                        alt={`Page ${index + 1}`}
                        className="w-16 h-20 object-cover"
                      />
                      <div className="bg-white text-xs py-1 text-center">
                        {index + 1}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookPreview;