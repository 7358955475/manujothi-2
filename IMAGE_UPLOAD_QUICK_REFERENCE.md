# Image Upload & Display - Quick Reference Guide

## File Paths (Absolute)

### Backend Services
- Image Processing: `/Users/harikrishna/Documents/manujothi-2/backend/src/services/ImageProcessingService.ts` (354 lines)
- Upload Middleware: `/Users/harikrishna/Documents/manujothi-2/backend/src/middleware/upload.ts` (315 lines)

### Backend Controllers
- Books: `/Users/harikrishna/Documents/manujothi-2/backend/src/controllers/bookController.ts` (393 lines)
- Audio Books: `/Users/harikrishna/Documents/manujothi-2/backend/src/controllers/audioBookController.ts` (401 lines)
- Videos: `/Users/harikrishna/Documents/manujothi-2/backend/src/controllers/videoController.ts` (482 lines)

### Database
- Initial Schema: `/Users/harikrishna/Documents/manujothi-2/backend/init.sql` (111 lines)
- Responsive Images Migration: `/Users/harikrishna/Documents/manujothi-2/backend/migrations/008_add_responsive_image_columns.sql` (56 lines)

### Frontend Admin
- Books Upload: `/Users/harikrishna/Documents/manujothi-2/frontend/admin-panel/src/pages/Books.tsx` (840 lines)
- Audio Books Upload: `/Users/harikrishna/Documents/manujothi-2/frontend/admin-panel/src/pages/AudioBooks.tsx` (776 lines)
- Videos Upload: `/Users/harikrishna/Documents/manujothi-2/frontend/admin-panel/src/pages/Videos.tsx` (1015 lines)
- API Service: `/Users/harikrishna/Documents/manujothi-2/frontend/admin-panel/src/services/api.ts` (93 lines)

### Frontend User Panel
- Lazy Image Component: `/Users/harikrishna/Documents/manujothi-2/frontend/user-panel/src/components/LazyImage.tsx` (180 lines)
- Media Shelf Component: `/Users/harikrishna/Documents/manujothi-2/frontend/user-panel/src/components/MediaShelf.tsx` (200+ lines)

---

## Image Processing Pipeline

### Books (3:4 Aspect Ratio)
```
Original → 150x200 (thumbnail) → 300x400 (small) → 600x800 (medium) → 900x1200 (large)
         → All converted to WebP @ 85% quality
```

### Audio Books (1:1 Aspect Ratio)
```
Original → 150x150 (thumbnail) → 300x300 (small) → 600x600 (medium) → 900x900 (large)
         → All converted to WebP @ 85% quality
```

### Videos (16:9 Aspect Ratio)
```
Original → 267x150 (thumbnail) → 533x300 (small) → 1067x600 (medium) → 1600x900 (large)
         → All converted to WebP @ 85% quality
```

---

## Database Columns

### Books Table Extensions
```sql
cover_image_thumbnail VARCHAR(500)  -- 150x200px
cover_image_small VARCHAR(500)      -- 300x400px
cover_image_medium VARCHAR(500)     -- 600x800px
cover_image_large VARCHAR(500)      -- 900x1200px
```

### Audio Books Table Extensions
```sql
cover_image_thumbnail VARCHAR(500)  -- 150x150px
cover_image_small VARCHAR(500)      -- 300x300px
cover_image_medium VARCHAR(500)     -- 600x600px
cover_image_large VARCHAR(500)      -- 900x900px
```

### Videos Table Extensions
```sql
thumbnail_thumbnail VARCHAR(500)    -- 267x150px
thumbnail_small VARCHAR(500)        -- 533x300px
thumbnail_medium VARCHAR(500)       -- 1067x600px
thumbnail_large VARCHAR(500)        -- 1600x900px
```

---

## Upload Directories

```
backend/public/
├── images/       → Cover images, thumbnails (all responsive variants)
├── pdfs/         → PDF files
├── books/        → Other book formats (EPUB, DOCX, etc.)
├── audio/        → Audio files (MP3, WAV, etc.)
└── videos/       → Video files (MP4, AVI, etc.)
```

---

## API Endpoints

### Books
- `POST /api/books` - Create with multipart/form-data
- `PUT /api/books/{id}` - Update with multipart/form-data
- `GET /api/books` - List all (with pagination)
- `GET /api/books/{id}` - Get single book
- `DELETE /api/books/{id}` - Delete permanently

### Audio Books
- `POST /api/audio-books` - Create
- `PUT /api/audio-books/{id}` - Update
- `GET /api/audio-books` - List all
- `GET /api/audio-books/{id}` - Get single
- `DELETE /api/audio-books/{id}` - Delete
- `GET /audio-books/{id}/stream` - Stream audio with range support

### Videos
- `POST /api/videos` - Create
- `PUT /api/videos/{id}` - Update
- `GET /api/videos/admin/all` - List all (admin)
- `GET /api/videos/{id}` - Get single
- `DELETE /api/videos/{id}` - Delete

---

## File Size Limits

| Type | Limit | Frontend Check | Backend Limit |
|------|-------|---|---|
| Book Cover | 10MB | Yes | 100MB |
| Book PDF | 50MB | Yes | 100MB |
| Audio File | 100MB | Yes | 100MB |
| Video File | 500MB | No | 500MB |
| Thumbnail | 10MB | Yes | 100MB |

---

## Supported File Types

### Images
- JPEG, JPG, PNG, WebP (covers)
- JPEG, JPG, PNG, WebP, GIF (video thumbnails)

### Audio
- MP3, WAV, OGG, M4A, AAC, FLAC

### Video
- MP4, AVI, MOV, WMV, WebM, MKV, MPEG, MPG

