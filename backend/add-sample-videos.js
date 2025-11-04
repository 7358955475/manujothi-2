const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

const extractYouTubeId = (url) => {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : '';
};

const getYouTubeThumbnail = (videoId) => {
  // Use hqdefault.jpg as it's more reliable than maxresdefault.jpg
  // maxresdefault.jpg may not exist for some videos, but hqdefault.jpg almost always exists
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
};

const sampleVideos = [
  {
    title: "Tamil Classical Music - Bharatanatyam Performance",
    description: "Beautiful classical Tamil dance performance with traditional music",
    youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    language: "tamil",
    category: "Cultural",
    duration: 420
  },
  {
    title: "English Literature - Shakespeare's Hamlet Analysis",
    description: "Comprehensive analysis of Shakespeare's masterpiece Hamlet",
    youtube_url: "https://www.youtube.com/watch?v=fC7oUOUEEi4",
    language: "english",
    category: "Education",
    duration: 1800
  },
  {
    title: "Telugu Folk Songs - Traditional Music",
    description: "Collection of traditional Telugu folk songs from Andhra Pradesh",
    youtube_url: "https://www.youtube.com/watch?v=ScMzIvxBSi4",
    language: "telugu",
    category: "Music",
    duration: 900
  },
  {
    title: "Hindi Motivational Speech - Success Mindset",
    description: "Inspiring Hindi speech about developing a success mindset",
    youtube_url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    language: "hindi",
    category: "Motivation",
    duration: 1200
  },
  {
    title: "Tamil Technology Tutorial - Programming Basics",
    description: "Learn programming fundamentals explained in Tamil",
    youtube_url: "https://www.youtube.com/watch?v=Ks-_Mh1QhMc",
    language: "tamil",
    category: "Technology",
    duration: 2400
  },
  {
    title: "English Science Documentary - Space Exploration",
    description: "Fascinating documentary about space exploration and astronomy",
    youtube_url: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
    language: "english",
    category: "Science",
    duration: 3600
  },
  {
    title: "Telugu Cooking Show - Traditional Recipes",
    description: "Learn to cook traditional Telugu dishes with authentic recipes",
    youtube_url: "https://www.youtube.com/watch?v=rYEDA3JcQqw",
    language: "telugu",
    category: "Cooking",
    duration: 1500
  },
  {
    title: "Hindi History Documentary - Ancient India",
    description: "Comprehensive documentary about ancient Indian civilization",
    youtube_url: "https://www.youtube.com/watch?v=uHjNGhVDrIs",
    language: "hindi",
    category: "History",
    duration: 2700
  },
  {
    title: "Tamil Spiritual Discourse - Philosophy and Life",
    description: "Deep philosophical discussion about life and spirituality in Tamil",
    youtube_url: "https://www.youtube.com/watch?v=3JZ_D3ELwOQ",
    language: "tamil",
    category: "Spiritual",
    duration: 1800
  },
  {
    title: "English Business Tutorial - Entrepreneurship",
    description: "Essential business skills and entrepreneurship guidance",
    youtube_url: "https://www.youtube.com/watch?v=fcIMIyQnOso",
    language: "english",
    category: "Business",
    duration: 2100
  }
];

async function addSampleVideos() {
  const client = await pool.connect();

  try {
    console.log('🎬 Adding sample videos to the database...');

    // Get admin user ID (assuming there's at least one admin user)
    const adminResult = await client.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (adminResult.rows.length === 0) {
      console.error('❌ No admin user found. Please create an admin user first.');
      return;
    }

    const adminUserId = adminResult.rows[0].id;
    console.log(`👤 Using admin user ID: ${adminUserId}`);

    for (const video of sampleVideos) {
      const youtube_id = extractYouTubeId(video.youtube_url);
      const thumbnail_url = getYouTubeThumbnail(youtube_id);

      try {
        const result = await client.query(
          `INSERT INTO videos (
            title, description, youtube_url, youtube_id, thumbnail_url,
            language, category, duration, created_by, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id, title`,
          [
            video.title,
            video.description,
            video.youtube_url,
            youtube_id,
            thumbnail_url,
            video.language,
            video.category,
            video.duration,
            adminUserId,
            true
          ]
        );

        console.log(`✅ Added: ${result.rows[0].title} (ID: ${result.rows[0].id})`);
      } catch (error) {
        console.error(`❌ Failed to add "${video.title}":`, error.message);
      }
    }

    console.log('\n🎉 Sample videos added successfully!');
    console.log('📊 You can now view them in your admin panel at http://localhost:3002');

  } catch (error) {
    console.error('❌ Error adding sample videos:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
addSampleVideos().catch(console.error);