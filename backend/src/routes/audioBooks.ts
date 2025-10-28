import { Router } from 'express';
import {
  getAllAudioBooks,
  getAudioBookById,
  createAudioBook,
  updateAudioBook,
  deleteAudioBook,
  streamAudio
} from '../controllers/audioBookController';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  validateAudioBook,
  validateUUID,
  validatePagination,
  validateLanguageFilter
} from '../middleware/validation';
import { uploadBooks, handleUploadError } from '../middleware/upload';
import { logContentAccess, sanitizeFileInput } from '../middleware/security';

const router = Router();

// Public routes with content access logging
router.get('/', validatePagination, validateLanguageFilter, getAllAudioBooks);
router.get('/:id', validateUUID, logContentAccess('audio'), getAudioBookById);
router.get('/:id/stream', authenticate, validateUUID, logContentAccess('audio'), streamAudio);

// Admin only routes with enhanced security
router.post('/', authenticate, requireAdmin, uploadBooks, handleUploadError, sanitizeFileInput, validateAudioBook, createAudioBook);
router.put('/:id', authenticate, requireAdmin, validateUUID, uploadBooks, handleUploadError, sanitizeFileInput, validateAudioBook, updateAudioBook);
router.delete('/:id', authenticate, requireAdmin, validateUUID, deleteAudioBook);

export default router;