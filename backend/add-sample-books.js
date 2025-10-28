const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

const sampleBooks = [
  {
    title: "Tamil Literature Classics",
    author: "Various Tamil Authors",
    description: "A collection of classical Tamil literature spanning centuries",
    cover_image_url: "https://images.pexels.com/photos/1130980/pexels-photo-1130980.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
    pdf_url: "/public/pdfs/tamil-literature.pdf",
    language: "tamil",
    genre: "literature",
    published_year: 2024
  },
  {
    title: "English Grammar Complete Guide",
    author: "Dr. Sarah Johnson",
    description: "Comprehensive guide to English grammar for all levels",
    cover_image_url: "https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
    pdf_url: "/public/pdfs/english-grammar.pdf",
    language: "english",
    genre: "education",
    published_year: 2023
  },
  {
    title: "Telugu Poetry Collection",
    author: "Kaloji Narayana Rao",
    description: "Beautiful collection of Telugu poems and literary works",
    cover_image_url: "https://images.pexels.com/photos/46274/pexels-photo-46274.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
    pdf_url: null, // This will test the "no PDF" case
    language: "telugu",
    genre: "poetry",
    published_year: 2022
  },
  {
    title: "Hindi Spiritual Wisdom",
    author: "Swami Vivekananda",
    description: "Spiritual teachings and philosophy in Hindi",
    cover_image_url: "https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
    pdf_url: "/public/pdfs/hindi-spiritual.pdf",
    language: "hindi",
    genre: "spiritual",
    published_year: 2024
  },
  {
    title: "Modern Science in Tamil",
    author: "Dr. A.P.J. Abdul Kalam",
    description: "Scientific concepts explained in simple Tamil",
    cover_image_url: "https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop",
    pdf_url: "/public/pdfs/science-tamil.pdf",
    language: "tamil",
    genre: "science",
    published_year: 2023
  }
];

async function addSampleBooks() {
  const client = await pool.connect();

  try {
    console.log('📚 Adding sample books to the database...');

    // Get admin user ID
    const adminResult = await client.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (adminResult.rows.length === 0) {
      console.error('❌ No admin user found. Please create an admin user first.');
      return;
    }

    const adminUserId = adminResult.rows[0].id;
    console.log(`👤 Using admin user ID: ${adminUserId}`);

    for (const book of sampleBooks) {
      try {
        const result = await client.query(
          `INSERT INTO books (
            title, author, description, cover_image_url, pdf_url,
            language, genre, published_year, created_by, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, title`,
          [
            book.title,
            book.author,
            book.description,
            book.cover_image_url,
            book.pdf_url,
            book.language,
            book.genre,
            book.published_year,
            adminUserId,
            true
          ]
        );

        console.log(`✅ Added: ${result.rows[0].title} (ID: ${result.rows[0].id})`);
      } catch (error) {
        console.error(`❌ Failed to add "${book.title}":`, error.message);
      }
    }

    console.log('\n🎉 Sample books added successfully!');
    console.log('📊 You can now view them in your user panel at http://localhost:5173');

  } catch (error) {
    console.error('❌ Error adding sample books:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
addSampleBooks().catch(console.error);