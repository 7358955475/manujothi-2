import { Router } from 'express';
import {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook
} from '../controllers/bookController';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  validateBook,
  validateUUID,
  validatePagination,
  validateLanguageFilter
} from '../middleware/validation';
import { logContentAccess, sanitizeFileInput } from '../middleware/security';
import { uploadBooks, handleUploadError, validateUploadedFiles } from '../middleware/upload';

const router = Router();

// Public routes with content access logging
router.get('/', validatePagination, validateLanguageFilter, getAllBooks);
router.get('/:id', validateUUID, logContentAccess('book'), getBookById);

// Admin only routes with enhanced security and file upload
router.post('/', authenticate, requireAdmin, uploadBooks, handleUploadError, validateUploadedFiles, sanitizeFileInput, validateBook, createBook);
router.put('/:id', authenticate, requireAdmin, validateUUID, uploadBooks, handleUploadError, validateUploadedFiles, sanitizeFileInput, updateBook);
router.delete('/:id', authenticate, requireAdmin, validateUUID, deleteBook);

export default router;