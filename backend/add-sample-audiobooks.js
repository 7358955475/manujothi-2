const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

const sampleAudioBooks = [
  {
    title: "The Alchemist",
    author: "Paulo Coelho",
    narrator: "Jeremy Irons",
    description: "A mystical story about Santiago, an Andalusian shepherd boy who dreams of discovering treasure in the Egyptian pyramids.",
    language: "english",
    genre: "Fiction",
    duration: 3600,
    audio_file_path: "/public/audio/sample-alchemist.mp3"
  },
  {
    title: "பொன்னியின் செல்வன்",
    author: "Kalki Krishnamurthy",
    narrator: "கமலஹாசன்",
    description: "A historical novel set in the Chola period, following the adventures of Vandiyathevan.",
    language: "tamil",
    genre: "Historical Fiction",
    duration: 7200,
    audio_file_path: "/public/audio/sample-ponniyin-selvan.mp3"
  },
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    narrator: "Jake Gyllenhaal",
    description: "A classic American novel set in the Jazz Age, depicting the decadent lifestyle of the wealthy elite.",
    language: "english",
    genre: "Classic Literature",
    duration: 4200,
    audio_file_path: "/public/audio/sample-gatsby.mp3"
  },
  {
    title: "మహాభారతం - ఆదిపర్వం",
    author: "Vyasa",
    narrator: "Nagarjuna",
    description: "The beginning of the epic Mahabharata, describing the creation of the universe and the birth of the Kuru dynasty.",
    language: "telugu",
    genre: "Epic",
    duration: 5400,
    audio_file_path: "/public/audio/sample-mahabharatam.mp3"
  },
  {
    title: "मालगुडी डेज",
    author: "R.K. Narayan",
    narrator: "Naseeruddin Shah",
    description: "A collection of short stories set in the fictional town of Malgudi, capturing the essence of small-town India.",
    language: "hindi",
    genre: "Short Stories",
    duration: 4800,
    audio_file_path: "/public/audio/sample-malgudi.mp3"
  },
  {
    title: "1984",
    author: "George Orwell",
    narrator: "Simon Prebble",
    description: "A dystopian social science fiction novel and cautionary tale about the dangers of totalitarianism.",
    language: "english",
    genre: "Dystopian Fiction",
    duration: 6000,
    audio_file_path: "/public/audio/sample-1984.mp3"
  },
  {
    title: "திருக்குறள்",
    author: "Thiruvalluvar",
    narrator: "திலகம்",
    description: "A classic Tamil text consisting of 1330 couplets that deal with various aspects of life.",
    language: "tamil",
    genre: "Philosophy",
    duration: 3600,
    audio_file_path: "/public/audio/sample-thirukkural.mp3"
  },
  {
    title: "Rich Dad Poor Dad",
    author: "Robert Kiyosaki",
    narrator: "Tim Wheeler",
    description: "A book that advocates the importance of financial literacy and financial independence.",
    language: "english",
    genre: "Self-Help",
    duration: 4200,
    audio_file_path: "/public/audio/sample-rich-dad.mp3"
  },
  {
    title: "ఆత్మకథ",
    author: "Mahatma Gandhi",
    narrator: "Pawan Kalyan",
    description: "The autobiography of Mahatma Gandhi, covering his life from early childhood to 1921.",
    language: "telugu",
    genre: "Autobiography",
    duration: 8400,
    audio_file_path: "/public/audio/sample-atma-katha.mp3"
  },
  {
    title: "चाचा चौधरी की चौबारे",
    author: "Sharad Joshi",
    narrator: "Om Puri",
    description: "A humorous collection of essays on rural Indian life and politics.",
    language: "hindi",
    genre: "Humor",
    duration: 2400,
    audio_file_path: "/public/audio/sample-chacha-chaudhary.mp3"
  }
];

async function createSampleAudioBooks() {
  try {
    console.log('🎧 Adding sample audio books to the database...');

    // Get admin user ID
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@ogon.com']);
    const adminUserId = userResult.rows[0]?.id;

    if (!adminUserId) {
      throw new Error('Admin user not found');
    }

    console.log(`👤 Using admin user ID: ${adminUserId}`);

    for (const audioBook of sampleAudioBooks) {
      // Insert into database
      const result = await pool.query(
        `INSERT INTO audio_books (
          title, author, narrator, description, cover_image_url, audio_file_path,
          language, genre, duration, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          audioBook.title,
          audioBook.author,
          audioBook.narrator,
          audioBook.description,
          `https://images.pexels.com/photos/7657/sunset-lit-sea-ocean.jpg?auto=compress&cs=tinysrgb&w=300&h=400&fit=crop`,
          audioBook.audio_file_path,
          audioBook.language,
          audioBook.genre,
          audioBook.duration,
          adminUserId
        ]
      );

      console.log(`✅ Added: ${audioBook.title} (ID: ${result.rows[0].id})`);
    }

    console.log('\n🎉 Sample audio books added successfully!');
    console.log('📊 You can now view them in your admin panel at http://localhost:3002');

  } catch (error) {
    console.error('❌ Error adding sample audio books:', error);
  } finally {
    await pool.end();
  }
}

// Create a sample audio file
function createSampleAudioFile() {
  const audioDir = path.join(__dirname, 'public', 'audio');

  // Ensure audio directory exists
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  // Create a placeholder audio file (in a real scenario, you would upload actual audio files)
  const sampleFilePath = path.join(audioDir, 'ground_truth.wav');

  if (!fs.existsSync(sampleFilePath)) {
    console.log('📝 Creating placeholder audio file...');
    // Create a small empty file as placeholder
    fs.writeFileSync(sampleFilePath, Buffer.alloc(1024), 'binary');
    console.log(`✅ Created placeholder audio file: ${sampleFilePath}`);
  }
}

// Run the script
createSampleAudioFile();
createSampleAudioBooks();