### Books
- PDF, EPUB, TXT, DOCX, MOBI, AZW, AZW3, DJVU, FB2, RTF, HTML, ODT

---

## Key Functions

### ImageProcessingService.ts
- `processUploadedImage()` - Main processing (lines 38-103)
- `resizeAndCrop()` - Sharp resize/format (lines 116-143)
- `getSizeDefinitions()` - Get sizes by aspect ratio (lines 151-176)
- `convertToRelativePath()` - Convert paths for DB (lines 341-350)

### bookController.ts
- `createBook()` - Upload & process (lines 106-247)
- `updateBook()` - Update with file handling (lines 249-349)
- `deleteBook()` - Delete files + DB record (lines 351-393)

### audioBookController.ts
- `createAudioBook()` - Create with audio + cover (lines 106-205)
- `updateAudioBook()` - Update files (lines 207-357)
- `streamAudio()` - Range request streaming (lines 403-454)

### videoController.ts
- `createVideo()` - YouTube or local upload (lines 125-275)
- `updateVideo()` - Update with file handling (lines 277-438)
- `deleteVideo()` - Delete files + DB (lines 440-482)

### Frontend (Books.tsx)
- `handleCreateOrUpdate()` - Main upload handler (lines 94-195)
- `handleCoverFileSelect()` - Cover validation (lines 247-291)
- `handlePdfFileSelect()` - PDF validation (lines 205-245)
- `getImageUrl()` - URL construction (lines 31-46)

### Frontend (LazyImage.tsx)
- `getYouTubeThumbnailFallbacks()` - Quality levels (lines 38-50)
- `handleError()` - Fallback chain (lines 123-145)
- IntersectionObserver setup (lines 66-86)

### Frontend (MediaShelf.tsx)
- `getResponsiveImageSrcset()` - Build srcset (lines 121-141)
- `getBestThumbnailUrl()` - Select optimal image (lines 143-150)
- `constructImageUrl()` - URL construction (lines 8-28)

---

## Upload Flow Summary

### Books
1. Select cover image + PDF in Admin Panel
2. FormData: skip URL fields if files present
3. Backend: validate, store files, process cover image
4. Database: store original + 4 responsive sizes
5. User Panel: LazyImage loads responsive srcset

### Audio Books
1. Select audio file + optional cover
2. FormData: files prioritized over URLs
3. Backend: validate, store audio, process cover (1:1 ratio)
4. Database: audio_file_path + 4 cover variants
5. User Panel: responsive cover image + audio streaming

### Videos
#### YouTube
1. Paste YouTube URL
2. Backend: extract ID, get thumbnail automatically
3. Database: youtube_url + youtube_id + thumbnail_url
4. User Panel: embed video with thumbnail

#### Local Upload
1. Select video file + thumbnail image
2. FormData: video_source="local"
3. Backend: validate, store video, process thumbnail (16:9)
4. Database: video_file_path + 4 thumbnail variants
5. User Panel: local video player with responsive thumbnail

---

## Important Constants

### Image Quality
- Quality: 85% (for WebP/JPEG)
- Format: WebP (primary), JPEG (fallback)
- Progressive: Yes

### Responsive Sizes (Books & Audio)
- thumbnail: 150px width (width descriptor)
- small: 300px width
- medium: 600px width
- large: 900px width

### Responsive Sizes (Videos)
- thumbnail: 267px width (16:9 ratio)
- small: 533px width
- medium: 1067px width
- large: 1600px width

### Lazy Loading
- IntersectionObserver threshold: 0.01
- Root margin: 200px (preload before visible)
- Placeholder: gray SVG during load

---

## Error Codes (Upload Middleware)

- `LIMIT_FILE_SIZE` - File exceeds size limit
- `LIMIT_FILE_COUNT` - Too many files
- `LIMIT_UNEXPECTED_FILE` - Invalid field name
- `INVALID_FILE_TYPE` - Wrong MIME type or extension
- `EMPTY_FILE` - File is empty

---

## Testing Checklist

- [ ] Books: Upload cover + PDF, verify 4 image sizes stored
- [ ] Audio: Upload audio + cover, verify cover processing
- [ ] Video (YouTube): Paste URL, verify thumbnail extracted
- [ ] Video (Local): Upload video + thumbnail, verify 16:9 processing
- [ ] Responsive: Open on mobile, verify correct image size loaded
- [ ] Lazy Loading: Scroll down, verify images load on demand
- [ ] Error Handling: Upload oversized file, verify error message
- [ ] Update: Edit existing item, verify files preserved if not changed
- [ ] Delete: Delete item, verify files removed from filesystem
- [ ] YouTube Fallback: Test multiple quality levels

---

## Troubleshooting

### Images not displaying
- Check image URL format (should have /public/ prefix)
- Verify backend serving static files
- Check browser console for 404 errors
- Verify image files exist in filesystem

### Upload fails
- Check file size limits
- Verify MIME type is supported
- Check multer configuration
- Review backend error logs

### Responsive images not optimized
- Verify ImageProcessingService processed correctly
- Check database stores all 4 sizes
- Verify srcset attribute in HTML
- Test with browser DevTools network tab

### YouTube thumbnails failing
- Verify YouTube video ID extracted correctly
- Check fallback quality levels
- Test multiple YouTube URLs
- Verify internet connectivity

---

## Performance Tips

1. Use WebP format (30-50% smaller than JPEG)
2. Let browser select optimal responsive size (srcset)
3. Lazy load images with IntersectionObserver
4. Preload images 200px before visible
5. Use database indexes on image columns
6. Monitor image load times in performance section

