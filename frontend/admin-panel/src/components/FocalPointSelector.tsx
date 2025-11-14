import React, { useState, useRef, useEffect } from 'react';
import { Crosshair, X, RotateCcw } from 'lucide-react';

interface FocalPointSelectorProps {
  imageUrl: string;
  initialFocalPoint?: { x: number; y: number };
  onFocalPointChange: (focalPoint: { x: number; y: number } | null) => void;
  onClose?: () => void;
  mediaType: 'book' | 'audio' | 'video';
}

/**
 * Focal Point Selector Component
 * Allows admin to select a focal point on the image for smart cropping
 * The focal point determines where the crop will be centered
 */
const FocalPointSelector: React.FC<FocalPointSelectorProps> = ({
  imageUrl,
  initialFocalPoint,
  onFocalPointChange,
  onClose,
  mediaType
}) => {
  const [focalPoint, setFocalPoint] = useState<{ x: number; y: number } | null>(
    initialFocalPoint || { x: 0.5, y: 0.5 } // Default to center
  );
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Get aspect ratio based on media type (keeping for future use)
  // Temporarily log to avoid unused variable error
  React.useEffect(() => {
    console.log('Media type for aspect ratio:', mediaType);
  }, [mediaType]);

  // Calculate focal point from mouse/touch event
  const updateFocalPoint = (clientX: number, clientY: number) => {
    if (!imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    setFocalPoint({ x, y });
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateFocalPoint(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      updateFocalPoint(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    const touch = e.touches[0];
    updateFocalPoint(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0];
      updateFocalPoint(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Apply focal point
  const handleApply = () => {
    onFocalPointChange(focalPoint);
    if (onClose) onClose();
  };

  // Reset to center
  const handleReset = () => {
    setFocalPoint({ x: 0.5, y: 0.5 });
  };

  // Clear focal point (use default center cropping)
  const handleClear = () => {
    setFocalPoint(null);
    onFocalPointChange(null);
    if (onClose) onClose();
  };

  useEffect(() => {
    // Add global mouse up listener when dragging
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('touchend', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
        window.removeEventListener('touchend', handleGlobalMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Crosshair size={24} className="text-orange-500" />
              Set Focal Point
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Click or drag to set where the crop should be centered
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Image with focal point selector */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">
                Select Focal Point
              </h3>
              <div
                ref={imageContainerRef}
                className="relative w-full max-w-md mx-auto cursor-crosshair rounded-lg overflow-hidden shadow-lg"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  src={imageUrl}
                  alt="Select focal point"
                  className="w-full h-auto select-none"
                  draggable={false}
                  onLoad={() => setImageLoaded(true)}
                />

                {/* Focal point indicator */}
                {focalPoint && imageLoaded && (
                  <>
                    {/* Crosshair lines */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-500 opacity-50 pointer-events-none"
                      style={{ left: `${focalPoint.x * 100}%` }}
                    />
                    <div
                      className="absolute left-0 right-0 h-px bg-red-500 opacity-50 pointer-events-none"
                      style={{ top: `${focalPoint.y * 100}%` }}
                    />

                    {/* Center point */}
                    <div
                      className="absolute w-6 h-6 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{
                        left: `${focalPoint.x * 100}%`,
                        top: `${focalPoint.y * 100}%`
                      }}
                    >
                      <div className="w-full h-full bg-red-500 border-4 border-white rounded-full shadow-lg animate-pulse" />
                    </div>

                    {/* Crop area preview overlay */}
                    <div
                      className="absolute border-2 border-orange-500 border-dashed pointer-events-none"
                      style={{
                        left: `${Math.max(0, focalPoint.x * 100 - 25)}%`,
                        top: `${Math.max(0, focalPoint.y * 100 - 25)}%`,
                        width: '50%',
                        height: '50%',
                        opacity: 0.3
                      }}
                    />
                  </>
                )}

                {/* Instructions overlay */}
                {!isDragging && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-opacity flex items-center justify-center pointer-events-none">
                    <div className="bg-white bg-opacity-90 px-4 py-2 rounded-lg shadow-lg">
                      <p className="text-sm font-medium text-gray-800">
                        Click or drag to set focal point
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preview and info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">
                Crop Preview
              </h3>

              {/* Preview with focal point applied */}
              {focalPoint && (
                <div className="mb-4">
                  <div className="bg-white p-3 rounded-lg shadow-md">
                    <div
                      className="w-full overflow-hidden rounded-lg relative mx-auto"
                      style={{
                        aspectRatio: mediaType === 'book' ? '3/4' : mediaType === 'audio' ? '1/1' : '16/9',
                        maxWidth: '300px'
                      }}
                    >
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="w-full h-full object-contain"
                        style={{
                          objectPosition: `${focalPoint.x * 100}% ${focalPoint.y * 100}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-2 text-center">
                      Cropped preview ({mediaType === 'book' ? '3:4' : mediaType === 'audio' ? '1:1' : '16:9'})
                    </p>
                  </div>
                </div>
              )}

              {/* Focal point coordinates */}
              {focalPoint && (
                <div className="bg-white p-3 rounded-lg mb-4">
                  <p className="text-sm text-gray-600">Focal Point Coordinates</p>
                  <p className="text-lg font-semibold text-gray-800">
                    X: {(focalPoint.x * 100).toFixed(0)}%, Y: {(focalPoint.y * 100).toFixed(0)}%
                  </p>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">How to use:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Click on the image where you want the crop to be centered</li>
                  <li>Drag to adjust the focal point</li>
                  <li>The red crosshair shows where the crop will focus</li>
                  <li>Useful for keeping faces or important subjects in view</li>
                  <li>If you don't set a focal point, the crop will be centered</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <RotateCcw size={18} />
              Reset to Center
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Use Default (Center)
              </button>
              <button
                onClick={handleApply}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
              >
                Apply Focal Point
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocalPointSelector;
