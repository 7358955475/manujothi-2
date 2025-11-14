import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

/**
 * ImageProcessingService - Handles image resizing, cropping, and optimization
 *
 * Features:
 * - Automatic resizing to multiple sizes (thumbnail, small, medium, large)
 * - Aspect ratio cropping (3:4 for books/audio, 16:9 for videos)
 * - Image optimization and compression
 * - WebP format conversion for better performance
 * - Maintains original aspect ratio or crops to specified ratio
 */

export interface ImageSizes {
  thumbnail: string;  // 150x150 (1:1), 150x200 (3:4), or 267x150 (16:9)
  small: string;      // 300x300 (1:1), 300x400 (3:4), or 533x300 (16:9)
  medium: string;     // 600x600 (1:1), 600x800 (3:4), or 1067x600 (16:9)
  large: string;      // 900x900 (1:1), 900x1200 (3:4), or 1600x900 (16:9)
  original: string;   // Original uploaded file
}

export interface ProcessImageOptions {
  aspectRatio: '1:1' | '3:4' | '16:9';  // Audio: 1:1 (square), Books: 3:4, Videos: 16:9
  quality?: number;                      // JPEG/WebP quality (1-100), default: 85
  format?: 'jpeg' | 'webp';              // Output format, default: 'webp'
  outputDir: string;                     // Directory to save processed images
  focalPoint?: {                         // Optional focal point for smart cropping
    x: number;                           // X coordinate (0-1, where 0.5 is center)
    y: number;                           // Y coordinate (0-1, where 0.5 is center)
  };
  maxMediumSize?: number;                // Max file size for medium variant in KB (default: 200)
}

export class ImageProcessingService {
  /**
   * Process an uploaded image and generate multiple sizes
   * @param inputPath - Path to the original uploaded image
   * @param options - Processing options
   * @returns Object containing paths to all generated image sizes
   */
  async processUploadedImage(
    inputPath: string,
    options: ProcessImageOptions
  ): Promise<ImageSizes> {
    const {
      aspectRatio,
      quality = 85,
      format = 'webp',
      outputDir,
      focalPoint,
      maxMediumSize = 200
    } = options;

    // Ensure output directory exists
    await this.ensureDirectory(outputDir);

    // Get original filename without extension
    const originalName = path.basename(inputPath, path.extname(inputPath));
    const ext = format === 'webp' ? 'webp' : 'jpg';

    // Define sizes based on aspect ratio
    const sizes = this.getSizeDefinitions(aspectRatio);

    // Calculate focal point position for sharp
    const position = this.getFocalPosition(focalPoint);

    // Process each size
    const processedImages: ImageSizes = {
      thumbnail: '',
      small: '',
      medium: '',
      large: '',
      original: inputPath
    };

    // Generate thumbnail (150px or 267px width)
    processedImages.thumbnail = await this.resizeAndCrop(
      inputPath,
      path.join(outputDir, `${originalName}-thumbnail.${ext}`),
      sizes.thumbnail.width,
      sizes.thumbnail.height,
      quality,
      format,
      position
    );

    // Generate small (300px or 533px width)
    processedImages.small = await this.resizeAndCrop(
      inputPath,
      path.join(outputDir, `${originalName}-small.${ext}`),
      sizes.small.width,
      sizes.small.height,
      quality,
      format,
      position
    );

    // Generate medium (600px or 1067px width) with size optimization
    processedImages.medium = await this.resizeAndCropOptimized(
      inputPath,
      path.join(outputDir, `${originalName}-medium.${ext}`),
      sizes.medium.width,
      sizes.medium.height,
      quality,
      format,
      position,
      maxMediumSize
    );

    // Generate large (900px or 1600px width)
    processedImages.large = await this.resizeAndCrop(
      inputPath,
      path.join(outputDir, `${originalName}-large.${ext}`),
      sizes.large.width,
      sizes.large.height,
      quality,
      format,
      position
    );

    return processedImages;
  }

  /**
   * Resize and crop image to exact dimensions
   * @param inputPath - Input image path
   * @param outputPath - Output image path
   * @param width - Target width
   * @param height - Target height
   * @param quality - Image quality (1-100)
   * @param format - Output format
   * @param position - Crop position (supports focal point)
   * @returns Path to the processed image
   */
  private async resizeAndCrop(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number,
    quality: number,
    format: 'jpeg' | 'webp',
    position: string = 'centre'
  ): Promise<string> {
    try {
      const image = sharp(inputPath);

      // Resize to fit within dimensions, showing entire image
      await image
        .resize(width, height, {
          fit: 'contain',         // Show entire image within dimensions
          background: { r: 255, g: 255, b: 255, alpha: 1 },  // White background for letterboxing
          withoutEnlargement: false
        })
        .toFormat(format, {
          quality: quality,
          progressive: true,
          effort: 6               // Max compression effort for WebP
        })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error(`Error processing image ${inputPath}:`, error);
      throw new Error(`Failed to process image: ${error}`);
    }
  }

