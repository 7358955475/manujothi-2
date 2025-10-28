import request from 'supertest';
import app from '../../src/index';

describe('Books Endpoints', () => {
  let authToken: string;
  let adminToken: string;

  const testBook = {
    title: 'Test Book',
    author: 'Test Author',
    description: 'A test book description',
    language: 'english',
    genre: 'Fiction',
    published_year: 2023
  };

  beforeAll(async () => {
    // Create test admin user and get token
    const adminUser = {
      email: 'admin@test.com',
      password: 'password123',
      first_name: 'Admin',
      last_name: 'User'
    };

    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send(adminUser);

    authToken = adminResponse.body.token;

    // Make user admin (this would normally be done via database)
    // For test purposes, you might need to manually update the user role
  });

  describe('GET /api/books', () => {
    it('should get all books without authentication', async () => {
      const response = await request(app)
        .get('/api/books')
        .expect(200);

      expect(response.body).toHaveProperty('books');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.books)).toBe(true);
    });

    it('should filter books by language', async () => {
      const response = await request(app)
        .get('/api/books?language=english')
        .expect(200);

      expect(response.body).toHaveProperty('books');
      response.body.books.forEach((book: any) => {
        expect(book.language).toBe('english');
      });
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/books?page=1&limit=5')
        .expect(200);

      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 5);
    });
  });

  describe('GET /api/books/:id', () => {
    it('should return 404 for non-existent book', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .get(`/api/books/${fakeId}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app)
        .get('/api/books/invalid-id')
        .expect(400);
    });
  });

  describe('POST /api/books', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .post('/api/books')
        .send(testBook)
        .expect(401);
    });

    it('should create book with valid admin token', async () => {
      const response = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testBook)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('book');
      expect(response.body.book.title).toBe(testBook.title);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Only Title' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid language', async () => {
      const response = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...testBook, language: 'invalid-language' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/books/:id', () => {
    let bookId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testBook);
      bookId = response.body.book.id;
    });

    it('should update book with valid data', async () => {
      const updatedData = { title: 'Updated Title' };

      const response = await request(app)
        .put(`/api/books/${bookId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedData)
        .expect(200);

      expect(response.body.book.title).toBe(updatedData.title);
    });

    it('should return 404 for non-existent book', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .put(`/api/books/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/books/:id', () => {
    let bookId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testBook);
      bookId = response.body.book.id;
    });

    it('should delete book', async () => {
      await request(app)
        .delete(`/api/books/${bookId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify book is soft deleted
      await request(app)
        .get(`/api/books/${bookId}`)
        .expect(404);
    });

    it('should return 404 for non-existent book', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .delete(`/api/books/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});