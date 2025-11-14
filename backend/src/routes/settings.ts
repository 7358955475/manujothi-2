import { Router } from 'express';
import {
  getUserSettings,
  updateUserProfile,
  updateUserPreferences,
  changePassword,
  deleteUserAccount,
  getUserActivityStats
} from '../controllers/settingsController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * Settings Routes
 * All routes require authentication
 * All data is fetched dynamically from the database
 */

// GET /api/settings - Get all user settings
router.get('/', authenticate, getUserSettings);

// PUT /api/settings/profile - Update user profile
router.put('/profile', authenticate, updateUserProfile);

// PUT /api/settings/preferences - Update user preferences
router.put('/preferences', authenticate, updateUserPreferences);

// POST /api/settings/change-password - Change user password
router.post('/change-password', authenticate, changePassword);

// DELETE /api/settings/account - Delete user account
router.delete('/account', authenticate, deleteUserAccount);

// GET /api/settings/activity - Get user activity statistics
router.get('/activity', authenticate, getUserActivityStats);

export default router;
