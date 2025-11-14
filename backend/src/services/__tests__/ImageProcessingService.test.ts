import { ImageProcessingService } from '../ImageProcessingService';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;
  let tempDir: string;
  let testImagePath: string;

  beforeAll(async () => {
    service = new ImageProcessingService();

    // Create a temporary directory for test outputs
    tempDir = await mkdtemp(path.join(tmpdir(), 'image-test-'));

    // Create a test image (500x400 rectangle)
    testImagePath = path.join(tempDir, 'test-image.jpg');
    await sharp({
      create: {
        width: 500,
        height: 400,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
      .jpeg()
      .toFile(testImagePath);
  });

  afterAll(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up temp dir:', error);
    }
  });

  describe('processUploadedImage', () => {
    it('should generate all 4 responsive variants for books (3:4 aspect ratio)', async () => {
      const result = await service.processUploadedImage(testImagePath, {
        aspectRatio: '3:4',
        outputDir: tempDir,
        quality: 85,
        format: 'webp'
      });

      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('small');
      expect(result).toHaveProperty('medium');
      expect(result).toHaveProperty('large');
      expect(result).toHaveProperty('original');

      // Verify files exist
      await expect(fs.access(result.thumbnail)).resolves.not.toThrow();
      await expect(fs.access(result.small)).resolves.not.toThrow();
      await expect(fs.access(result.medium)).resolves.not.toThrow();
      await expect(fs.access(result.large)).resolves.not.toThrow();
    });

    it('should generate square variants for audiobooks (1:1 aspect ratio)', async () => {
      const result = await service.processUploadedImage(testImagePath, {
        aspectRatio: '1:1',
        outputDir: tempDir,
        quality: 85,
        format: 'webp'
      });

      // Check thumbnail dimensions (should be 150x150)
      const metadata = await sharp(result.thumbnail).metadata();
      expect(metadata.width).toBe(150);
      expect(metadata.height).toBe(150);
    });

    it('should generate landscape variants for videos (16:9 aspect ratio)', async () => {
      const result = await service.processUploadedImage(testImagePath, {
        aspectRatio: '16:9',
        outputDir: tempDir,
        quality: 85,
        format: 'webp'
      });

      // Check thumbnail dimensions (should be 267x150)
      const metadata = await sharp(result.thumbnail).metadata();
      expect(metadata.width).toBe(267);
      expect(metadata.height).toBe(150);
    });

    it('should optimize medium variant to be under 200KB by default', async () => {
      // Create a larger test image
      const largeImagePath = path.join(tempDir, 'large-test.jpg');
      await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 100, g: 150, b: 200 }
        }
      })
        .jpeg()
        .toFile(largeImagePath);

      const result = await service.processUploadedImage(largeImagePath, {
        aspectRatio: '1:1',
        outputDir: tempDir,
        quality: 85,
        format: 'webp',
        maxMediumSize: 200
      });

      const stats = await fs.stat(result.medium);
      const sizeInKB = stats.size / 1024;

      // Medium variant should be under 200KB (with some tolerance)
      expect(sizeInKB).toBeLessThanOrEqual(220); // Allow 10% tolerance
    });

    it('should apply focal point when provided', async () => {
      const result = await service.processUploadedImage(testImagePath, {
        aspectRatio: '1:1',
        outputDir: tempDir,
        quality: 85,
        format: 'webp',
        focalPoint: { x: 0.75, y: 0.25 } // Top right
      });

      // Verify file was created (focal point affects cropping internally)
      await expect(fs.access(result.thumbnail)).resolves.not.toThrow();
    });

    it('should use WebP format by default', async () => {
      const result = await service.processUploadedImage(testImagePath, {
        aspectRatio: '3:4',
        outputDir: tempDir
      });

      const metadata = await sharp(result.thumbnail).metadata();
      expect(metadata.format).toBe('webp');
    });
  });

  describe('getFocalPosition', () => {
    it('should return centre for no focal point', () => {
      const position = (service as any).getFocalPosition();
      expect(position).toBe('centre');
    });

    it('should return centre for center focal point', () => {
      const position = (service as any).getFocalPosition({ x: 0.5, y: 0.5 });
      expect(position).toBe('centre');
    });

    it('should return northwest for top-left focal point', () => {
      const position = (service as any).getFocalPosition({ x: 0.1, y: 0.1 });
      expect(position).toBe('northwest');
    });

    it('should return southeast for bottom-right focal point', () => {
      const position = (service as any).getFocalPosition({ x: 0.9, y: 0.9 });
      expect(position).toBe('southeast');
    });
  });

  describe('getImageMetadata', () => {
    it('should return correct metadata for an image', async () => {
      const metadata = await service.getImageMetadata(testImagePath);

      expect(metadata).toHaveProperty('width');
      expect(metadata).toHaveProperty('height');
      expect(metadata).toHaveProperty('format');
      expect(metadata).toHaveProperty('size');
    });

    it('should throw error for invalid image path', async () => {
      await expect(
        service.getImageMetadata('/nonexistent/image.jpg')
      ).rejects.toThrow();
    });
  });

  describe('regenerateVariants', () => {
    it('should regenerate variants from existing image', async () => {
      const publicDir = path.dirname(tempDir);
      const result = await service.regenerateVariants(
        testImagePath,
        '3:4',
        publicDir
      );

      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('small');
      expect(result).toHaveProperty('medium');
      expect(result).toHaveProperty('large');

      // Verify files exist
      await expect(fs.access(result.thumbnail)).resolves.not.toThrow();
    });

    it('should handle focal point in regeneration', async () => {
      const publicDir = path.dirname(tempDir);
      const result = await service.regenerateVariants(
        testImagePath,
        '1:1',
        publicDir,
        { x: 0.7, y: 0.3 }
      );

      await expect(fs.access(result.thumbnail)).resolves.not.toThrow();
    });

    it('should throw error for non-existent image', async () => {
      const publicDir = path.dirname(tempDir);
      await expect(
        service.regenerateVariants(
          '/nonexistent/image.jpg',
          '3:4',
          publicDir
        )
      ).rejects.toThrow('Original image not found');
    });
  });

  describe('needsRecompression', () => {
    it('should return true if file exceeds size threshold', async () => {
      // Create a large file
      const largeFile = path.join(tempDir, 'large-file.jpg');
      await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
        .jpeg({ quality: 100 })
        .toFile(largeFile);

      const needsRecompression = await service.needsRecompression(largeFile, 50);
      expect(needsRecompression).toBe(true);
    });

    it('should return false if file is under size threshold', async () => {
      const needsRecompression = await service.needsRecompression(testImagePath, 10000);
      expect(needsRecompression).toBe(false);
    });

    it('should return false for non-existent file', async () => {
      const needsRecompression = await service.needsRecompression('/nonexistent.jpg', 100);
      expect(needsRecompression).toBe(false);
    });
  });

  describe('getSizeDefinitions', () => {
    it('should return correct dimensions for 3:4 aspect ratio', () => {
      const sizes = (service as any).getSizeDefinitions('3:4');

      expect(sizes.thumbnail).toEqual({ width: 150, height: 200 });
      expect(sizes.small).toEqual({ width: 300, height: 400 });
      expect(sizes.medium).toEqual({ width: 600, height: 800 });
      expect(sizes.large).toEqual({ width: 900, height: 1200 });
    });

    it('should return correct dimensions for 1:1 aspect ratio', () => {
      const sizes = (service as any).getSizeDefinitions('1:1');

      expect(sizes.thumbnail).toEqual({ width: 150, height: 150 });
      expect(sizes.small).toEqual({ width: 300, height: 300 });
      expect(sizes.medium).toEqual({ width: 600, height: 600 });
      expect(sizes.large).toEqual({ width: 900, height: 900 });
    });

    it('should return correct dimensions for 16:9 aspect ratio', () => {
      const sizes = (service as any).getSizeDefinitions('16:9');

      expect(sizes.thumbnail).toEqual({ width: 267, height: 150 });
      expect(sizes.small).toEqual({ width: 533, height: 300 });
      expect(sizes.medium).toEqual({ width: 1067, height: 600 });
      expect(sizes.large).toEqual({ width: 1600, height: 900 });
    });
  });

  describe('File size and quality optimization', () => {
    it('should reduce quality iteratively to meet file size target', async () => {
      // Create a complex image that will be large
      const complexImagePath = path.join(tempDir, 'complex-image.jpg');
      await sharp({
        create: {
          width: 1200,
          height: 1600, // 3:4 aspect ratio
          channels: 4,
          background: { r: 128, g: 128, b: 128, alpha: 1 },
          noise: {
            type: 'gaussian',
            mean: 128,
            sigma: 30
          }
        }
      })
        .jpeg({ quality: 100 })
        .toFile(complexImagePath);

      const result = await service.processUploadedImage(complexImagePath, {
        aspectRatio: '3:4',
        outputDir: tempDir,
        quality: 85,
        format: 'webp',
        maxMediumSize: 150 // Strict size limit
      });

      const stats = await fs.stat(result.medium);
      const sizeInKB = stats.size / 1024;

      // Should be under or close to 150KB
      expect(sizeInKB).toBeLessThanOrEqual(170); // Allow some tolerance
    });
  });
});
