const query = `
SELECT DISTINCT ON (ua.media_type, ua.media_id)
  ua.media_type,
  ua.media_id,
  ua.created_at as last_viewed,
  CASE
    WHEN ua.media_type = 'book' THEN b.title
    WHEN ua.media_type = 'audio' THEN ab.title
    WHEN ua.media_type = 'video' THEN v.title
  END as title,
  CASE
    WHEN ua.media_type = 'book' THEN b.author
    WHEN ua.media_type = 'audio' THEN ab.author
    WHEN ua.media_type = 'video' THEN NULL
  END as author,
  CASE
    WHEN ua.media_type = 'book' THEN b.cover_image_url
    WHEN ua.media_type = 'audio' THEN ab.cover_image_url
    WHEN ua.media_type = 'video' THEN v.thumbnail_url
  END as cover_image_url,
  CASE
    WHEN ua.media_type = 'book' THEN b.language
    WHEN ua.media_type = 'audio' THEN ab.language
    WHEN ua.media_type = 'video' THEN v.language
  END as language,
  CASE
    WHEN ua.media_type = 'book' THEN b.genre
    WHEN ua.media_type = 'audio' THEN ab.genre
    WHEN ua.media_type = 'video' THEN v.category
  END as genre_or_category,
  CASE
    WHEN ua.media_type = 'book' THEN b.file_url
    WHEN ua.media_type = 'audio' THEN ab.audio_url
    WHEN ua.media_type = 'video' THEN v.video_url
  END as file_url,
  CASE
    WHEN ua.media_type = 'book' THEN b.pdf_url
    WHEN ua.media_type = 'audio' THEN ab.audio_url
    WHEN ua.media_type = 'video' THEN v.video_url
  END as content_url,
  CASE
    WHEN ua.media_type = 'book' THEN b.file_format
    WHEN ua.media_type = 'audio' THEN NULL
    WHEN ua.media_type = 'video' THEN NULL
  END as file_format,
  CASE
    WHEN ua.media_type = 'book' THEN b.mime_type
    WHEN ua.media_type = 'audio' THEN NULL
    WHEN ua.media_type = 'video' THEN NULL
  END as mime_type,
  up.progress_percentage,
  up.status,
  up.time_spent
FROM user_activity ua
LEFT JOIN user_progress up ON ua.user_id = up.user_id AND ua.media_type = up.media_type AND ua.media_id = up.media_id
LEFT JOIN books b ON ua.media_id = b.id AND ua.media_type = 'book'
LEFT JOIN audio_books ab ON ua.media_id = ab.id AND ua.media_type = 'audio'
LEFT JOIN videos v ON ua.media_id = v.id AND ua.media_type = 'video'
WHERE ua.user_id = $1 AND ua.activity_type = 'viewed'
ORDER BY ua.media_type, ua.media_id, ua.created_at DESC
LIMIT $2
`;

console.log('Query length:', query.length);
console.log('Character at position 1333:', query.charAt(1332)); // 0-indexed
console.log('Context around position 1333:');
console.log(query.substring(1320, 1350));