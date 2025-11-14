import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface ImagePreviewProps {
  imageUrl: string;
  mediaType: 'book' | 'audio' | 'video';
  title?: string;
  onClose?: () => void;
  focalPoint?: { x: number; y: number };
}

/**
 * WYSIWYG Image Preview Component
 * Shows exactly how the uploaded image will appear in the user panel
 * with the correct aspect ratio and object-fit behavior to show entire image
 */
const ImagePreview: React.FC<ImagePreviewProps> = ({
  imageUrl,
  mediaType,
  title = 'Preview',
  onClose,
  focalPoint
}) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Get aspect ratio based on media type
  const getAspectRatio = () => {
    switch (mediaType) {
      case 'book':
        return '3/4'; // Portrait
      case 'audio':
        return '1/1'; // Square
      case 'video':
        return '16/9'; // Landscape
      default:
        return '3/4';
    }
  };

  // Get display dimensions based on media type (same as user panel)
  const getDisplayDimensions = () => {
    switch (mediaType) {
      case 'book':
        return { width: 240, height: 320 }; // 3:4 ratio
      case 'audio':
        return { width: 240, height: 240 }; // 1:1 ratio
      case 'video':
        return { width: 320, height: 180 }; // 16:9 ratio
      default:
        return { width: 240, height: 320 };
    }
  };

  // Load image to get original dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const aspectRatio = getAspectRatio();
  const displayDims = getDisplayDimensions();
  const originalAspectRatio = imageDimensions.height > 0
    ? (imageDimensions.width / imageDimensions.height).toFixed(2)
    : '0';

  // Calculate crop preview
  const getCropInfo = () => {
    if (!imageDimensions.width || !imageDimensions.height) return null;

    const targetRatio = mediaType === 'book' ? 3 / 4 : mediaType === 'audio' ? 1 : 16 / 9;
    const imageRatio = imageDimensions.width / imageDimensions.height;

    let croppedWidth = imageDimensions.width;
    let croppedHeight = imageDimensions.height;

    if (imageRatio > targetRatio) {
      // Image is wider than target - crop width
      croppedWidth = Math.floor(imageDimensions.height * targetRatio);
      const cropAmount = imageDimensions.width - croppedWidth;
      return {
        side: 'width',
        cropAmount,
        cropPercent: ((cropAmount / imageDimensions.width) * 100).toFixed(1)
      };
    } else if (imageRatio < targetRatio) {
      // Image is taller than target - crop height
      croppedHeight = Math.floor(imageDimensions.width / targetRatio);
      const cropAmount = imageDimensions.height - croppedHeight;
      return {
        side: 'height',
        cropAmount,
        cropPercent: ((cropAmount / imageDimensions.height) * 100).toFixed(1)
      };
    }

    return { side: 'none', cropAmount: 0, cropPercent: '0' };
  };

  const cropInfo = getCropInfo();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Image Preview - {mediaType === 'book' ? 'Book (3:4)' : mediaType === 'audio' ? 'Audio (1:1)' : 'Video (16:9)'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              WYSIWYG: This is exactly how the image will appear in the user panel
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close preview"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Toggle View Button */}
          <div className="flex justify-center mb-4">
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              {showOriginal ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
              {showOriginal ? 'Show User Panel View' : 'Show Original Image'}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* User Panel Preview */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">
                User Panel Preview
              </h3>
              <div className="flex flex-col items-center">
                {/* Simulated media card (same as user panel) */}
                <div
                  className="bg-white rounded-xl shadow-lg p-3"
                  style={{ width: `${displayDims.width}px` }}
                >
                  {/* Image with fixed aspect ratio container and object-fit: contain */}
                  <div
                    className="w-full overflow-hidden rounded-lg mb-3 relative"
                    style={{ aspectRatio }}
                  >
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full h-full object-contain"
                      style={{
                        objectPosition: focalPoint
                          ? `${focalPoint.x * 100}% ${focalPoint.y * 100}%`
                          : 'center'
                      }}
                    />
                    {focalPoint && (
                      <div
                        className="absolute w-3 h-3 bg-red-500 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: `${focalPoint.x * 100}%`,
                          top: `${focalPoint.y * 100}%`
                        }}
                        title="Focal Point"
                      />
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-800 text-sm mb-1 line-clamp-2">
                    {title}
                  </h3>
                  <p className="text-xs text-gray-600">Sample Preview</p>
                </div>

                <p className="text-xs text-gray-600 mt-2 text-center max-w-xs">
                  This preview shows how your image will appear on the user panel shelf.
                  The entire image is displayed within {mediaType === 'book' ? '3:4 portrait' : mediaType === 'audio' ? '1:1 square' : '16:9 landscape'} aspect ratio with object-fit: contain.
                </p>
              </div>
            </div>

            {/* Original Image & Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">
                {showOriginal ? 'Original Image' : 'Image Information'}
              </h3>

              {showOriginal ? (
                <div className="flex justify-center">
                  <img
                    src={imageUrl}
                    alt="Original"
                    className="max-w-full h-auto rounded-lg shadow-md"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {imageLoaded && (
                    <>
                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Original Dimensions</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {imageDimensions.width} × {imageDimensions.height}px
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Original Aspect Ratio</p>
                        <p className="text-lg font-semibold text-gray-800">{originalAspectRatio}:1</p>
                      </div>

                      <div className="bg-white p-3 rounded-lg">
                        <p className="text-sm text-gray-600">Target Aspect Ratio</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {mediaType === 'book' ? '3:4 (Portrait)' : mediaType === 'audio' ? '1:1 (Square)' : '16:9 (Landscape)'}
                        </p>
                      </div>

                      {cropInfo && cropInfo.side !== 'none' && (
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                          <p className="text-sm text-amber-800 font-semibold mb-1">Cropping Applied</p>
                          <p className="text-sm text-amber-700">
                            {cropInfo.cropPercent}% of {cropInfo.side} will be cropped
                          </p>
                          <p className="text-xs text-amber-600 mt-1">
                            ({cropInfo.cropAmount}px {cropInfo.side === 'width' ? 'from left/right' : 'from top/bottom'})
                          </p>
                        </div>
                      )}

                      {cropInfo && cropInfo.side === 'none' && (
                        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                          <p className="text-sm text-green-800 font-semibold">Perfect Fit!</p>
                          <p className="text-xs text-green-700 mt-1">
                            Image already matches the target aspect ratio
                          </p>
                        </div>
                      )}

                      {focalPoint && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                          <p className="text-sm text-blue-800 font-semibold mb-1">Focal Point Set</p>
                          <p className="text-xs text-blue-700">
                            X: {(focalPoint.x * 100).toFixed(0)}%, Y: {(focalPoint.y * 100).toFixed(0)}%
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            The crop will be centered on this point
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">How cropping works:</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Images are automatically cropped to match the target aspect ratio</li>
              <li>By default, cropping is centered on the image</li>
              <li>You can set a focal point to control where the crop focuses (e.g., on a face)</li>
              <li>The entire image is visible within the display area with <code className="bg-blue-100 px-1 rounded">object-fit: contain</code></li>
              <li>No distortion - images are never stretched or squashed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImagePreview;
