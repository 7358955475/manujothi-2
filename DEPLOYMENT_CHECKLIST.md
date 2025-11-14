# Deployment Checklist - Image Resizing System

Use this checklist to ensure the automatic image resizing and cropping system is properly deployed.

---

## Pre-Deployment Verification

### ✅ Step 1: Verify Dependencies

```bash
cd backend

# Check Sharp is installed
npm list sharp
# Should show: sharp@0.34.5

# Check all dependencies
npm install

# Verify TypeScript compilation
npm run typecheck
# Should show: No errors
```

**Expected:** All dependencies installed, no TypeScript errors

---

### ✅ Step 2: Run Tests

```bash
cd backend

# Run unit tests
npm test -- ImageProcessingService.test.ts

# Expected output:
# ✓ should generate all 4 variants for books (3:4)
# ✓ should generate square variants for audiobooks (1:1)
# ✓ should generate landscape variants for videos (16:9)
# ✓ should optimize medium variant to be under 200KB
# ✓ should apply focal point when provided
# ... (all tests passing)

# Run integration tests
npm test -- imageUpload.integration.test.ts

# Expected: All tests passing
```

**Required:** All tests must pass before deployment

---

### ✅ Step 3: Database Migration

```bash
cd backend

# Check if migration exists
ls migrations/008_add_responsive_image_columns.sql

# If exists, apply migration
psql -d ogon -f migrations/008_add_responsive_image_columns.sql

# Or if you have a migration runner:
npm run migrate
```

**Verify migration:**
```sql
-- Check new columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'books'
  AND column_name LIKE 'cover_%';

-- Expected columns:
-- cover_image_url
-- cover_thumbnail
-- cover_small
-- cover_medium
-- cover_large
```

---

### ✅ Step 4: File System Setup

```bash
cd backend

# Ensure images directory exists
mkdir -p public/images

# Check permissions (should be writable)
ls -la public/
# Expected: drwxr-xr-x ... public/images

# If not writable:
chmod -R 755 public/images
```

---

### ✅ Step 5: Environment Variables

Check your `.env` file has required variables:

```bash
# Backend .env
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/ogon
JWT_SECRET=your_secret_key
NODE_ENV=development
```

---

## Deployment Steps

### Step 1: Build Backend

```bash
cd backend

# Build TypeScript
npm run build

# Expected output:
# Successfully compiled TypeScript
# No errors

# Verify dist/ folder created
ls dist/
# Should contain: index.js, controllers/, services/, etc.
```

---

### Step 2: Start Backend Server

```bash
cd backend

# Development mode
npm run dev

# Or production mode
npm start

# Expected console output:
# 🚀 Server running on port 3001
# 📊 Health check: http://localhost:3001/health
# 🔒 Enhanced security features enabled
```

---

### Step 3: Verify API Endpoints

```bash
# Test health endpoint
curl http://localhost:3001/health

# Expected response:
# {"status":"OK","timestamp":"2025-01-09T...","database":"Connected"}

# Test image stats endpoint (requires admin token)
curl http://localhost:3001/api/images/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Expected response:
# {"success":true,"stats":{"books":{"total":0,"missingVariants":0},...}}
```

---

### Step 4: Test Image Upload

```bash
# Create a test image
curl -O https://picsum.photos/800/600 -o test-image.jpg

# Upload test book with cover
curl -X POST http://localhost:3001/api/books \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "title=Test Book" \
  -F "author=Test Author" \
  -F "language=english" \
  -F "cover=@test-image.jpg" \
  -F "pdf=@test-image.jpg"

# Expected response:
# {"success":true,"data":{"id":"...","cover_thumbnail":"/public/images/...-thumbnail.webp",...}}
```

---

### Step 5: Verify Generated Variants

```bash
# List generated images
ls -lh backend/public/images/*-thumbnail.webp
ls -lh backend/public/images/*-small.webp
ls -lh backend/public/images/*-medium.webp
ls -lh backend/public/images/*-large.webp

# Check file sizes (medium should be <200KB)
find backend/public/images -name "*-medium.webp" -exec ls -lh {} \;

# Verify WebP format
file backend/public/images/*-medium.webp
# Expected: WebP image data
```

