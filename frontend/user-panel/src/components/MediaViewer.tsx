import React, { useRef, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { MediaItem } from '../services/api';
import OptimizedVideo from './OptimizedVideo';
import UniversalBookViewer from './UniversalBookViewer';
import VideoPlayer from './VideoPlayer';

interface MediaViewerProps {
  selectedMedia: MediaItem;
  mediaType: 'pdf' | 'audio' | 'video';
  onClose: () => void;
}

const MediaViewer: React.FC<MediaViewerProps> = ({ selectedMedia, mediaType, onClose }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Helper function to construct proper audio URL
  const constructAudioUrl = (audioPath: string) => {
    if (!audioPath) return '';

    // If it's already an HTTP URL, return as is
    if (audioPath.startsWith('http')) {
      return audioPath;
    }

    // If it's an absolute file system path, extract the filename and construct proper URL
    if (audioPath.startsWith('/home/')) {
      const fileName = audioPath.split('/').pop();
      return `http://localhost:3001/public/audio/${fileName}`;
    }

    // If it starts with /audio/, it's already a correct relative path
    if (audioPath.startsWith('/audio/')) {
      return `http://localhost:3001${audioPath}`;
    }

    // If it starts with / but not /audio/, assume it's in the public/audio directory
    if (audioPath.startsWith('/') && !audioPath.startsWith('/audio/')) {
      return `http://localhost:3001/public/audio${audioPath}`;
    }

    // Default case: assume it's a relative path to public/audio
    return `http://localhost:3001/public/audio/${audioPath}`;
  };

  // Helper function to construct proper image URL
  const constructImageUrl = (imagePath: string) => {
    if (!imagePath) return '';

    // If it's already an HTTP URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    // If it starts with /public/, it's already a correct relative path
    if (imagePath.startsWith('/public/')) {
      return `http://localhost:3001${imagePath}`;
    }

    // If it starts with / but not /public/, assume it's in the public directory
    if (imagePath.startsWith('/')) {
      return `http://localhost:3001/public${imagePath}`;
    }

    // Default case: assume it's a relative path to public
    return `http://localhost:3001/public/${imagePath}`;
  };

  // For book viewing, use the Universal Book Viewer component
  if (mediaType === 'pdf') {
    const bookUrl = selectedMedia.file_url || selectedMedia.pdf_url;
    const fileFormat = selectedMedia.file_format || 'pdf';
    const mimeType = selectedMedia.mime_type || 'application/pdf';

    if (!bookUrl) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-lg w-full h-full max-w-7xl max-h-[95vh] overflow-hidden relative shadow-2xl">
            <div className="flex justify-between items-center px-6 py-3 border-b bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800 truncate" style={{ fontFamily: 'Times New Roman' }}>
                {selectedMedia.title}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors duration-200 flex-shrink-0"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Times New Roman' }}>
                Book File Not Available
              </h3>
              <p className="text-center max-w-md" style={{ fontFamily: 'Times New Roman' }}>
                This book does not have a file associated with it. Please contact the administrator to upload the content.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <UniversalBookViewer
        bookUrl={bookUrl}
        fileFormat={fileFormat}
        mimeType={mimeType}
        title={selectedMedia.title}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-lg w-full h-full max-w-7xl max-h-[95vh] overflow-hidden relative shadow-2xl media-protected">
        <div className="flex justify-between items-center px-6 py-3 border-b bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800 truncate" style={{ fontFamily: 'Times New Roman' }}>
            {selectedMedia.title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors duration-200 flex-shrink-0"
          >
            <X size={24} className="text-gray-600" />
          </button>
        </div>

        <div className="h-[calc(100%-4rem)] overflow-hidden">
          
          {mediaType === 'audio' && selectedMedia.audio_file_path && (
            <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-orange-50 to-amber-50">
              <img
                src={constructImageUrl(selectedMedia.cover_image_url) || 'https://images.pexels.com/photos/3184419/pexels-photo-3184419.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop'}
                alt={selectedMedia.title}
                className="w-80 h-80 max-w-full max-h-full object-contain rounded-xl mb-8 shadow-2xl border-4 border-white"
                loading="lazy"
              />
              <div className="w-full max-w-2xl bg-white rounded-xl p-6 shadow-lg">
                <audio
                  ref={audioRef}
                  controls
                  className="w-full h-12"
                  src={constructAudioUrl(selectedMedia.audio_file_path || '')}
                  preload="metadata"
                >
                  Your browser does not support the audio element.
                </audio>
                <div className="text-center mt-6">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2" style={{ fontFamily: 'Times New Roman' }}>
                    {selectedMedia.title}
                  </h3>
                  {selectedMedia.narrator && (
                    <p className="text-lg text-gray-600" style={{ fontFamily: 'Times New Roman' }}>
                      Narrator: {selectedMedia.narrator}
                    </p>
                  )}
                  <p className="text-gray-500 mt-2" style={{ fontFamily: 'Times New Roman' }}>
                    {selectedMedia.description}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {mediaType === 'video' && (
            <VideoPlayer
              video={{
                id: selectedMedia.id,
                title: selectedMedia.title,
                description: selectedMedia.description,
                video_source: selectedMedia.video_source || 'youtube',
                video_file_path: selectedMedia.video_file_path,
                youtube_url: selectedMedia.youtube_url,
                youtube_id: selectedMedia.youtube_id,
                thumbnail_url: selectedMedia.thumbnail_url
              }}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaViewer;