# Quick Start Guide - Image Resizing System

This guide will help you get started with the new automatic image resizing and cropping system.

## For Administrators

### Uploading Images with Preview

When uploading a book, audiobook, or video cover/thumbnail, you now have access to:

1. **WYSIWYG Preview** - See exactly how your image will appear in the user panel
2. **Focal Point Selection** - Choose where the crop should focus (e.g., on a face)

### Step-by-Step: Upload with Preview

#### 1. Select Your Image

```jsx
// In your upload form
<input
  type="file"
  accept="image/jpeg,image/png,image/webp"
  onChange={handleImageSelect}
/>
```

#### 2. Show WYSIWYG Preview (Optional)

```jsx
import ImagePreview from '../components/ImagePreview';

// After file selection, show preview
{showPreview && (
  <ImagePreview
    imageUrl={previewImageUrl}
    mediaType="book" // or "audio" or "video"
    title="My Book Title"
    onClose={() => setShowPreview(false)}
  />
)}
```

#### 3. Set Focal Point (Optional)

```jsx
import FocalPointSelector from '../components/FocalPointSelector';

// Let admin set focal point
{showFocalPointSelector && (
  <FocalPointSelector
    imageUrl={imageUrl}
    initialFocalPoint={focalPoint}
    mediaType="book"
    onFocalPointChange={(fp) => setFocalPoint(fp)}
    onClose={() => setShowFocalPointSelector(false)}
  />
)}
```

#### 4. Upload with Focal Point

```jsx
// Include focal point in form data
const formData = new FormData();
formData.append('cover', coverFile);
formData.append('title', title);

// If focal point was set
if (focalPoint) {
  formData.append('focalPoint', JSON.stringify(focalPoint));
}

// Submit
await axios.post('/api/books', formData);
```

### Managing Existing Images

#### Check for Missing Variants

```bash
# Via API
curl http://localhost:3001/api/images/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response shows which items need regeneration
{
  "books": { "total": 100, "missingVariants": 5 },
  "audiobooks": { "total": 50, "missingVariants": 2 },
  "videos": { "total": 75, "missingVariants": 0 }
}
```

#### Regenerate Single Item

```bash
curl -X POST http://localhost:3001/api/images/regenerate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mediaType": "book",
    "mediaId": "your-book-id",
    "focalPoint": { "x": 0.5, "y": 0.3 }
  }'
```

#### Batch Regenerate All

```bash
curl -X POST http://localhost:3001/api/images/regenerate-all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## For Developers

### Backend: Processing Uploaded Images

```typescript
import { imageProcessingService } from '../services/ImageProcessingService';