---

### Step 6: Test Frontend Display

```bash
cd frontend/user-panel

# Install dependencies
npm install

# Start dev server
npm run dev

# Expected: Server running on http://localhost:5173
```

**Manual verification:**
1. Open http://localhost:5173 in browser
2. Navigate to books/audio/videos section
3. Open DevTools → Network tab
4. Refresh page
5. Check image requests:
   - Should see WebP format
   - Should see correct srcset
   - Should load appropriate variant based on screen size
   - Should have cache headers

---

### Step 7: Test Admin Panel Features

```bash
cd frontend/admin-panel

# Install dependencies
npm install

# Start dev server
npm run dev

# Expected: Server running on http://localhost:5174
```

**Manual verification:**
1. Open http://localhost:5174 and login as admin
2. Go to Books → Add Book
3. Upload a cover image
4. Click "Preview" button
   - ✓ Preview modal should show
   - ✓ Should display book card preview
   - ✓ Should show crop information
5. Click "Set Focal Point" button
   - ✓ Focal point selector should open
   - ✓ Click should set focal point
   - ✓ Preview should update
6. Submit form
   - ✓ Upload should succeed
   - ✓ All 4 variants should be generated
   - ✓ Book should appear in user panel with correct aspect ratio

---

## Post-Deployment Tasks

### Task 1: Regenerate Legacy Images

If you have existing images without variants:

```bash
# Check how many need regeneration
curl http://localhost:3001/api/images/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"

# If totalMissing > 0, regenerate all
curl -X POST http://localhost:3001/api/images/regenerate-all \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Wait for completion, then verify
curl http://localhost:3001/api/images/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Expected: totalMissing should be 0
```

---

### Task 2: Configure CDN (if using)

#### For AWS CloudFront:

```bash
# Upload images to S3
aws s3 sync backend/public/images/ s3://your-bucket/images/

# Create CloudFront distribution (if not exists)
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/images/*"
```

#### For Cloudflare:

```bash
# Update image URLs in code to use CDN
# https://cdn.yourdomain.com/images/...

# Purge cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}'
```

---

### Task 3: Performance Monitoring

Set up monitoring for:

1. **Image Processing Time:**
   ```javascript
   // Already logged in ImageProcessingService
   // Check logs for: "Image processed in Xms"
   // Alert if > 10 seconds
   ```

2. **File Sizes:**
   ```bash
   # Weekly cron job
   0 0 * * 0 /path/to/check-image-sizes.sh
   ```

3. **Cache Hit Rate:**
   - Monitor CDN analytics
   - Target: >95% cache hit rate

4. **Disk Space:**
   ```bash
   # Check images directory size
   du -sh backend/public/images/
   # Alert if > 10GB
   ```

---

## Rollback Plan

If issues occur after deployment:

### Rollback Step 1: Disable Image Processing

```typescript
// In ImageProcessingService.ts
async processUploadedImage(...) {
  // TEMPORARY: Skip processing
  return {
    thumbnail: '',
    small: '',
    medium: '',
    large: '',
    original: inputPath
  };
}
```

### Rollback Step 2: Use Original Images

```typescript
// In MediaShelf.tsx
const src = item.cover_medium || item.cover_image_url; // Fallback to original
```

### Rollback Step 3: Database Revert

```sql
-- If needed, remove responsive columns
ALTER TABLE books DROP COLUMN IF EXISTS cover_thumbnail;
ALTER TABLE books DROP COLUMN IF EXISTS cover_small;
ALTER TABLE books DROP COLUMN IF EXISTS cover_medium;
ALTER TABLE books DROP COLUMN IF EXISTS cover_large;

-- Repeat for audio_books and videos
```

---

## Troubleshooting Guide

### Issue: Tests Failing

**Symptom:** Jest tests fail with Sharp errors