  /**
   * Resize and crop with adaptive quality to meet file size target
   * @param inputPath - Input image path
   * @param outputPath - Output image path
   * @param width - Target width
   * @param height - Target height
   * @param initialQuality - Starting quality (1-100)
   * @param format - Output format
   * @param position - Crop position
   * @param maxSizeKB - Maximum file size in KB
   * @returns Path to the processed image
   */
  private async resizeAndCropOptimized(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number,
    initialQuality: number,
    format: 'jpeg' | 'webp',
    position: string = 'centre',
    maxSizeKB: number = 200
  ): Promise<string> {
    let quality = initialQuality;
    const maxSizeBytes = maxSizeKB * 1024;
    const minQuality = 50; // Don't go below 50% quality

    try {
      // First attempt with initial quality
      await this.resizeAndCrop(
        inputPath,
        outputPath,
        width,
        height,
        quality,
        format,
        position
      );

      // Check file size and reduce quality if needed
      let stats = await fs.stat(outputPath);
      let attempts = 0;
      const maxAttempts = 5;

      while (stats.size > maxSizeBytes && quality > minQuality && attempts < maxAttempts) {
        // Reduce quality by 10% each iteration
        quality = Math.max(minQuality, quality - 10);

        await this.resizeAndCrop(
          inputPath,
          outputPath,
          width,
          height,
          quality,
          format,
          position
        );

        stats = await fs.stat(outputPath);
        attempts++;
      }

      console.log(`Optimized medium variant: ${(stats.size / 1024).toFixed(2)}KB (quality: ${quality})`);
      return outputPath;
    } catch (error) {
      console.error(`Error optimizing image ${inputPath}:`, error);
      throw new Error(`Failed to optimize image: ${error}`);
    }
  }

  /**
   * Convert focal point coordinates to sharp position
   * @param focalPoint - Optional focal point with x, y in 0-1 range
   * @returns Sharp position string or strategy
   */
  private getFocalPosition(
    focalPoint?: { x: number; y: number }
  ): string {
    if (!focalPoint) {
      return 'centre'; // Default to center crop
    }

    // Convert 0-1 range to sharp's gravity/position system
    // Sharp supports: north, northeast, east, southeast, south, southwest, west, northwest, center, centre
    // For more precise control, we can use attention or entropy strategies
    const { x, y } = focalPoint;

    // If close to center, use centre
    if (Math.abs(x - 0.5) < 0.15 && Math.abs(y - 0.5) < 0.15) {
      return 'centre';
    }

    // Map to cardinal/ordinal directions
    const isTop = y < 0.33;
    const isMiddle = y >= 0.33 && y <= 0.67;
    const isBottom = y > 0.67;

    const isLeft = x < 0.33;
    const isCenter = x >= 0.33 && x <= 0.67;
    const isRight = x > 0.67;

    if (isTop && isLeft) return 'northwest';
    if (isTop && isCenter) return 'north';
    if (isTop && isRight) return 'northeast';
    if (isMiddle && isLeft) return 'west';
    if (isMiddle && isCenter) return 'centre';
    if (isMiddle && isRight) return 'east';
    if (isBottom && isLeft) return 'southwest';
    if (isBottom && isCenter) return 'south';
    if (isBottom && isRight) return 'southeast';

    return 'centre'; // Fallback
  }

  /**
   * Get size definitions based on aspect ratio
   * @param aspectRatio - Desired aspect ratio
   * @returns Size definitions for each image size
   */
  private getSizeDefinitions(aspectRatio: '1:1' | '3:4' | '16:9') {
    if (aspectRatio === '1:1') {
      // Audio Books (Square)
      return {
        thumbnail: { width: 150, height: 150 },
        small: { width: 300, height: 300 },
        medium: { width: 600, height: 600 },
        large: { width: 900, height: 900 }
      };
    } else if (aspectRatio === '3:4') {
      // Books (Portrait)
      return {
        thumbnail: { width: 150, height: 200 },
        small: { width: 300, height: 400 },
        medium: { width: 600, height: 800 },
        large: { width: 900, height: 1200 }
      };
    } else {
      // Videos (Landscape 16:9)
      return {
        thumbnail: { width: 267, height: 150 },
        small: { width: 533, height: 300 },
        medium: { width: 1067, height: 600 },
        large: { width: 1600, height: 900 }
      };
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   * @param dirPath - Directory path to ensure
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Get image metadata (dimensions, format, etc.)
   * @param imagePath - Path to image
   * @returns Image metadata
   */
  async getImageMetadata(imagePath: string) {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size,
        hasAlpha: metadata.hasAlpha
      };
    } catch (error) {
      console.error(`Error reading image metadata ${imagePath}:`, error);
      throw new Error(`Failed to read image metadata: ${error}`);
    }
  }

