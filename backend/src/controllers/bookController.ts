import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import { NotificationsController } from './notificationsController';
import { imageProcessingService } from '../services/ImageProcessingService';

export const getAllBooks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const language = req.query.language as string;
    const genre = req.query.genre as string;
    const search = req.query.search as string;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM books WHERE is_active = true';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (language) {
      query += ` AND language = $${paramIndex}`;
      queryParams.push(language);
      paramIndex++;
    }

    if (genre) {
      query += ` AND genre ILIKE $${paramIndex}`;
      queryParams.push(`%${genre}%`);
      paramIndex++;
    }

    if (search) {
      query += ` AND (title ILIKE $${paramIndex} OR author ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM books WHERE is_active = true';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (language) {
      countQuery += ` AND language = $${countParamIndex}`;
      countParams.push(language);
      countParamIndex++;
    }

    if (genre) {
      countQuery += ` AND genre ILIKE $${countParamIndex}`;
      countParams.push(`%${genre}%`);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND (title ILIKE $${countParamIndex} OR author ILIKE $${countParamIndex} OR description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      books: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBookById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM books WHERE id = $1 AND is_active = true',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get book error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      author,
      description,
      cover_image_url,
      pdf_url,
      file_url,
      file_format,
      file_size,
      mime_type,
      language,
      genre,
      published_year
    } = req.body;

    // Handle uploaded files - PRIORITIZE uploaded files over URL text inputs
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let finalPdfUrl = null;
    let finalFileUrl = null;
    let finalCoverUrl = null;
    let finalFileFormat = file_format || 'pdf';
    let finalFileSize = file_size;
    let finalMimeType = mime_type;

    // Set PDF URL from uploaded file if available (HIGHEST PRIORITY)
    if (files && files.pdfFile && files.pdfFile[0]) {
      finalPdfUrl = `/public/pdfs/${files.pdfFile[0].filename}`;
      finalFileUrl = finalPdfUrl;
      finalFileSize = files.pdfFile[0].size;
      finalMimeType = files.pdfFile[0].mimetype;
    } else {
      // Only use URL from text input if NO file was uploaded
      finalPdfUrl = pdf_url;
      finalFileUrl = file_url || pdf_url;
    }

    // Handle other book file formats (HIGHEST PRIORITY)
    if (files && files.bookFile && files.bookFile[0]) {
      const uploadedFile = files.bookFile[0];
      finalFileUrl = `/public/books/${uploadedFile.filename}`;
      finalFileSize = uploadedFile.size;
      finalMimeType = uploadedFile.mimetype;

      // Determine file format from extension
      const fileExtension = uploadedFile.originalname.split('.').pop()?.toLowerCase();
      const validFormats = ['pdf', 'epub', 'txt', 'docx', 'mobi', 'azw', 'azw3', 'djvu', 'fb2', 'rtf', 'html', 'odt'];
      if (fileExtension && validFormats.includes(fileExtension)) {
        finalFileFormat = fileExtension;
      }
    }

    // Set cover image URL from uploaded file if available (HIGHEST PRIORITY)
    let coverThumbnail = null;
    let coverSmall = null;
    let coverMedium = null;
    let coverLarge = null;

    if (files && files.coverFile && files.coverFile[0]) {
      const uploadedCoverPath = files.coverFile[0].path;
      finalCoverUrl = `/public/images/${files.coverFile[0].filename}`;

      try {
        // Process the uploaded image to generate multiple sizes
        const processedImages = await imageProcessingService.processUploadedImage(
          uploadedCoverPath,
          {
            aspectRatio: '3:4', // Books use 3:4 aspect ratio
            quality: 85,
            format: 'webp',
            outputDir: path.join(process.cwd(), 'public', 'images')
          }
        );

        // Convert absolute paths to relative URLs for database storage
        const publicDir = path.join(process.cwd(), 'public');
        coverThumbnail = imageProcessingService.convertToRelativePath(processedImages.thumbnail, publicDir);
        coverSmall = imageProcessingService.convertToRelativePath(processedImages.small, publicDir);
        coverMedium = imageProcessingService.convertToRelativePath(processedImages.medium, publicDir);
        coverLarge = imageProcessingService.convertToRelativePath(processedImages.large, publicDir);

        console.log('✅ Cover image processed successfully:', {
          original: finalCoverUrl,
          thumbnail: coverThumbnail,
          small: coverSmall,
          medium: coverMedium,
          large: coverLarge
        });
      } catch (error) {
        console.error('❌ Error processing cover image:', error);
        // Continue without processed images if processing fails
      }
    } else if (cover_image_url) {
      // Only use URL from text input if NO file was uploaded
      finalCoverUrl = cover_image_url;
    }

    // Set default MIME type if not provided
    if (!finalMimeType && finalFileFormat) {
      const mimeTypes: { [key: string]: string } = {
        'pdf': 'application/pdf',
        'epub': 'application/epub+zip',
        'txt': 'text/plain',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'mobi': 'application/x-mobipocket-ebook',
        'azw': 'application/vnd.amazon.ebook',
        'azw3': 'application/vnd.amazon.ebook',
        'djvu': 'image/vnd.djvu',
        'fb2': 'application/xml',
        'rtf': 'application/rtf',
        'html': 'text/html',
        'odt': 'application/vnd.oasis.opendocument.text'
      };
      finalMimeType = mimeTypes[finalFileFormat] || 'application/octet-stream';
    }

    const result = await pool.query(
      `INSERT INTO books (
        title, author, description, cover_image_url, cover_image_thumbnail, cover_image_small,
        cover_image_medium, cover_image_large, pdf_url, file_url, file_format, file_size, mime_type,
        language, genre, published_year, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [title, author, description, finalCoverUrl, coverThumbnail, coverSmall, coverMedium, coverLarge,
       finalPdfUrl, finalFileUrl, finalFileFormat, finalFileSize, finalMimeType, language, genre, published_year, req.user!.id]
    );

    const createdBook = result.rows[0];

    // Create notification for the new book
    await NotificationsController.createNotification('book', createdBook.id, createdBook.title);

    res.status(201).json({
      message: 'Book created successfully',
      book: createdBook
    });
  } catch (error) {
    console.error('Create book error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      title,
      author,
      description,
      cover_image_url,
      pdf_url,
      language,
      genre,
      published_year,
      is_active
    } = req.body;

    // Handle uploaded files - PRIORITIZE uploaded files over URL text inputs
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let finalPdfUrl = undefined; // undefined means "don't update"
    let finalCoverUrl = undefined; // undefined means "don't update"
    let coverThumbnail = undefined;
    let coverSmall = undefined;
    let coverMedium = undefined;
    let coverLarge = undefined;

    // Set PDF URL from uploaded file if available (HIGHEST PRIORITY)
    if (files && files.pdfFile && files.pdfFile[0]) {
      finalPdfUrl = `/public/pdfs/${files.pdfFile[0].filename}`;
    } else if (pdf_url !== undefined && pdf_url !== null && pdf_url !== '') {
      // Only use URL from text input if NO file was uploaded
      finalPdfUrl = pdf_url;
    }

    // Set cover image URL from uploaded file if available (HIGHEST PRIORITY)
    if (files && files.coverFile && files.coverFile[0]) {
      const uploadedCoverPath = files.coverFile[0].path;
      finalCoverUrl = `/public/images/${files.coverFile[0].filename}`;

      try {
        // Process the uploaded image to generate multiple sizes
        const processedImages = await imageProcessingService.processUploadedImage(
          uploadedCoverPath,
          {
            aspectRatio: '3:4', // Books use 3:4 aspect ratio
            quality: 85,
            format: 'webp',
            outputDir: path.join(process.cwd(), 'public', 'images')
          }
        );

        // Convert absolute paths to relative URLs for database storage
        const publicDir = path.join(process.cwd(), 'public');
        coverThumbnail = imageProcessingService.convertToRelativePath(processedImages.thumbnail, publicDir);
        coverSmall = imageProcessingService.convertToRelativePath(processedImages.small, publicDir);
        coverMedium = imageProcessingService.convertToRelativePath(processedImages.medium, publicDir);
        coverLarge = imageProcessingService.convertToRelativePath(processedImages.large, publicDir);

        console.log('✅ Cover image updated and processed successfully');
      } catch (error) {
        console.error('❌ Error processing updated cover image:', error);
        // Continue without processed images if processing fails
      }
    } else if (cover_image_url !== undefined && cover_image_url !== null && cover_image_url !== '') {
      // Only use URL from text input if NO file was uploaded
      finalCoverUrl = cover_image_url;
    }

    const result = await pool.query(
      `UPDATE books SET
        title = COALESCE($1, title),
        author = COALESCE($2, author),
        description = COALESCE($3, description),
        cover_image_url = COALESCE($4, cover_image_url),
        cover_image_thumbnail = COALESCE($5, cover_image_thumbnail),
        cover_image_small = COALESCE($6, cover_image_small),
        cover_image_medium = COALESCE($7, cover_image_medium),
        cover_image_large = COALESCE($8, cover_image_large),
        pdf_url = COALESCE($9, pdf_url),
        language = COALESCE($10, language),
        genre = COALESCE($11, genre),
        published_year = COALESCE($12, published_year),
        is_active = COALESCE($13, is_active)
      WHERE id = $14
      RETURNING *`,
      [title, author, description, finalCoverUrl, coverThumbnail, coverSmall, coverMedium, coverLarge,
       finalPdfUrl, language, genre, published_year, is_active, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    res.json({
      message: 'Book updated successfully',
      book: result.rows[0]
    });
  } catch (error) {
    console.error('Update book error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteBook = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // First get the book to check for files to delete
    const bookResult = await pool.query('SELECT * FROM books WHERE id = $1', [id]);

    if (bookResult.rows.length === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const book = bookResult.rows[0];

    // Delete associated files from filesystem
    if (book.pdf_url && book.pdf_url.startsWith('/')) {
      const fullPdfPath = process.cwd() + book.pdf_url;
      fs.unlink(fullPdfPath, () => {
        console.log('Deleted PDF file:', fullPdfPath);
      });
    }

    if (book.cover_image_url && book.cover_image_url.startsWith('/')) {
      const fullCoverPath = process.cwd() + book.cover_image_url;
      fs.unlink(fullCoverPath, () => {
        console.log('Deleted cover image file:', fullCoverPath);
      });
    }

    // Delete the book record from database permanently
    const result = await pool.query('DELETE FROM books WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    res.json({ message: 'Book deleted permanently' });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};