import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getCurrentUser
} from '../controllers/userController';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  validateUserUpdate,
  validateRegister,
  validateUUID,
  validatePagination
} from '../middleware/validation';

const router = Router();

// Public route for current user
router.get('/me', authenticate, getCurrentUser);

// Admin only routes
router.get('/', authenticate, requireAdmin, validatePagination, getAllUsers);
router.get('/:id', authenticate, requireAdmin, validateUUID, getUserById);
router.post('/', authenticate, requireAdmin, validateRegister, createUser);
router.put('/:id', authenticate, requireAdmin, validateUUID, validateUserUpdate, updateUser);
router.delete('/:id', authenticate, requireAdmin, validateUUID, deleteUser);

export default router;