import React from 'react';
import { motion } from 'framer-motion';
import { Book, Play } from 'lucide-react';
import { MediaItem } from '../services/api';

interface BillboardProps {
  latestContent: MediaItem[];
  billboardIndex: number;
  setBillboardIndex: (index: number) => void;
  onMediaClick: (item: MediaItem, type: 'pdf' | 'audio' | 'video') => void;
}

const Billboard: React.FC<BillboardProps> = ({ 
  latestContent, 
  billboardIndex, 
  setBillboardIndex, 
  onMediaClick 
}) => {
  if (!latestContent.length) return null;
  
  const getMediaType = (item: MediaItem) => {
    if (item.pdf_url) return 'pdf';
    if (item.audio_file_path) return 'audio';
    if (item.youtube_id) return 'video';
    return 'unknown';
  };

  const getButtonText = (item: MediaItem) => {
    if (item.pdf_url) return 'Read';
    if (item.audio_file_path) return 'Play';
    if (item.youtube_id) return 'Play';
    return 'View';
  };

  const getButtonIcon = (item: MediaItem) => {
    if (item.pdf_url) return <Book size={16} />;
    if (item.audio_file_path) return <Play size={16} />;
    if (item.youtube_id) return <Play size={16} />;
    return <Play size={16} />;
  };

  const getBestThumbnailUrl = (item: MediaItem) => {
    // For videos: prioritize local uploaded thumbnails over YouTube thumbnails
    if (item.youtube_id) {
      // Check if thumbnail_url is a local upload (starts with /public/)
      if (item.thumbnail_url && item.thumbnail_url.startsWith('/public/')) {
        return item.thumbnail_url;
      }
      // Use YouTube thumbnail as fallback
      if (item.thumbnail_url && !item.thumbnail_url.startsWith('/public/')) {
        return item.thumbnail_url;
      }
      // Generate YouTube thumbnail if no thumbnail_url exists
      return `https://img.youtube.com/vi/${item.youtube_id}/maxresdefault.jpg`;
    }

    // For books and other media: use cover_image_url first, then thumbnail_url
    if (item.cover_image_url) {
      return item.cover_image_url;
    }

    if (item.thumbnail_url) {
      return item.thumbnail_url;
    }

    // Final fallback
    return 'https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg?auto=compress&cs=tinysrgb&w=1200&h=800&fit=crop';
  };

  return (
    <div className="relative w-full h-[60vh] sm:h-[70vh] overflow-hidden rounded-xl mb-6">
      {latestContent.map((item, i) => (
        <motion.div
          key={item.id}
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{
            backgroundImage: `url(${getBestThumbnailUrl(item)})`
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: i === billboardIndex ? 1 : 0 }}
          transition={{ duration: 1 }}
        >
          {i === billboardIndex && (
            <div className="absolute bottom-8 left-8 max-w-xl text-white z-10">
              <motion.h1
                className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg"
                style={{ fontFamily: 'Times New Roman' }}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
              >
                {item.title}
              </motion.h1>
              <motion.p
                className="text-sm sm:text-lg md:text-xl mb-4 drop-shadow-md"
                style={{ fontFamily: 'Times New Roman' }}
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 1, delay: 0.2 }}
              >
                {item.description || `${item.author || item.narrator || 'Latest'} • ${getMediaType(item)}`}
              </motion.p>
              <div className="flex gap-3 relative z-20">
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onMediaClick(item, getMediaType(item) as 'pdf' | 'audio' | 'video');
                  }}
                  className="bg-white text-black font-semibold px-4 sm:px-6 py-2 rounded-lg shadow-md hover:bg-gray-100 transition-colors duration-200 flex items-center gap-2 text-sm sm:text-base cursor-pointer relative z-30"
                  style={{ fontFamily: 'Times New Roman' }}
                >
                  {getButtonIcon(item)} {getButtonText(item)}
                </button>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="bg-gray-700/70 text-white font-semibold px-4 sm:px-6 py-2 rounded-lg shadow-md hover:bg-gray-600/70 transition-colors duration-200 text-sm sm:text-base cursor-pointer relative z-30"
                  style={{ fontFamily: 'Times New Roman' }}
                >
                  ℹ More Info
                </button>
              </div>
            </div>
          )}
        </motion.div>
      ))}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
      
      {latestContent.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-2">
          {latestContent.map((_, i) => (
            <button
              key={i}
              onClick={() => setBillboardIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                i === billboardIndex ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Billboard;