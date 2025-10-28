import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload directories exist
const uploadDirs = {
  pdfs: path.join(__dirname, '../../public/pdfs'),
  books: path.join(__dirname, '../../public/books'),
  images: path.join(__dirname, '../../public/images'),
  audio: path.join(__dirname, '../../public/audio'),
  videos: path.join(__dirname, '../../public/videos')
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage for different file types
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'pdfFile') {
      cb(null, uploadDirs.pdfs);
    } else if (file.fieldname === 'bookFile') {
      cb(null, uploadDirs.books);
    } else if (file.fieldname === 'coverFile') {
      cb(null, uploadDirs.images);
    } else if (file.fieldname === 'audioFile') {
      cb(null, uploadDirs.audio);
    } else if (file.fieldname === 'videoFile') {
      cb(null, uploadDirs.videos);
    } else if (file.fieldname === 'thumbnailFile') {
      cb(null, uploadDirs.images);
    } else {
      cb(new Error('Invalid file field'), '');
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = file.originalname.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '-');
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter for validation
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.fieldname === 'pdfFile') {
    // Check MIME type and file extension
    const isValidPdf = file.mimetype === 'application/pdf' &&
                      file.originalname.toLowerCase().endsWith('.pdf');

    if (isValidPdf) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files (.pdf) are allowed for book content'));
    }
  } else if (file.fieldname === 'bookFile') {
    // Allow multiple book formats - using Map to avoid TypeScript indexing issues
    const allowedBookTypes = new Map<string, string>([
      ['pdf', 'application/pdf'],
      ['epub', 'application/epub+zip'],
      ['txt', 'text/plain'],
      ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['mobi', 'application/x-mobipocket-ebook'],
      ['azw', 'application/vnd.amazon.ebook'],
      ['azw3', 'application/vnd.amazon.ebook'],
      ['djvu', 'image/vnd.djvu'],
      ['fb2', 'application/xml'],
      ['rtf', 'application/rtf'],
      ['html', 'text/html'],
      ['odt', 'application/vnd.oasis.opendocument.text']
    ]);

    const fileExtension = file.originalname.toLowerCase().split('.').pop();

    // Check if file extension exists and is in allowed types
    const isValidExtension = fileExtension && allowedBookTypes.has(fileExtension);

    // Get the expected MIME type for the extension
    const expectedMimeType = isValidExtension ? (allowedBookTypes.get(fileExtension!) as string) : null;

    // Special handling for text files which can have various MIME types
    const isTextFile = fileExtension === 'txt' && file.mimetype.startsWith('text/');

    const isValidBookFile = isValidExtension && (
      file.mimetype === expectedMimeType || isTextFile
    );

    if (isValidBookFile) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid book file format. Allowed formats: ${Array.from(allowedBookTypes.keys()).join(', ')}`));
    }
  } else if (file.fieldname === 'coverFile') {
    // Allow common image formats
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedImageTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed for book covers'));
    }
  } else if (file.fieldname === 'audioFile') {
    // Allow common audio formats
    const allowedAudioTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
      'audio/ogg', 'audio/vorbis', 'audio/x-m4a', 'audio/mp4',
      'audio/aac', 'audio/flac', 'audio/x-flac'
    ];
    const allowedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
    const fileExtension = path.extname(file.originalname).toLowerCase();


    // Allow the file if both MIME type and extension are valid, or if extension is valid and MIME type is generic/octet-stream
    const isValidMimeType = allowedAudioTypes.includes(file.mimetype);
    const isGenericMimeType = file.mimetype === 'application/octet-stream';
    const isValidExtension = allowedExtensions.includes(fileExtension);

    if ((isValidMimeType || isGenericMimeType) && isValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3, WAV, OGG, M4A, AAC, and FLAC audio files are allowed'));
    }
  } else if (file.fieldname === 'videoFile') {
    // Allow common video formats
    const allowedVideoTypes = [
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo',
      'video/webm', 'video/x-matroska', 'video/x-ms-wmv'
    ];
    const allowedExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.mkv', '.mpeg', '.mpg'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    // Allow the file if both MIME type and extension are valid, or if extension is valid and MIME type is generic/octet-stream
    const isValidMimeType = allowedVideoTypes.includes(file.mimetype);
    const isGenericMimeType = file.mimetype === 'application/octet-stream';
    const isValidExtension = allowedExtensions.includes(fileExtension);

    if ((isValidMimeType || isGenericMimeType) && isValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Only MP4, AVI, MOV, WMV, WebM, MKV, MPEG, and MPG video files are allowed'));
    }
  } else if (file.fieldname === 'thumbnailFile') {
    // Allow common image formats for video thumbnails
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedImageTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed for video thumbnails'));
    }
  } else {
    cb(new Error('Invalid file field'));
  }
};

// Configure multer
export const uploadBooks = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for book files
    files: 3 // Maximum 3 files (book file + cover image + audio file)
  }
}).fields([
  { name: 'bookFile', maxCount: 1 },
  { name: 'pdfFile', maxCount: 1 },
  { name: 'coverFile', maxCount: 1 },
  { name: 'audioFile', maxCount: 1 }
]);

// Error handling middleware
export const handleUploadError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum size is 100MB.',
        code: 'FILE_TOO_LARGE',
        maxSize: '100MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Maximum is 3 files (book file + cover image + audio file).',
        code: 'TOO_MANY_FILES',
        maxFiles: 3
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field. Only bookFile, pdfFile, coverFile, audioFile, and thumbnailFile are allowed.',
        code: 'UNEXPECTED_FILE_FIELD',
        allowedFields: ['bookFile', 'pdfFile', 'coverFile', 'audioFile', 'thumbnailFile']
      });
    }
    return res.status(400).json({
      error: `Upload error: ${error.message}`,
      code: 'UPLOAD_ERROR'
    });
  }

  if (error.message.includes('Only PDF files') ||
      error.message.includes('Only JPEG, PNG, and WebP') ||
      error.message.includes('Invalid file field')) {
    return res.status(400).json({
      error: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }

  next(error);
};

// Generic upload middleware for videos and other content
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for video files
    files: 5 // Maximum 5 files
  }
});

// File validation helper
export const validateUploadedFiles = (req: any, res: any, next: any) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  // Check if at least a book file is provided for new books
  if (!req.params.id && (!files?.bookFile || files.bookFile.length === 0) && (!files?.pdfFile || files.pdfFile.length === 0)) {
    if (!req.body.file_url && !req.body.pdf_url) {
      return res.status(400).json({
        error: 'Book file (PDF, EPUB, TXT, etc.) or file URL is required for new books.',
        code: 'MISSING_BOOK_FILE'
      });
    }
  }

  // For audio books, check if audio file is provided
  if (req.originalUrl?.includes('audio-books') && !req.params.id && (!files?.audioFile || files.audioFile.length === 0)) {
    return res.status(400).json({
      error: 'Audio file is required for new audio books.',
      code: 'MISSING_AUDIO_FILE'
    });
  }

  // Validate file integrity if files are provided
  if (files?.bookFile) {
    const bookFile = files.bookFile[0];
    if (bookFile.size === 0) {
      return res.status(400).json({
        error: 'Book file is empty or corrupted.',
        code: 'EMPTY_BOOK_FILE'
      });
    }
  }

  if (files?.pdfFile) {
    const pdfFile = files.pdfFile[0];
    if (pdfFile.size === 0) {
      return res.status(400).json({
        error: 'PDF file is empty or corrupted.',
        code: 'EMPTY_PDF_FILE'
      });
    }
  }

  if (files?.coverFile) {
    const coverFile = files.coverFile[0];
    if (coverFile.size === 0) {
      return res.status(400).json({
        error: 'Cover image file is empty or corrupted.',
        code: 'EMPTY_COVER_FILE'
      });
    }
  }

  if (files?.audioFile) {
    const audioFile = files.audioFile[0];
    if (audioFile.size === 0) {
      return res.status(400).json({
        error: 'Audio file is empty or corrupted.',
        code: 'EMPTY_AUDIO_FILE'
      });
    }
  }

  if (files?.videoFile) {
    const videoFile = files.videoFile[0];
    if (videoFile.size === 0) {
      return res.status(400).json({
        error: 'Video file is empty or corrupted.',
        code: 'EMPTY_VIDEO_FILE'
      });
    }
  }

  if (files?.thumbnailFile) {
    const thumbnailFile = files.thumbnailFile[0];
    if (thumbnailFile.size === 0) {
      return res.status(400).json({
        error: 'Thumbnail image file is empty or corrupted.',
        code: 'EMPTY_THUMBNAIL_FILE'
      });
    }
  }

  next();
};