// In your controller
async function createBook(req, res) {
  const coverFile = req.files.cover[0];
  const focalPoint = req.body.focalPoint
    ? JSON.parse(req.body.focalPoint)
    : undefined;

  // Process image with focal point
  const variants = await imageProcessingService.processUploadedImage(
    coverFile.path,
    {
      aspectRatio: '3:4', // Book aspect ratio
      outputDir: path.join(__dirname, '../../public/images'),
      quality: 85,
      format: 'webp',
      focalPoint, // Optional: { x: 0.6, y: 0.4 }
      maxMediumSize: 200 // KB
    }
  );

  // Save to database
  await pool.query(`
    INSERT INTO books (
      title, cover_image_url,
      cover_thumbnail, cover_small, cover_medium, cover_large
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    title,
    variants.original,
    variants.thumbnail,
    variants.small,
    variants.medium,
    variants.large
  ]);
}
```

### Frontend: Displaying Responsive Images

```tsx
import LazyImage from '../components/LazyImage';

function MediaCard({ item, mediaType }) {
  // Build srcset from variants
  const srcset = [
    item.cover_thumbnail && `${item.cover_thumbnail} 150w`,
    item.cover_small && `${item.cover_small} 300w`,
    item.cover_medium && `${item.cover_medium} 600w`,
    item.cover_large && `${item.cover_large} 900w`
  ].filter(Boolean).join(', ');

  return (
    <LazyImage
      src={item.cover_medium || item.cover_url}
      srcset={srcset}
      alt={item.title}
      aspectRatio={mediaType === 'book' ? '3/4' : '1/1'}
      sizes="(max-width: 640px) 160px, 240px"
      className="rounded-lg"
    />
  );
}
```

### Testing

```bash
# Run unit tests
cd backend
npm test -- ImageProcessingService.test.ts

# Run integration tests
npm test -- imageUpload.integration.test.ts

# Run all tests
npm test
```

---

## Common Use Cases

### Use Case 1: Upload Book with Face on Cover

**Problem:** Book cover has author's face that gets cropped out

**Solution:**
1. Upload image in admin panel
2. Click "Set Focal Point"
3. Click on the face in the image
4. Preview shows face is now centered
5. Submit upload

**Result:** Face remains visible after cropping to 3:4 aspect ratio

### Use Case 2: Optimize Large Images

**Problem:** Some images are >1MB and slow to load

**Solution:**
```bash
# Check which images are large
find backend/public/images -name "*-medium.webp" -size +200k

# Regenerate with stricter limits
curl -X POST http://localhost:3001/api/images/regenerate \
  -d '{"mediaType":"book","mediaId":"ID"}'
```

**Result:** Images automatically compressed to <200KB

### Use Case 3: Migrate Legacy Images

**Problem:** Old uploads don't have responsive variants

**Solution:**
```bash
# 1. Check stats
curl http://localhost:3001/api/images/stats

# 2. Regenerate all missing
curl -X POST http://localhost:3001/api/images/regenerate-all

# 3. Verify completion
curl http://localhost:3001/api/images/stats
```

**Result:** All images now have responsive variants

---

## Troubleshooting

### Images Not Displaying

**Symptoms:** Broken image icons in user panel

**Check:**
```bash
# 1. Verify files exist
ls -la backend/public/images/*-medium.webp

# 2. Check database paths
psql -d ogon -c "SELECT cover_medium FROM books LIMIT 5;"

# 3. Test direct access
curl http://localhost:3001/public/images/yourimage-medium.webp
```

**Fix:** Regenerate variants if missing

### Focal Point Not Working

**Symptoms:** Crop still centered despite setting focal point

**Check:**
```javascript
// Verify focal point is saved
console.log('Focal point:', focalPoint);
// Should be: { x: 0.7, y: 0.3 } (not null/undefined)

// Check it's passed to API
console.log('FormData:', formData.get('focalPoint'));
```

**Fix:** Ensure focal point is JSON-stringified before sending

### Preview Shows Wrong Aspect Ratio

**Symptoms:** Preview doesn't match user panel

**Check:**
```tsx
// Verify mediaType prop
<ImagePreview mediaType="book" /> // Not "books"
<ImagePreview mediaType="audio" /> // Not "audiobook"
<ImagePreview mediaType="video" /> // Not "videos"
```

**Fix:** Use singular form: "book", "audio", "video"

---

## Performance Tips

### 1. Preload Critical Images

```tsx
// For above-the-fold images
<LazyImage
  src={heroImage}
  priority={true} // Load immediately
  aspectRatio="16/9"
/>
```

### 2. Optimize Upload Size

Before uploading, recommend admins:
- Use images >800px wide for books/audio
- Use images >1200px wide for videos
- Keep originals under 5MB

### 3. Monitor File Sizes

```bash
# Weekly check
find backend/public/images -name "*-medium.webp" \
  -size +200k -exec ls -lh {} \;

# If many exceed 200KB, adjust settings
```

---

## API Reference

### GET /api/images/stats

**Auth:** Admin required

**Response:**
```json
{
  "success": true,
  "stats": {
    "books": { "total": 100, "missingVariants": 5 },
    "audiobooks": { "total": 50, "missingVariants": 2 },
    "videos": { "total": 75, "missingVariants": 0 }
  },
  "totalMissing": 7
}
```

### POST /api/images/regenerate

**Auth:** Admin required

**Body:**
```json
{
  "mediaType": "book",
  "mediaId": "uuid",
  "focalPoint": { "x": 0.6, "y": 0.4 }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "variants": {
      "thumbnail": "/public/images/...",
      "small": "/public/images/...",
      "medium": "/public/images/...",
      "large": "/public/images/..."
    }
  }
}
```

### POST /api/images/regenerate-all

**Auth:** Admin required

**Response:**
```json
{
  "success": true,
  "results": {
    "books": { "processed": 12, "errors": 0 },
    "audiobooks": { "processed": 5, "errors": 0 },
    "videos": { "processed": 3, "errors": 0 }
  }
}
```

---

## Integration Checklist

- [ ] Backend dependencies installed (`npm install` in backend/)
- [ ] Database migration run (`npm run migrate`)
- [ ] Image routes registered in `index.ts`
- [ ] Admin components imported in upload forms
- [ ] User panel using LazyImage with srcset
- [ ] Cache headers configured
- [ ] Tests passing (`npm test`)
- [ ] Existing images regenerated (if needed)

---

## Next Steps

1. **Test Upload Flow:**
   - Upload a book with cover
   - Verify 4 variants created
   - Check user panel displays correctly

2. **Test Focal Point:**
   - Upload image with face/subject
   - Set focal point on subject
   - Verify preview shows correct crop

3. **Regenerate Legacy Images:**
   - Run `/api/images/stats`
   - Run `/api/images/regenerate-all`
   - Verify all items have variants

4. **Monitor Performance:**
   - Check network tab for srcset selection
   - Verify WebP format being served
   - Confirm cache headers present

---

## Support

- **Documentation:** See `IMAGE_OPERATIONS_README.md`
- **Implementation Details:** See `IMPLEMENTATION_SUMMARY.md`
- **Issues:** Check backend logs and test suite

---

**Version:** 1.0.0
**Last Updated:** 2025-01-09
