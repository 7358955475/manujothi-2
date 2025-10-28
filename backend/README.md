# OGON Backend API

A production-ready REST API for the OGON media library application, built with Node.js, Express, TypeScript, and PostgreSQL.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Media Management**: RESTful APIs for books, videos, and audio books
- **File Upload**: Secure audio file upload with validation
- **Admin Panel**: React-based admin interface for content management
- **Database**: PostgreSQL with comprehensive schema and migrations
- **Testing**: Comprehensive unit and integration tests
- **Logging**: Structured logging with file output
- **Error Handling**: Global error handling with proper HTTP status codes
- **Docker**: Production-ready containerization with Docker Compose
- **Security**: Helmet, CORS, rate limiting, input validation

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **Authentication**: JWT with bcrypt
- **Validation**: express-validator
- **File Upload**: Multer
- **Testing**: Jest + Supertest
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx

## Quick Start

### Development

1. **Clone and install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Start PostgreSQL with Docker:**
   ```bash
   docker-compose up -d postgres
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Run tests:**
   ```bash
   npm test
   npm run test:coverage
   ```

### Production Deployment

1. **Configure environment:**
   ```bash
   cp .env.production .env
   # Edit .env with your production values
   ```

2. **Deploy with Docker Compose:**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Verify deployment:**
   ```bash
   curl http://localhost/health
   ```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### User Management (Admin only)

- `GET /api/users` - List users with pagination
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (soft delete)
- `GET /api/users/me` - Get current user profile

### Books Management

- `GET /api/books` - List books (public)
- `GET /api/books/:id` - Get book by ID (public)
- `POST /api/books` - Create book (admin only)
- `PUT /api/books/:id` - Update book (admin only)
- `DELETE /api/books/:id` - Delete book (admin only)

### Videos Management

- `GET /api/videos` - List videos (public)
- `GET /api/videos/:id` - Get video by ID (public)
- `POST /api/videos` - Create video (admin only)
- `PUT /api/videos/:id` - Update video (admin only)
- `DELETE /api/videos/:id` - Delete video (admin only)

### Audio Books Management

- `GET /api/audio-books` - List audio books (public)
- `GET /api/audio-books/:id` - Get audio book by ID (public)
- `GET /api/audio-books/:id/stream` - Stream audio file (authenticated)
- `POST /api/audio-books` - Create audio book with file upload (admin only)
- `PUT /api/audio-books/:id` - Update audio book (admin only)
- `DELETE /api/audio-books/:id` - Delete audio book (admin only)

### Query Parameters

Most list endpoints support:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `language` - Filter by language (tamil, english, telugu, hindi)
- `genre` - Filter by genre (for books/audio books)
- `category` - Filter by category (for videos)

## Database Schema

### Users Table
- `id` (UUID, primary key)
- `email` (unique)
- `password_hash`
- `first_name`, `last_name`
- `role` (admin, user)
- `is_active` (boolean)
- `created_at`, `updated_at`

### Books Table
- `id` (UUID, primary key)
- `title`, `author`, `description`
- `cover_image_url`, `pdf_url`
- `language` (enum)
- `genre`, `published_year`
- `is_active`, `created_at`, `updated_at`
- `created_by` (foreign key to users)

### Videos Table
- `id` (UUID, primary key)
- `title`, `description`
- `youtube_url`, `youtube_id`, `thumbnail_url`
- `language` (enum)
- `category`, `duration`
- `is_active`, `created_at`, `updated_at`
- `created_by` (foreign key to users)

### Audio Books Table
- `id` (UUID, primary key)
- `title`, `author`, `narrator`, `description`
- `cover_image_url`, `audio_file_path`
- `language` (enum)
- `genre`, `duration`, `file_size`
- `is_active`, `created_at`, `updated_at`
- `created_by` (foreign key to users)

## Admin Panel

Access the admin panel at `http://localhost:3002` (development) or your production domain.

**Default admin credentials:**
- Email: `admin@ogon.com`
- Password: `admin123`

**Note**: Change the default password in production!

## Environment Variables

### Development (.env)
```env
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ogon_db
DB_USER=postgres
DB_PASSWORD=password
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
```

### Production (.env.production)
```env
NODE_ENV=production
PORT=3001
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ogon_db
DB_USER=postgres
DB_PASSWORD=STRONG_PASSWORD
JWT_SECRET=VERY_STRONG_SECRET_KEY
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
CORS_ORIGINS=https://yourdomain.com
```

## Security Features

- **Input Validation**: All endpoints validate input using express-validator
- **Rate Limiting**: API and auth endpoints have different rate limits
- **File Upload Security**: File type validation, size limits, secure storage
- **SQL Injection Protection**: Parameterized queries with pg library
- **XSS Protection**: Helmet middleware with security headers
- **CORS**: Configurable cross-origin resource sharing
- **JWT Security**: Secure token generation and validation
- **Password Hashing**: bcrypt with salt rounds

## Testing

Run the test suite:
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

Test structure:
- `tests/unit/` - Unit tests for utilities and helpers
- `tests/integration/` - Integration tests for API endpoints

## Logging

Logs are written to:
- Console (development)
- Files in `logs/` directory (production)

Log levels: ERROR, WARN, INFO, DEBUG

## Deployment

### Docker Production Setup

1. **SSL Certificates**: Place SSL certificates in `ssl/` directory
2. **Environment**: Configure `.env.production`
3. **Deploy**: `docker-compose -f docker-compose.prod.yml up -d`
4. **Monitor**: Check logs with `docker-compose logs -f`

### Nginx Configuration

The included nginx.conf provides:
- SSL termination
- Rate limiting
- Gzip compression
- Security headers
- Static file serving
- Reverse proxy to backend

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License