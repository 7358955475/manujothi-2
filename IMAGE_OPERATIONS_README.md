# Image Operations Guide

This guide covers operations for managing responsive image variants, regenerating images, and CDN invalidation for the OGON media platform.

## Table of Contents

- [Overview](#overview)
- [Responsive Image System](#responsive-image-system)
- [Variant Regeneration](#variant-regeneration)
- [Image Statistics](#image-statistics)
- [CDN Invalidation](#cdn-invalidation)
- [Troubleshooting](#troubleshooting)
- [Performance Optimization](#performance-optimization)

---

## Overview

OGON automatically processes uploaded images into multiple responsive variants optimized for different screen sizes and media types. The system ensures:

- **Automatic cropping** to correct aspect ratios (3:4 for books, 1:1 for audio, 16:9 for videos)
- **Smart compression** with WebP format (medium variant targets <200KB)
- **Focal point support** for preserving important image areas during cropping
- **Backwards compatibility** with on-demand variant generation

---

## Responsive Image System

### Aspect Ratios by Media Type

| Media Type | Aspect Ratio | Display Format |
|------------|--------------|----------------|
| Books      | 3:4          | Portrait       |
| Audiobooks | 1:1          | Square         |
| Videos     | 16:9         | Landscape      |

### Generated Variants

For each uploaded image, the system generates 4 variants:

| Variant   | Books (3:4)  | Audio (1:1) | Videos (16:9) |
|-----------|--------------|-------------|---------------|
| Thumbnail | 150×200 px   | 150×150 px  | 267×150 px    |
| Small     | 300×400 px   | 300×300 px  | 533×300 px    |
| Medium    | 600×800 px   | 600×600 px  | 1067×600 px   |
| Large     | 900×1200 px  | 900×900 px  | 1600×900 px   |

### Database Schema

All media tables include responsive image columns:

```sql
-- Books table
cover_image_url      VARCHAR(500)  -- Original upload
cover_thumbnail      VARCHAR(500)  -- 150×200 WebP
cover_small          VARCHAR(500)  -- 300×400 WebP
cover_medium         VARCHAR(500)  -- 600×800 WebP
cover_large          VARCHAR(500)  -- 900×1200 WebP

-- Audio Books table
cover_image_url      VARCHAR(500)  -- Original upload
cover_thumbnail      VARCHAR(500)  -- 150×150 WebP
cover_small          VARCHAR(500)  -- 300×300 WebP
cover_medium         VARCHAR(500)  -- 600×600 WebP
cover_large          VARCHAR(500)  -- 900×900 WebP

-- Videos table
thumbnail_url        VARCHAR(500)  -- Original upload or YouTube
thumbnail_small      VARCHAR(500)  -- 533×300 WebP
thumbnail_medium     VARCHAR(500)  -- 1067×600 WebP
thumbnail_large      VARCHAR(500)  -- 1600×900 WebP
```

---

## Variant Regeneration

### API Endpoints

#### 1. Get Image Statistics

Get statistics about images with missing variants:

```bash
curl -X GET http://localhost:3001/api/images/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "books": {
      "total": 150,
      "missingVariants": 12
    },
    "audiobooks": {
      "total": 80,
      "missingVariants": 5
    },
    "videos": {
      "total": 200,
      "missingVariants": 0
    }
  },
  "totalMissing": 17
}
```

#### 2. Regenerate Single Item

Regenerate variants for a specific media item:

```bash
curl -X POST http://localhost:3001/api/images/regenerate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mediaType": "book",
    "mediaId": "550e8400-e29b-41d4-a716-446655440000",
    "focalPoint": {
      "x": 0.6,
      "y": 0.3
    }
  }'
```

**Parameters:**
- `mediaType`: One of `"book"`, `"audiobook"`, or `"video"`
- `mediaId`: UUID of the media item
- `focalPoint` (optional): Object with `x` and `y` coordinates (0-1 range)
  - `x: 0.5, y: 0.5` = center (default)
  - `x: 0, y: 0` = top-left
  - `x: 1, y: 1` = bottom-right

**Response:**
```json
{
  "success": true,
  "message": "Image variants regenerated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "variants": {
      "thumbnail": "/public/images/cover-thumbnail.webp",
      "small": "/public/images/cover-small.webp",
      "medium": "/public/images/cover-medium.webp",
      "large": "/public/images/cover-large.webp"
    }
  }
}
```

#### 3. Batch Regenerate All Missing Variants

Regenerate all missing variants across all media types:

```bash
curl -X POST http://localhost:3001/api/images/regenerate-all \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Batch regeneration completed",
  "results": {
    "books": {
      "processed": 12,
      "errors": 0
    },
    "audiobooks": {
      "processed": 5,
      "errors": 0
    },
    "videos": {
      "processed": 0,
      "errors": 0
    }
  }
}
```

### Using Node.js Script

Create a script for batch regeneration:

```javascript
// scripts/regenerate-images.js
const axios = require('axios');

async function regenerateAllImages() {
  const token = 'YOUR_ADMIN_TOKEN';

  try {
    // Get statistics first
    const stats = await axios.get('http://localhost:3001/api/images/stats', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Missing variants:', stats.data.totalMissing);

    // Regenerate all
    const result = await axios.post(
      'http://localhost:3001/api/images/regenerate-all',
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log('Regeneration complete:', result.data.results);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

regenerateAllImages();
```

Run with:
```bash
node scripts/regenerate-images.js
```

---

## Image Statistics

### Check Image Coverage

Query to check which items are missing variants:

```sql
-- Books missing variants
SELECT id, title, cover_image_url,
       cover_thumbnail IS NULL as missing_thumbnail,
       cover_small IS NULL as missing_small,
       cover_medium IS NULL as missing_medium,
       cover_large IS NULL as missing_large
FROM books
WHERE cover_image_url IS NOT NULL
  AND (cover_thumbnail IS NULL OR cover_small IS NULL
       OR cover_medium IS NULL OR cover_large IS NULL);

-- Audiobooks missing variants
SELECT id, title, cover_image_url,
       cover_thumbnail IS NULL as missing_thumbnail,
       cover_small IS NULL as missing_small,
       cover_medium IS NULL as missing_medium,
       cover_large IS NULL as missing_large
FROM audio_books
WHERE cover_image_url IS NOT NULL
  AND (cover_thumbnail IS NULL OR cover_small IS NULL
       OR cover_medium IS NULL OR cover_large IS NULL);

-- Videos missing variants
SELECT id, title, thumbnail_url,
       thumbnail_small IS NULL as missing_small,
       thumbnail_medium IS NULL as missing_medium,
       thumbnail_large IS NULL as missing_large
FROM videos
WHERE thumbnail_url IS NOT NULL
  AND (thumbnail_small IS NULL OR thumbnail_medium IS NULL
       OR thumbnail_large IS NULL);
```

### File Size Analysis

Check file sizes of generated variants:

```bash
# Find all medium variants
find backend/public/images -name "*-medium.webp" -exec ls -lh {} \;

# Check if any exceed 200KB
find backend/public/images -name "*-medium.webp" -size +200k -exec ls -lh {} \;

# Count total variants
find backend/public/images -name "*-thumbnail.webp" | wc -l
find backend/public/images -name "*-small.webp" | wc -l
find backend/public/images -name "*-medium.webp" | wc -l
find backend/public/images -name "*-large.webp" | wc -l
```

---

## CDN Invalidation

### CloudFront Invalidation (AWS)

If using AWS CloudFront as CDN, invalidate cached images after regeneration:

```bash
# Install AWS CLI
npm install -g aws-cli

# Configure AWS credentials
aws configure

# Invalidate specific path
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/public/images/*-medium.webp"

# Invalidate all images
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/public/images/*"
```

### Cloudflare Purge Cache

If using Cloudflare:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      "https://yourdomain.com/public/images/cover-medium.webp",
      "https://yourdomain.com/public/images/cover-small.webp"
    ]
  }'
```

### Cache Busting with Query Parameters

If CDN invalidation isn't available, use query parameters:

```javascript
// In API response, append timestamp
const imageUrl = `/public/images/cover-medium.webp?v=${Date.now()}`;
```

### Automated CDN Invalidation Script

```javascript
// scripts/invalidate-cdn.js
const AWS = require('aws-sdk');
const cloudfront = new AWS.CloudFront();

async function invalidateCDN(paths) {
  const params = {
    DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: `invalidation-${Date.now()}`,
      Paths: {
        Quantity: paths.length,
        Items: paths
      }
    }
  };

  try {
    const result = await cloudfront.createInvalidation(params).promise();
    console.log('CDN invalidation created:', result.Invalidation.Id);
    return result;
  } catch (error) {
    console.error('CDN invalidation failed:', error);
    throw error;
  }
}

// Invalidate all image variants
invalidateCDN([
  '/public/images/*-thumbnail.webp',
  '/public/images/*-small.webp',
  '/public/images/*-medium.webp',
  '/public/images/*-large.webp'
]);
```

---

## Troubleshooting

### Issue: Missing Variants After Upload

**Symptoms:** Image uploaded but variants not generated

**Solution:**
1. Check backend logs for errors:
   ```bash
   cd backend
   npm run dev
   # Look for errors in upload processing
   ```

2. Check file permissions:
   ```bash
   ls -la backend/public/images/
   # Ensure write permissions
   chmod -R 755 backend/public/images/
   ```

3. Manually regenerate:
   ```bash
   curl -X POST http://localhost:3001/api/images/regenerate \
     -H "Authorization: Bearer TOKEN" \
     -d '{"mediaType":"book","mediaId":"BOOK_ID"}'
   ```

### Issue: Images Too Large

**Symptoms:** Medium variant exceeds 200KB

**Solution:**
1. Check current settings in `ImageProcessingService.ts`:
   ```typescript
   maxMediumSize?: number; // default: 200
   ```

2. Adjust quality settings:
   ```typescript
   await service.processUploadedImage(path, {
     maxMediumSize: 150, // Reduce to 150KB
     quality: 80 // Lower initial quality
   });
   ```

3. Regenerate with new settings:
   ```bash
   curl -X POST http://localhost:3001/api/images/regenerate-all
   ```

### Issue: Incorrect Aspect Ratio

**Symptoms:** Images appear stretched or incorrectly cropped

**Solution:**
1. Verify aspect ratio in user panel component:
   ```tsx
   aspectRatio={
     mediaType === 'video' ? '16/9' :
     mediaType === 'audio' ? '1/1' :
     '3/4'
   }
   ```

2. Check LazyImage component uses `object-fit: cover`:
   ```tsx
   <img className="w-full h-full object-cover" />
   ```

3. Regenerate variants if aspect ratio was wrong:
   ```bash
   curl -X POST http://localhost:3001/api/images/regenerate \
     -d '{"mediaType":"book","mediaId":"ID"}'
   ```

### Issue: Focal Point Not Applied

**Symptoms:** Cropping doesn't focus on the selected area

**Solution:**
1. Check focal point coordinates (must be 0-1 range):
   ```json
   {
     "focalPoint": {
       "x": 0.7,  // 70% from left
       "y": 0.3   // 30% from top
     }
   }
   ```

2. Verify getFocalPosition mapping:
   ```typescript
   // Maps 0-1 coordinates to Sharp positions
   // 0.0-0.33: left/top
   // 0.33-0.67: center
   // 0.67-1.0: right/bottom
   ```

---

## Performance Optimization

### Optimize Existing Images

Batch optimize all existing images:

```bash
# Find large images
find backend/public/images -name "*.webp" -size +300k

# Regenerate only large images
# Create script: scripts/optimize-large-images.js
```

```javascript
const { imageProcessingService } = require('../backend/src/services/ImageProcessingService');
const fs = require('fs/promises');
const path = require('path');

async function optimizeLargeImages() {
  const imagesDir = path.join(__dirname, '../backend/public/images');
  const files = await fs.readdir(imagesDir);

  for (const file of files) {
    if (file.includes('-medium.webp')) {
      const filePath = path.join(imagesDir, file);
      const stats = await fs.stat(filePath);

      if (stats.size > 200 * 1024) {
        console.log(`Optimizing ${file} (${(stats.size / 1024).toFixed(2)}KB)`);

        // Recompress with lower quality
        const needsRecompression = await imageProcessingService.needsRecompression(
          filePath,
          200
        );

        if (needsRecompression) {
          // Trigger regeneration via API
          console.log(`File needs recompression: ${file}`);
        }
      }
    }
  }
}

optimizeLargeImages();
```

### Monitoring and Alerts

Set up monitoring for image processing:

```javascript
// Add to ImageProcessingService
async processUploadedImage(...) {
  const startTime = Date.now();

  try {
    const result = await this.processImage(...);
    const duration = Date.now() - startTime;

    // Log performance metrics
    console.log(`Image processed in ${duration}ms`);

    // Alert if processing takes too long
    if (duration > 10000) {
      console.warn(`Slow image processing: ${duration}ms`);
    }

    return result;
  } catch (error) {
    // Alert on errors
    console.error('Image processing failed:', error);
    throw error;
  }
}
```

### Caching Strategy

Current cache headers (configured in `backend/src/index.ts`):

```javascript
// Responsive image variants: 1 year cache
'Cache-Control': 'public, max-age=31536000, immutable'

// Original images: 30 days cache
'Cache-Control': 'public, max-age=2592000'
```

To update cache duration:
1. Edit cache headers in `backend/src/index.ts`
2. Restart backend
3. Invalidate CDN cache
4. Clear browser cache for testing

---

## Maintenance Schedule

### Weekly
- [ ] Check `/api/images/stats` for missing variants
- [ ] Monitor disk space in `backend/public/images/`

### Monthly
- [ ] Run file size analysis
- [ ] Optimize large medium variants (>200KB)
- [ ] Review and archive unused images

### After Major Uploads
- [ ] Run `/api/images/regenerate-all` if needed
- [ ] Invalidate CDN cache
- [ ] Verify user panel displays correctly

---

## Support

For issues or questions:
- Check backend logs: `backend/logs/`
- Review test suite: `npm test` in backend
- Contact: admin@ogon.com

---

**Last Updated:** 2025-01-09
**Version:** 1.0.0
