import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { getMediaUrl, getImageUrl, getPdfUrl, getVideoUrl } from '../services/api';

interface MediaDiagnosticsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TestResult {
  url: string;
  status: 'loading' | 'success' | 'error';
  error?: string;
  responseTime?: number;
}

const MediaDiagnostics: React.FC<MediaDiagnosticsProps> = ({ isOpen, onClose }) => {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [isRunning, setIsRunning] = useState(false);

  const testUrls = [
    { name: 'Backend API Health', url: 'http://localhost:3001/health' },
    { name: 'Sample Audio File', url: getMediaUrl('/public/audio/01-07-2025 Morn - Paul Uphaz.mp3') },
    { name: 'Sample PDF File', url: getPdfUrl('/public/pdfs/english-grammar.pdf') },
    { name: 'Sample Video File', url: getVideoUrl('/public/videos/VID-20240527-082401-1759829509598-473701975.mp4') },
    { name: 'Sample Image File', url: getImageUrl('/public/images/001-1759453307801-477782835.png') },
  ];

  const testUrl = async (name: string, url: string): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'cors'
      });
      
      const responseTime = performance.now() - startTime;
      
      if (response.ok) {
        return {
          url,
          status: 'success',
          responseTime: Math.round(responseTime)
        };
      } else {
        return {
          url,
          status: 'error',
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseTime: Math.round(responseTime)
        };
      }
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        url,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Math.round(responseTime)
      };
    }
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setTestResults({});

    for (const test of testUrls) {
      setTestResults(prev => ({
        ...prev,
        [test.name]: { url: test.url, status: 'loading' }
      }));

      const result = await testUrl(test.name, test.url);
      
      setTestResults(prev => ({
        ...prev,
        [test.name]: result
      }));

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsRunning(false);
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnostics();
    }
  }, [isOpen]);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'loading':
        return <RefreshCw size={16} className="text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'error':
        return <XCircle size={16} className="text-red-500" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'loading':
        return 'border-blue-200 bg-blue-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} />
            <h2 className="text-xl font-bold">Media Diagnostics</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Connection Tests</h3>
              <button
                onClick={runDiagnostics}
                disabled={isRunning}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={16} className={isRunning ? 'animate-spin' : ''} />
                {isRunning ? 'Running...' : 'Run Tests'}
              </button>
            </div>

            <div className="space-y-3">
              {testUrls.map((test) => {
                const result = testResults[test.name];
                return (
                  <div
                    key={test.name}
                    className={`border rounded-lg p-4 ${result ? getStatusColor(result.status) : 'border-gray-200 bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {result ? getStatusIcon(result.status) : <div className="w-4 h-4" />}
                        <span className="font-medium text-gray-800">{test.name}</span>
                      </div>
                      {result?.responseTime && (
                        <span className="text-sm text-gray-600">{result.responseTime}ms</span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>URL:</strong> {test.url}
                    </div>
                    
                    {result?.error && (
                      <div className="text-sm text-red-600 bg-red-100 p-2 rounded">
                        <strong>Error:</strong> {result.error}
                      </div>
                    )}
                    
                    {result?.status === 'success' && (
                      <div className="text-sm text-green-600">
                        ✓ File accessible
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Troubleshooting Tips */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">Troubleshooting Tips:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Make sure the backend server is running on port 3001</li>
              <li>• Check if the media files exist in the backend/public directory</li>
              <li>• Verify CORS settings allow requests from the frontend</li>
              <li>• Ensure file permissions allow reading the media files</li>
              <li>• Check browser console for additional error messages</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaDiagnostics;