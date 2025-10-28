import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Maximize2, Minimize2, FileText, RotateCw } from 'lucide-react';

interface UniversalBookViewerProps {
  bookUrl: string;
  fileFormat?: string;
  mimeType?: string;
  title: string;
  onClose: () => void;
}

const UniversalBookViewer: React.FC<UniversalBookViewerProps> = ({
  bookUrl,
  fileFormat = 'pdf',
  mimeType = 'application/pdf',
  title,
  onClose
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [canRefresh, setCanRefresh] = useState<boolean>(false);

  const contentRef = useRef<HTMLIFrameElement>(null);

  const constructBookUrl = (url: string) => {
    if (url.startsWith('http')) {
      return url;
    }
    // Ensure URL starts with /public/ for proper static file serving
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    if (!normalizedUrl.startsWith('/public/')) {
      const finalUrl = `http://localhost:3001/public${normalizedUrl}`;
      // Encode the URL to handle non-English characters
      return encodeURI(finalUrl);
    }
    const finalUrl = `http://localhost:3001${normalizedUrl}`;
    return encodeURI(finalUrl);
  };

  const getFormatInfo = (format: string, mime: string) => {
    const formatMap: { [key: string]: { name: string; icon: string } } = {
      'pdf': { name: 'PDF Document', icon: '📄' },
      'epub': { name: 'EPUB eBook', icon: '📚' },
      'txt': { name: 'Text File', icon: '📝' },
      'docx': { name: 'Word Document', icon: '📄' },
      'mobi': { name: 'Kindle eBook', icon: '📱' },
      'azw': { name: 'Kindle eBook', icon: '📱' },
      'azw3': { name: 'Kindle eBook', icon: '📱' },
      'djvu': { name: 'DjVu Document', icon: '📄' },
      'fb2': { name: 'FictionBook', icon: '📚' },
      'rtf': { name: 'Rich Text', icon: '📄' },
      'html': { name: 'HTML Document', icon: '🌐' },
      'odt': { name: 'OpenDocument', icon: '📄' }
    };

    return formatMap[format.toLowerCase()] || formatMap['pdf'];
  };

  const formatInfo = getFormatInfo(fileFormat, mimeType);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const refreshContent = () => {
    if (contentRef.current) {
      contentRef.current.src = contentRef.current.src;
    }
  };

  useEffect(() => {
    const fullBookUrl = constructBookUrl(bookUrl);

    // Test file accessibility
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      setCanRefresh(true);
    }, 3000);

    fetch(fullBookUrl, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          setLoading(false);
          setError(null);
          setCanRefresh(true);
        } else {
          setLoading(false);
          setError('Failed to load book. The file may not be accessible.');
        }
      })
      .catch(() => {
        setLoading(false);
        setError('Failed to load book. Please check your connection.');
      })
      .finally(() => {
        clearTimeout(loadingTimeout);
      });

    return () => clearTimeout(loadingTimeout);
  }, [bookUrl, fileFormat]);

  const renderContent = () => {
    const fullBookUrl = constructBookUrl(bookUrl);

    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
            Loading {formatInfo.name}...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-red-600">
          <AlertCircle size={48} className="mb-4" />
          <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Times New Roman' }}>
            Loading Error
          </h3>
          <p className="text-center max-w-md mb-4" style={{ fontFamily: 'Times New Roman' }}>
            {error}
          </p>
          {canRefresh && (
            <div className="flex justify-center">
              <button
                onClick={refreshContent}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center space-x-2"
              >
                <RotateCw size={16} />
                <span>Try Again</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    // Universal Iframe Viewer for all formats
    return (
      <div className="h-full w-full bg-white rounded-lg shadow-lg overflow-hidden relative">
        <iframe
          ref={contentRef}
          src={fullBookUrl}
          className="w-full h-full border-0"
          title={`${formatInfo.name} Viewer - ${title}`}
          allow="fullscreen"
          style={{ minHeight: '600px' }}
          onLoad={() => {
            setLoading(false);
            setError(null);
            setCanRefresh(true);
          }}
          onError={() => {
            setLoading(false);
            setError(`Failed to load ${formatInfo.name}. The file may be corrupted or not supported.`);
          }}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50">
      {/* Header */}
      <div className="bg-white shadow-lg p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-2xl">{formatInfo.icon}</span>
          <div>
            <h2 className="text-xl font-bold text-gray-800 truncate max-w-md" style={{ fontFamily: 'Times New Roman' }}>
              {title}
            </h2>
            <p className="text-sm text-gray-600">
              {formatInfo.name} • Universal Book Viewer
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          {/* Refresh Button */}
          {canRefresh && (
            <button
              onClick={refreshContent}
              className="p-2 rounded-lg hover:bg-gray-100 text-orange-600"
              title="Refresh Content"
            >
              <RotateCw size={20} />
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-gray-100"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>

          {/* Close Button */}
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
        {renderContent()}
      </div>

      {/* Footer Info */}
      <div className="bg-white border-t p-3">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span style={{ fontFamily: 'Times New Roman' }}>
            Universal Book Viewer - {formatInfo.name}
          </span>
          <div className="flex items-center space-x-4">
            <span>Format: {fileFormat.toUpperCase()}</span>
            <span className="text-xs">
              💡 All books use the same unified viewer • Use browser's built-in controls for navigation and zoom
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversalBookViewer;