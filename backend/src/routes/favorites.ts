import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { FavoritesController } from '../controllers/favoritesController';
import { authenticate } from '../middleware/auth';
import { body, param, validationResult } from 'express-validator';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/favorites - Get all favorites for the authenticated user
router.get('/', FavoritesController.getUserFavorites);

// GET /api/favorites/count - Get favorites count for the authenticated user
router.get('/count', FavoritesController.getFavoritesCount);

// POST /api/favorites - Add a new favorite
router.post('/', [
  body('media_type')
    .isIn(['book', 'audio', 'video'])
    .withMessage('Media type must be book, audio, or video'),
  body('media_id')
    .isUUID()
    .withMessage('Media ID must be a valid UUID')
], handleValidationErrors, FavoritesController.addFavorite);

// POST /api/favorites/toggle - Toggle favorite status
router.post('/toggle', [
  body('media_type')
    .isIn(['book', 'audio', 'video'])
    .withMessage('Media type must be book, audio, or video'),
  body('media_id')
    .isUUID()
    .withMessage('Media ID must be a valid UUID')
], handleValidationErrors, FavoritesController.toggleFavorite);

// GET /api/favorites/check/:media_type/:media_id - Check if an item is favorited
router.get('/check/:media_type/:media_id', [
  param('media_type')
    .isIn(['book', 'audio', 'video'])
    .withMessage('Media type must be book, audio, or video'),
  param('media_id')
    .isUUID()
    .withMessage('Media ID must be a valid UUID')
], handleValidationErrors, FavoritesController.checkFavorite);

// DELETE /api/favorites/:media_type/:media_id - Remove a favorite
router.delete('/:media_type/:media_id', [
  param('media_type')
    .isIn(['book', 'audio', 'video'])
    .withMessage('Media type must be book, audio, or video'),
  param('media_id')
    .isUUID()
    .withMessage('Media ID must be a valid UUID')
], handleValidationErrors, FavoritesController.removeFavorite);

export default router;