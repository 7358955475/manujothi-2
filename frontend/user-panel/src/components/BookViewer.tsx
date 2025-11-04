import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Maximize2, Minimize2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { getPdfUrl } from '../services/api';

interface BookViewerProps {
  pdfUrl: string;
  title: string;
  onClose: () => void;
}

const BookViewer: React.FC<BookViewerProps> = ({ pdfUrl, title, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<string>('FitH');

  const constructPdfUrl = (url: string) => {
    return getPdfUrl(url);
  };

  
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const navigatePage = (direction: 'prev' | 'next') => {
    if (direction === 'next') {
      setCurrentPage(prev => prev + 1);
    } else if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const changeZoom = (zoomType: 'in' | 'out' | 'fit') => {
    switch (zoomType) {
      case 'in':
        setZoom('150');
        break;
      case 'out':
        setZoom('75');
        break;
      case 'fit':
        setZoom('FitH');
        break;
    }
  };

  // Use useEffect to handle loading timeout since object onLoad/onError are unreliable
  useEffect(() => {
    // Test if PDF is accessible
    const testPdfUrl = constructPdfUrl(pdfUrl);

    // Set a timeout to hide loading after reasonable time
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    // Test PDF accessibility
    fetch(testPdfUrl, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          setLoading(false);
          setError(null);
        } else {
          setLoading(false);
          setError(`Failed to load PDF (${response.status}). The file may not be accessible.`);
        }
      })
      .catch((err) => {
        setLoading(false);
        setError(`Failed to load PDF: ${err.message || 'Network error'}. Please check your connection.`);
        console.error('PDF loading error:', err);
      })
      .finally(() => {
        clearTimeout(loadingTimeout);
      });

    return () => clearTimeout(loadingTimeout);
  }, [pdfUrl]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50">
      {/* Header */}
      <div className="bg-white shadow-lg p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-bold text-gray-800 truncate max-w-md" style={{ fontFamily: 'Times New Roman' }}>
            {title}
          </h2>
          <span className="text-sm text-gray-600">
            Normal Book View Plugin
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Page Navigation */}
          <div className="flex items-center space-x-1 border-r pr-2">
            <button
              onClick={() => navigatePage('prev')}
              disabled={currentPage <= 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm text-gray-600 px-2">
              Page {currentPage}
            </span>
            <button
              onClick={() => navigatePage('next')}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Next Page"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 border-r pr-2">
            <button
              onClick={() => changeZoom('out')}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Zoom Out"
            >
              <ZoomOut size={20} />
            </button>
            <button
              onClick={() => changeZoom('fit')}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Fit to Width"
            >
              <span className="text-xs font-semibold">FIT</span>
            </button>
            <button
              onClick={() => changeZoom('in')}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Zoom In"
            >
              <ZoomIn size={20} />
            </button>
          </div>

          {/* Other Controls */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-gray-100"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>

          
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-red-600"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-gray-100 p-4">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mb-4"></div>
            <p className="text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
              Loading PDF document...
            </p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full text-red-600">
            <AlertCircle size={48} className="mb-4" />
            <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Times New Roman' }}>
              PDF Loading Error
            </h3>
            <p className="text-center max-w-md mb-4" style={{ fontFamily: 'Times New Roman' }}>
              {error}
            </p>
                      </div>
        )}

        {!loading && !error && (
          <div className="h-full w-full bg-white rounded-lg shadow-lg overflow-hidden">
            <iframe
              src={`${constructPdfUrl(pdfUrl)}#toolbar=1&navpanes=1&scrollbar=1&page=${currentPage}&view=${zoom}&zoom=${zoom === 'FitH' ? 'FitH' : zoom}`}
              className="w-full h-full border-0"
              title={`PDF Viewer - ${title}`}
              allow="fullscreen"
              style={{ minHeight: '600px' }}
              key={`${currentPage}-${zoom}`}
            />
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-white border-t p-3">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span style={{ fontFamily: 'Times New Roman' }}>
            Enhanced PDF Viewer - {title}
          </span>
          <div className="flex items-center space-x-4">
            <span>Page {currentPage}</span>
            <span>Zoom: {zoom === 'FitH' ? 'Fit Width' : zoom + '%'}</span>
            <span>Use controls above or browser's built-in PDF features</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookViewer;