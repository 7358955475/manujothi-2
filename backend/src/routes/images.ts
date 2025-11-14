import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  regenerateImageVariants,
  regenerateAllMissingVariants,
  getImageStats
} from '../controllers/imageController';

const router = Router();

/**
 * Image management routes
 * All routes require admin authentication
 */

// Get statistics about images (missing variants, file sizes, etc.)
router.get('/stats', authenticate, requireAdmin, getImageStats);

// Regenerate variants for a specific media item
router.post('/regenerate', authenticate, requireAdmin, regenerateImageVariants);

// Batch regenerate all missing variants (backwards compatibility)
router.post('/regenerate-all', authenticate, requireAdmin, regenerateAllMissingVariants);

export default router;