**Solution:**
```bash
# Reinstall Sharp with correct binaries
cd backend
npm uninstall sharp
npm install sharp --platform=darwin --arch=arm64  # For Mac M1/M2
# or
npm install sharp --platform=linux --arch=x64     # For Linux

# Clear Jest cache
npx jest --clearCache

# Run tests again
npm test
```

---

### Issue: Images Not Processing

**Symptom:** Upload succeeds but no variants created

**Check:**
```bash
# 1. Check backend logs
tail -f backend/logs/server.log

# 2. Check Sharp installation
node -e "const sharp = require('sharp'); console.log(sharp.versions)"

# 3. Check file permissions
ls -la backend/public/images/

# 4. Test Sharp manually
node -e "
const sharp = require('sharp');
sharp('test.jpg')
  .resize(300, 400)
  .toFile('test-output.webp')
  .then(info => console.log('Success:', info))
  .catch(err => console.error('Error:', err));
"
```

---

### Issue: Preview Not Showing

**Symptom:** Preview button doesn't open modal

**Check:**
```javascript
// 1. Verify import
import ImagePreview from '../components/ImagePreview';

// 2. Check state
console.log('Show preview:', showImagePreview);
console.log('Preview URL:', coverPreviewUrl);

// 3. Verify modal is rendered
{showImagePreview && <ImagePreview ... />}

// 4. Check z-index (should be z-50 or higher)
```

---

### Issue: Wrong Aspect Ratio

**Symptom:** Images appear stretched

**Fix:**
```typescript
// User panel - verify aspectRatio prop
<LazyImage
  aspectRatio="3/4"  // Not "3:4"
  // ✓ Correct: "3/4", "1/1", "16/9"
  // ✗ Wrong: "3:4", "1:1", "16:9"
/>

// Backend - verify aspectRatio option
aspectRatio: '3:4'  // Not "3/4"
// ✓ Correct: '3:4', '1:1', '16:9'
// ✗ Wrong: '3/4', '1/1', '16/9'
```

---

## Success Criteria

Deployment is successful when:

- [x] All tests passing (unit + integration)
- [x] Backend server running without errors
- [x] Health endpoint returns "OK"
- [x] Image stats endpoint accessible
- [x] Test upload generates 4 variants
- [x] Medium variant is <200KB
- [x] User panel displays images correctly
- [x] Admin preview modal works
- [x] Focal point selector works
- [x] Images use WebP format
- [x] Cache headers present (max-age=31536000)
- [x] Srcset and sizes attributes correct
- [x] No console errors in browser
- [x] No 404s for image requests

---

## Monitoring Dashboard

Set up a simple dashboard to monitor:

```bash
# Quick status check script
#!/bin/bash

echo "=== OGON Image System Status ==="

# 1. Check backend health
echo "Backend health:"
curl -s http://localhost:3001/health | jq

# 2. Check image stats
echo -e "\nImage stats:"
curl -s http://localhost:3001/api/images/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

# 3. Check recent uploads
echo -e "\nRecent images (last 5):"
ls -lt backend/public/images/*.webp | head -5

# 4. Check file sizes
echo -e "\nMedium variants >200KB:"
find backend/public/images -name "*-medium.webp" -size +200k -exec ls -lh {} \;

# 5. Check disk usage
echo -e "\nDisk usage:"
du -sh backend/public/images/

echo -e "\n=== Status check complete ==="
```

Save as `check-image-system.sh` and run daily.

---

## Support Contacts

- **Documentation:** See `IMAGE_OPERATIONS_README.md`
- **Quick Start:** See `QUICK_START_GUIDE.md`
- **Integration:** See `ADMIN_PANEL_INTEGRATION_EXAMPLE.tsx`
- **Issues:** Check backend logs and GitHub issues

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Environment:** □ Development  □ Staging  □ Production
**Status:** □ Success  □ Partial  □ Rollback

**Notes:**
____________________________________________________________
____________________________________________________________
____________________________________________________________