  /**
   * Crop image to specific aspect ratio without resizing
   * @param inputPath - Input image path
   * @param outputPath - Output image path
   * @param aspectRatio - Target aspect ratio
   * @param quality - Image quality
   * @returns Path to cropped image
   */
  async cropToAspectRatio(
    inputPath: string,
    outputPath: string,
    aspectRatio: '1:1' | '3:4' | '16:9',
    quality: number = 85
  ): Promise<string> {
    try {
      const metadata = await this.getImageMetadata(inputPath);
      const { width, height } = metadata;

      if (!width || !height) {
        throw new Error('Invalid image dimensions');
      }

      // Calculate target dimensions based on aspect ratio
      let targetWidth: number;
      let targetHeight: number;

      if (aspectRatio === '1:1') {
        // Square - use the smaller dimension
        const size = Math.min(width, height);
        targetWidth = size;
        targetHeight = size;
      } else if (aspectRatio === '3:4') {
        const ratio = 3 / 4;
        if (width / height > ratio) {
          // Image is too wide, crop width
          targetWidth = Math.floor(height * ratio);
          targetHeight = height;
        } else {
          // Image is too tall, crop height
          targetWidth = width;
          targetHeight = Math.floor(width / ratio);
        }
      } else {
        // 16:9
        const ratio = 16 / 9;
        if (width / height > ratio) {
          // Image is too wide, crop width
          targetWidth = Math.floor(height * ratio);
          targetHeight = height;
        } else {
          // Image is too tall, crop height
          targetWidth = width;
          targetHeight = Math.floor(width / ratio);
        }
      }

      // Crop from center
      await sharp(inputPath)
        .resize(targetWidth, targetHeight, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error(`Error cropping image ${inputPath}:`, error);
      throw new Error(`Failed to crop image: ${error}`);
    }
  }

  /**
   * Optimize image without changing dimensions
   * @param inputPath - Input image path
   * @param outputPath - Output image path
   * @param quality - Image quality
   * @returns Path to optimized image
   */
  async optimizeImage(
    inputPath: string,
    outputPath: string,
    quality: number = 85
  ): Promise<string> {
    try {
      const metadata = await this.getImageMetadata(inputPath);

      await sharp(inputPath)
        .toFormat(metadata.format as any, {
          quality,
          progressive: true
        })
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error(`Error optimizing image ${inputPath}:`, error);
      throw new Error(`Failed to optimize image: ${error}`);
    }
  }

  /**
   * Delete processed images (cleanup utility)
   * @param imageSizes - ImageSizes object containing paths to delete
   */
  async deleteProcessedImages(imageSizes: ImageSizes): Promise<void> {
    const pathsToDelete = [
      imageSizes.thumbnail,
      imageSizes.small,
      imageSizes.medium,
      imageSizes.large
    ].filter(Boolean);

    for (const imagePath of pathsToDelete) {
      try {
        await fs.unlink(imagePath);
      } catch (error) {
        console.error(`Failed to delete image ${imagePath}:`, error);
      }
    }
  }

  /**
   * Convert relative path to database-storable format
   * @param absolutePath - Absolute file path
   * @param publicDir - Public directory base path
   * @returns Relative path suitable for database storage
   */
  convertToRelativePath(absolutePath: string, publicDir: string): string {
    // Convert absolute path to /public/images/... format
    // publicDir should be the project root, not the public directory
    const relativePath = absolutePath.replace(publicDir, '');
    // Ensure it starts with /public/
    if (relativePath.startsWith('/images/')) {
      return '/public' + relativePath;
    }
    return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  }

  /**
   * Regenerate image variants from an existing image (for backwards compatibility)
   * @param originalImagePath - Path to original image (can be relative or absolute)
   * @param aspectRatio - Target aspect ratio
   * @param publicDir - Public directory base path
   * @param focalPoint - Optional focal point for smart cropping
   * @returns Object containing paths to all generated image sizes
   */
  async regenerateVariants(
    originalImagePath: string,
    aspectRatio: '1:1' | '3:4' | '16:9',
    publicDir: string,
    focalPoint?: { x: number; y: number }
  ): Promise<ImageSizes> {
    try {
      // Convert relative path to absolute if needed
      let absolutePath = originalImagePath;
      if (!path.isAbsolute(originalImagePath)) {
        // Remove /public prefix if present
        const cleanPath = originalImagePath.replace(/^\/public/, '');
        absolutePath = path.join(publicDir, 'public', cleanPath);
      }

      // Verify the file exists
      try {
        await fs.access(absolutePath);
      } catch {
        throw new Error(`Original image not found: ${absolutePath}`);
      }

      // Get output directory from original path
      const outputDir = path.dirname(absolutePath);

      // Process the image with the same service
      return await this.processUploadedImage(absolutePath, {
        aspectRatio,
        outputDir,
        focalPoint,
        quality: 85,
        format: 'webp'
      });
    } catch (error) {
      console.error(`Error regenerating variants for ${originalImagePath}:`, error);
      throw new Error(`Failed to regenerate variants: ${error}`);
    }
  }

  /**
   * Check if file size exceeds threshold and needs recompression
   * @param filePath - Path to file
   * @param maxSizeKB - Maximum size in KB
   * @returns True if file needs recompression
   */
  async needsRecompression(filePath: string, maxSizeKB: number): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size > maxSizeKB * 1024;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const imageProcessingService = new ImageProcessingService();
