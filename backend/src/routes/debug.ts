import express from 'express';
import { DebugController } from '../controllers/debugController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// GET /api/debug/columns - Check what columns exist in tables
router.get('/columns', DebugController.checkTableColumns);

// GET /api/debug/simple-query - Test simple query
router.get('/simple-query', DebugController.testSimpleQuery);

export default router;