import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import bookRoutes from './routes/books';
import videoRoutes from './routes/videos';
import audioBookRoutes from './routes/audioBooks';
import securityRoutes from './routes/security';
import favoritesRoutes from './routes/favorites';
import dashboardRoutes from './routes/dashboard';
import debugRoutes from './routes/debug';
import latestContentRoutes from './routes/latest-content';
// import videoStreamRoutes from './routes/video-stream'; // Temporarily disabled - focus on video upload testing

// Import database connection
import pool from './config/database';
import { generalRateLimit, securityLogger, sanitizeInputs } from './middleware/validation';
import { secureHeaders, suspiciousActivityDetection } from './middleware/security';
import { SecurityService } from './services/security';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware - order matters
app.set('trust proxy', 1); // Trust first proxy for IP detection

// Enhanced security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      frameSrc: ["'self'", "http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://localhost:3002", "https://www.youtube.com", "https://youtube.com"]
    }
  },
  xFrameOptions: false // Disable global X-Frame-Options, handle per route
}));

app.use(secureHeaders);

// CORS configuration with enhanced security
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? ['https://your-domain.com']
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003'];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
}));

// Global security middleware (temporarily disabled)
// app.use(generalRateLimit);
// app.use(securityLogger);
// app.use(sanitizeInputs);
// app.use(suspiciousActivityDetection);

// Compression middleware
app.use(compression());

// Body parsing middleware with security limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Additional JSON validation can go here
    if (buf.length === 0) {
      throw new Error('Empty JSON body');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced logging middleware
app.use(morgan('combined', {
  skip: (req) => req.url.startsWith('/health') // Skip health check logs
}));

// Serve static files (uploaded audio files)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve audio files with proper headers
app.use('/public/audio', (req, res, next) => {
  // Allow embedding from frontend development ports and production
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175'
  ];

  const origin = req.get('Referer') || req.get('Origin');
  const isAllowedOrigin = origin && allowedOrigins.some(allowed => origin.startsWith(allowed));

  if (isAllowedOrigin) {
    // Set permissive headers for audio streaming but prevent downloads
    res.removeHeader('X-Frame-Options');
    res.setHeader('X-Frame-Options', 'ALLOW-FROM ' + origin);
    res.setHeader('Content-Security-Policy', 'frame-ancestors *; object-src none;');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');

    // Anti-download headers for audio
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  next();
}, express.static(path.join(__dirname, '../public/audio')));

// Serve video files with proper headers for streaming
app.use('/public/videos', (req, res, next) => {
  // Allow embedding from frontend development ports and production
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175'
  ];

  const origin = req.get('Referer') || req.get('Origin');
  const isAllowedOrigin = origin && allowedOrigins.some(allowed => origin.startsWith(allowed));

  if (isAllowedOrigin) {
    // Set permissive headers for video streaming
    res.removeHeader('X-Frame-Options');
    res.setHeader('X-Frame-Options', 'ALLOW-FROM ' + origin);
    res.setHeader('Content-Security-Policy', 'frame-ancestors *; object-src none;');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');

    // Video streaming headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Enable range requests for video streaming
    if (req.headers.range) {
      const videoPath = path.join(__dirname, '../public/videos', req.path);
      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };

      res.writeHead(206, head);
      file.pipe(res);
      return;
    }
  } else {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  next();
}, express.static(path.join(__dirname, '../public/videos')));

// Serve public static files (PDFs, images, etc.) with iframe-friendly headers
app.use('/public', (req, res, next) => {
  // Allow embedding from frontend development ports and production
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175'
  ];

  const origin = req.get('Referer') || req.get('Origin');
  const isAllowedOrigin = origin && allowedOrigins.some(allowed => origin.startsWith(allowed));

  if (isAllowedOrigin) {
    // Remove X-Frame-Options and set ALLOW-FROM to allow embedding from allowed origins
    res.removeHeader('X-Frame-Options');
    res.setHeader('X-Frame-Options', 'ALLOW-FROM ' + origin);
    // Set additional permissive headers for PDF viewing but prevent downloads
    res.setHeader('Content-Security-Policy', 'frame-ancestors *; object-src none;');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Anti-download headers for PDFs and other media
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  next();
}, express.static(path.join(__dirname, '../public')));

// Serve books directly from /books/ path (alias for /public/books/)
app.use('/books', (req, res, next) => {
  // Allow embedding from frontend development ports and production
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175'
  ];

  const origin = req.get('Referer') || req.get('Origin');
  const isAllowedOrigin = origin && allowedOrigins.some(allowed => origin.startsWith(allowed));

  if (isAllowedOrigin) {
    // Remove X-Frame-Options and set ALLOW-FROM to allow embedding from allowed origins
    res.removeHeader('X-Frame-Options');
    res.setHeader('X-Frame-Options', 'ALLOW-FROM ' + origin);
    // Set additional permissive headers for PDF viewing but prevent downloads
    res.setHeader('Content-Security-Policy', 'frame-ancestors *; object-src none;');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Anti-download headers for books
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }

  next();
}, express.static(path.join(__dirname, '../public/books')));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      database: 'Connected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      timestamp: new Date().toISOString(),
      database: 'Disconnected'
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/audio-books', audioBookRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/latest-content', latestContentRoutes);
app.use('/api/debug', debugRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error:', error);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
  console.log(`🔒 Enhanced security features enabled`);
  
  // Start security cleanup tasks
  setInterval(async () => {
    try {
      await SecurityService.cleanupExpiredSessions();
      console.log('🧹 Expired sessions cleaned up');
    } catch (error) {
      console.error('Session cleanup failed:', error);
    }
  }, 60 * 60 * 1000); // Run every hour
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

export default app;