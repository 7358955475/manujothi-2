import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';

export const getAllBooks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const language = req.query.language as string;
    const genre = req.query.genre as string;
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

    // Handle uploaded files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let finalPdfUrl = pdf_url;
    let finalFileUrl = file_url || pdf_url;
    let finalCoverUrl = cover_image_url;
    let finalFileFormat = file_format || 'pdf';
    let finalFileSize = file_size;
    let finalMimeType = mime_type;

    // Set PDF URL from uploaded file if available
    if (files && files.pdfFile && files.pdfFile[0]) {
      finalPdfUrl = `/public/pdfs/${files.pdfFile[0].filename}`;
      finalFileUrl = finalPdfUrl;
      finalFileSize = files.pdfFile[0].size;
      finalMimeType = files.pdfFile[0].mimetype;
    }

    // Handle other book file formats
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

    // Set cover image URL from uploaded file if available
    if (files && files.coverFile && files.coverFile[0]) {
      finalCoverUrl = `/public/images/${files.coverFile[0].filename}`;
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
        title, author, description, cover_image_url, pdf_url, file_url, file_format, file_size, mime_type,
        language, genre, published_year, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [title, author, description, finalCoverUrl, finalPdfUrl, finalFileUrl, finalFileFormat, finalFileSize, finalMimeType, language, genre, published_year, req.user!.id]
    );

    res.status(201).json({
      message: 'Book created successfully',
      book: result.rows[0]
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

    // Handle uploaded files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let finalPdfUrl = pdf_url;
    let finalCoverUrl = cover_image_url;

    // Set PDF URL from uploaded file if available
    if (files && files.pdfFile && files.pdfFile[0]) {
      finalPdfUrl = `/public/pdfs/${files.pdfFile[0].filename}`;
    }

    // Set cover image URL from uploaded file if available
    if (files && files.coverFile && files.coverFile[0]) {
      finalCoverUrl = `/public/images/${files.coverFile[0].filename}`;
    }

    const result = await pool.query(
      `UPDATE books SET
        title = COALESCE($1, title),
        author = COALESCE($2, author),
        description = COALESCE($3, description),
        cover_image_url = COALESCE($4, cover_image_url),
        pdf_url = COALESCE($5, pdf_url),
        language = COALESCE($6, language),
        genre = COALESCE($7, genre),
        published_year = COALESCE($8, published_year),
        is_active = COALESCE($9, is_active)
      WHERE id = $10
      RETURNING *`,
      [title, author, description, finalCoverUrl, finalPdfUrl, language, genre, published_year, is_active, id]
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