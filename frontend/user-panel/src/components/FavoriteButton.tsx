import React, { useState, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';

interface FavoriteButtonProps {
  mediaType: 'book' | 'audio' | 'video';
  mediaId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  ariaLabel?: string;
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  mediaType,
  mediaId,
  className = '',
  size = 'md',
  showLabel = false,
  ariaLabel
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { isFavorited, toggleFavorite } = useFavorites();

  // Prevent rapid clicks with local state
  const handleClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isProcessing) {
      console.log('Favorite button click ignored - already processing');
      return;
    }

    setIsProcessing(true);

    try {
      await toggleFavorite(mediaType, mediaId);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [mediaType, mediaId, isProcessing, toggleFavorite]);

  const isCurrentlyFavorited = isFavorited(mediaType, mediaId);
  const buttonSize = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 20 : 14;

  return (
    <button
      onClick={handleClick}
      className={`
        ${buttonSize}
        ${className}
        bg-white/90 hover:bg-white rounded-full p-1.5 shadow-md
        transition-all duration-200 hover:scale-110
        ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
      `}
      aria-label={ariaLabel || (isCurrentlyFavorited ? "Remove from favorites" : "Add to favorites")}
      disabled={isProcessing}
    >
      <Heart
        size={iconSize}
        className={`
          transition-colors duration-200
          ${isCurrentlyFavorited
            ? 'text-red-500 fill-red-500'
            : 'text-gray-400 hover:text-red-500'
          }
          ${isProcessing ? 'animate-pulse' : ''}
        `}
      />
      {showLabel && (
        <span className="ml-2 text-xs whitespace-nowrap">
          {isCurrentlyFavorited ? 'Remove' : 'Add to'}
        </span>
      )}
    </button>
  );
};

export default FavoriteButton;