import { Router } from 'express';
import {
  getAllVideos,
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo
} from '../controllers/videoController';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  validateVideo,
  validateUUID,
  validatePagination,
  validateLanguageFilter
} from '../middleware/validation';
import { logContentAccess, sanitizeFileInput } from '../middleware/security';
import { upload } from '../middleware/upload';

const router = Router();

// Public routes with content access logging
router.get('/', validatePagination, validateLanguageFilter, getAllVideos);
router.get('/:id', validateUUID, logContentAccess('video'), getVideoById);

// Admin only routes with enhanced security
router.get('/admin/all', authenticate, requireAdmin, validatePagination, validateLanguageFilter, getAllVideos);
router.post('/', authenticate, requireAdmin, upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'thumbnailFile', maxCount: 1 }]), sanitizeFileInput, validateVideo, createVideo);
router.put('/:id', authenticate, requireAdmin, upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'thumbnailFile', maxCount: 1 }]), validateUUID, sanitizeFileInput, updateVideo);
router.delete('/:id', authenticate, requireAdmin, validateUUID, deleteVideo);

export default router;