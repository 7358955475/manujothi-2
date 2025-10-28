import { Router } from 'express';
import { login, register } from '../controllers/authController';
import { validateLogin, validateRegister, authRateLimit, securityLogger, sanitizeInputs } from '../middleware/validation';
import { ipAccessControl, suspiciousActivityDetection, secureHeaders } from '../middleware/security';

const router = Router();

// Apply security middleware to all auth routes (temporarily disabled for troubleshooting)
// router.use(secureHeaders);
// router.use(ipAccessControl);
// router.use(authRateLimit);
// router.use(securityLogger);
// router.use(sanitizeInputs);
// router.use(suspiciousActivityDetection);

router.post('/login', validateLogin, login);
router.post('/register', validateRegister, register);

export default router;