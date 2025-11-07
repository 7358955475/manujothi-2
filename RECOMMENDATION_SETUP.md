# Smart Recommendation Engine - Quick Setup Guide

## 1. Database Setup

```bash
cd backend
psql -h localhost -U harikrishna -d ogon_db -f migrations/007_create_recommendation_tables.sql
```

**What it does:**
- Creates 6 tables for recommendations
- Adds indexes for fast queries
- Creates helper functions for similarity calculations

## 2. Install Dependencies

```bash
npm install natural @types/natural
```

## 3. Initialize Recommendation Engine

```bash
npm run recommendations:init
```

**This will:**
- ✅ Build TF-IDF vectors for all media (~2-5 min for 1000 items)
- ✅ Precompute top-20 similar items for each media
- ✅ Clean up expired cache entries
- ✅ Show statistics

**Output:**
```
🚀 Initializing Recommendation Engine...

📊 Step 1: Building TF-IDF vectors for all media...
📚 Fetched 243 media items
✅ Processed 50/243 vectors
✅ Processed 100/243 vectors
...
✅ TF-IDF vectorization complete: 243 processed, 0 errors

💾 Step 2: Precomputing similar items cache...
✅ Processed 10/243 items
...
✅ Cache built: 243 items processed, 0 errors

🧹 Step 3: Cleaning up expired cache entries...
✅ Cleaned up 0 expired cache entries

📈 Statistics:
   • Total media vectors: 243
   • Total similar items cached: 4860
   • Total user interactions: 0
   • Total user profiles: 0
   • Active cache entries: 0

✅ Initialization complete in 45.23s
```

## 4. Test the APIs

### Content-Based Recommendations
```bash
curl "http://localhost:3001/api/recommendations/content-based?media_id=<BOOK_ID>&media_type=book&limit=5"
```

### Personalized Recommendations (requires auth)
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3001/api/recommendations/personalized?limit=10"
```

### Hybrid Recommendations
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://localhost:3001/api/recommendations/hybrid?limit=10"
```

## 5. Frontend Integration

```typescript
// In your React component
import { RecommendationsPanel } from '@/components/RecommendationsPanel';
import { recommendationsApi } from '@/api/recommendationsApi';

// Set token after login
recommendationsApi.setToken(authToken);

// Display recommendations
<RecommendationsPanel
  type="personalized"
  limit={10}
  title="Recommended For You"
  onMediaClick={(rec) => {
    navigate(`/${rec.media_type}/${rec.media_id}`);
  }}
/>
```

## 6. Track Interactions

```typescript
// When user views content
await recommendationsApi.trackInteraction({
  media_id: bookId,
  media_type: 'book',
  interaction_type: 'view',
  duration_seconds: 120
});

// When user likes content
await recommendationsApi.trackInteraction({
  media_id: bookId,
  media_type: 'book',
  interaction_type: 'like'
});
```

## 7. Run Tests

```bash
npm run test:recommendations
```

## 8. Schedule Nightly Updates

Add to crontab:
```bash
crontab -e

# Add this line:
0 2 * * * cd /path/to/backend && npm run recommendations:init >> logs/recommendations.log 2>&1
```

**Why nightly?**
- Rebuilds vectors for new media
- Updates similar items cache
- Refreshes user preference profiles

## Maintenance Commands

```bash
# Full initialization (vectors + cache)
npm run recommendations:init

# Only rebuild vectors (faster)
npm run recommendations:vectors

# Only update cache (fastest)
npm run recommendations:cache

# Run recommendation tests
npm run test:recommendations
```

## Monitoring

### Check recommendation metrics
```bash
curl -H "Authorization: Bearer <ADMIN_TOKEN>" \
  "http://localhost:3001/api/recommendations/metrics?days=7"
```

### Database queries
```sql
-- Check vector count
SELECT media_type, COUNT(*) FROM media_vectors GROUP BY media_type;

-- Check interaction count
SELECT COUNT(*) FROM user_interactions;

-- Check cache status
SELECT recommendation_type, COUNT(*),
       COUNT(*) FILTER (WHERE expires_at > CURRENT_TIMESTAMP) as active
FROM recommendation_cache
GROUP BY recommendation_type;

-- Top recommended items
SELECT media_type, media_id, COUNT(*) as times_recommended
FROM recommendation_metrics
WHERE shown_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY media_type, media_id
ORDER BY times_recommended DESC
LIMIT 10;
```

## Performance Expectations

| Operation | Expected Time |
|-----------|--------------|
| Build vectors (1000 items) | 3-5 seconds |
| Precompute cache | 1-2 minutes |
| Content-based API (cached) | < 500ms |
| Content-based API (fresh) | < 2s |
| Personalized API (cached) | < 500ms |
| Personalized API (fresh) | < 3s |

## Troubleshooting

### Issue: "No vectors found"
```bash
# Rebuild vectors
npm run recommendations:vectors
```

### Issue: "Slow recommendations"
```sql
-- Check if indexes exist
\d+ media_vectors
\d+ similar_items_cache

-- If missing, re-run migration
```

### Issue: "Poor recommendation quality"
- Wait for more user interactions (need > 50 interactions for good CF)
- Adjust similarity thresholds in ContentBasedService
- Check that interactions are being tracked

## Next Steps

1. ✅ Set up recommendation engine (you are here)
2. 📊 Monitor metrics after 1 week
3. 🎯 Tune parameters based on CTR
4. 🔄 Set up nightly automation
5. 🚀 Launch to production

## Resources

- 📖 Full documentation: `RECOMMENDATION_ENGINE.md`
- 🧪 Test suite: `tests/api/recommendations.test.ts`
- 🎨 Frontend components: `frontend/user-panel/src/components/RecommendationsPanel.tsx`
- 🔧 Backend services: `backend/src/services/recommendation/`

---

**Setup Complete! 🎉**

Your recommendation engine is now ready to deliver personalized content suggestions to your users.
