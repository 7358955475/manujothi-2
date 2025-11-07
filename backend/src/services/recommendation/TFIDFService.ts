/**
 * TF-IDF Vectorization Service
 *
 * Implements Term Frequency-Inverse Document Frequency algorithm for
 * converting media metadata (title, description, tags, genres) into
 * normalized vector representations for content-based recommendations.
 *
 * Key Features:
 * - Text preprocessing (tokenization, stopword removal, stemming)
 * - TF-IDF calculation with custom IDF corpus
 * - Vector normalization for cosine similarity
 * - Batch processing for efficiency
 * - Incremental updates for new media
 */

import pool from '../../config/database';
import natural from 'natural';

// Natural language processing tools
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const TfIdf = natural.TfIdf;

interface MediaItem {
  id: string;
  type: 'book' | 'audio' | 'video';
  title: string;
  description?: string;
  author?: string;
  narrator?: string;
  genre?: string;
  category?: string;
  language?: string;
  tags?: string[];
}

interface TFIDFVector {
  [term: string]: number;
}

interface VectorData {
  mediaId: string;
  mediaType: string;
  vector: TFIDFVector;
  magnitude: number;
  featureText: string;
  language?: string;
  genres: string[];
  tags: string[];
}

export class TFIDFService {
  private static stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
  ]);

  /**
   * Preprocess text: tokenize, lowercase, remove stopwords, stem
   */
  private static preprocessText(text: string): string[] {
    if (!text) return [];

    // Tokenize
    const tokens = tokenizer.tokenize(text.toLowerCase());

    // Remove stopwords, short words, and stem
    return tokens
      .filter(token =>
        token.length > 2 &&
        !this.stopWords.has(token) &&
        /^[a-z]+$/.test(token) // Only alphabetic
      )
      .map(token => stemmer.stem(token));
  }

  /**
   * Extract feature text from media metadata
   */
  private static extractFeatureText(media: MediaItem): string {
    const parts: string[] = [];

    // Title (weighted 3x by repetition)
    if (media.title) {
      parts.push(media.title, media.title, media.title);
    }

    // Description (weighted 2x)
    if (media.description) {
      parts.push(media.description, media.description);
    }

    // Author/Narrator (weighted 2x)
    if (media.author) {
      parts.push(media.author, media.author);
    }
    if (media.narrator) {
      parts.push(media.narrator, media.narrator);
    }

    // Genre/Category (weighted 2x)
    if (media.genre) {
      parts.push(media.genre, media.genre);
    }
    if (media.category) {
      parts.push(media.category, media.category);
    }

    // Tags (weighted 1x)
    if (media.tags && Array.isArray(media.tags)) {
      parts.push(...media.tags);
    }

    return parts.join(' ');
  }

  /**
   * Calculate TF-IDF vector for a document
   */
  private static calculateTFIDF(documents: string[]): TFIDFVector[] {
    const tfidf = new TfIdf();

    // Add all documents to corpus
    documents.forEach(doc => {
      const tokens = this.preprocessText(doc);
      tfidf.addDocument(tokens);
    });

    // Calculate vectors for each document
    const vectors: TFIDFVector[] = [];
    for (let i = 0; i < documents.length; i++) {
      const vector: TFIDFVector = {};
      tfidf.listTerms(i).forEach((item: any) => {
        if (item.tfidf > 0) {
          vector[item.term] = item.tfidf;
        }
      });
      vectors.push(vector);
    }

    return vectors;
  }

  /**
   * Normalize vector for cosine similarity
   */
  private static normalizeVector(vector: TFIDFVector): { vector: TFIDFVector; magnitude: number } {
    // Calculate magnitude
    let magnitudeSquared = 0;
    for (const term in vector) {
      magnitudeSquared += vector[term] * vector[term];
    }
    const magnitude = Math.sqrt(magnitudeSquared);

    // Normalize
    if (magnitude === 0) {
      return { vector: {}, magnitude: 0 };
    }

    const normalizedVector: TFIDFVector = {};
    for (const term in vector) {
      normalizedVector[term] = vector[term] / magnitude;
    }

    return { vector: normalizedVector, magnitude };
  }

  /**
   * Fetch all media items from database
   */
  private static async fetchAllMedia(): Promise<MediaItem[]> {
    const mediaItems: MediaItem[] = [];

    // Fetch books
    const booksResult = await pool.query(`
      SELECT id, title, description, author, genre, language
      FROM books
      WHERE is_active = true
    `);
    booksResult.rows.forEach(row => {
      mediaItems.push({
        id: row.id,
        type: 'book',
        title: row.title,
        description: row.description,
        author: row.author,
        genre: row.genre,
        language: row.language,
        tags: []
      });
    });

    // Fetch audio books
    const audioResult = await pool.query(`
      SELECT id, title, description, author, narrator, genre, language
      FROM audio_books
      WHERE is_active = true
    `);
    audioResult.rows.forEach(row => {
      mediaItems.push({
        id: row.id,
        type: 'audio',
        title: row.title,
        description: row.description,
        author: row.author,
        narrator: row.narrator,
        genre: row.genre,
        language: row.language,
        tags: []
      });
    });

    // Fetch videos
    const videosResult = await pool.query(`
      SELECT id, title, description, category as genre, language
      FROM videos
      WHERE is_active = true
    `);
    videosResult.rows.forEach(row => {
      mediaItems.push({
        id: row.id,
        type: 'video',
        title: row.title,
        description: row.description,
        category: row.genre,
        genre: row.genre,
        language: row.language,
        tags: []
      });
    });

    return mediaItems;
  }

  /**
   * Store vector in database
   */
  private static async storeVector(vectorData: VectorData): Promise<void> {
    await pool.query(`
      INSERT INTO media_vectors (
        media_type, media_id, vector_data, vector_magnitude,
        feature_text, language, genres, tags, last_updated
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (media_type, media_id)
      DO UPDATE SET
        vector_data = EXCLUDED.vector_data,
        vector_magnitude = EXCLUDED.vector_magnitude,
        feature_text = EXCLUDED.feature_text,
        language = EXCLUDED.language,
        genres = EXCLUDED.genres,
        tags = EXCLUDED.tags,
        last_updated = CURRENT_TIMESTAMP
    `, [
      vectorData.mediaType,
      vectorData.mediaId,
      JSON.stringify(vectorData.vector),
      vectorData.magnitude,
      vectorData.featureText,
      vectorData.language,
      vectorData.genres,
      vectorData.tags
    ]);
  }

  /**
   * Build TF-IDF vectors for all media items
   * This should be run periodically (e.g., nightly) or when new media is added
   */
  static async buildVectorsForAllMedia(): Promise<{ processed: number; errors: number }> {
    console.log('🔄 Starting TF-IDF vectorization for all media...');

    try {
      // Fetch all media
      const allMedia = await this.fetchAllMedia();
      console.log(`📚 Fetched ${allMedia.length} media items`);

      if (allMedia.length === 0) {
        console.log('⚠️ No media items found');
        return { processed: 0, errors: 0 };
      }

      // Extract feature texts
      const featureTexts = allMedia.map(media => this.extractFeatureText(media));

      // Calculate TF-IDF vectors for all documents at once
      const tfidfVectors = this.calculateTFIDF(featureTexts);

      // Normalize and store vectors
      let processed = 0;
      let errors = 0;

      for (let i = 0; i < allMedia.length; i++) {
        try {
          const media = allMedia[i];
          const { vector, magnitude } = this.normalizeVector(tfidfVectors[i]);

          const vectorData: VectorData = {
            mediaId: media.id,
            mediaType: media.type,
            vector,
            magnitude,
            featureText: featureTexts[i],
            language: media.language,
            genres: media.genre ? [media.genre] : [],
            tags: media.tags || []
          };

          await this.storeVector(vectorData);
          processed++;

          if (processed % 50 === 0) {
            console.log(`✅ Processed ${processed}/${allMedia.length} vectors`);
          }
        } catch (error) {
          console.error(`❌ Error processing media ${allMedia[i].id}:`, error);
          errors++;
        }
      }

      console.log(`✅ TF-IDF vectorization complete: ${processed} processed, ${errors} errors`);
      return { processed, errors };
    } catch (error) {
      console.error('❌ Error in buildVectorsForAllMedia:', error);
      throw error;
    }
  }

  /**
   * Build vector for a single media item (for incremental updates)
   */
  static async buildVectorForSingleMedia(
    mediaId: string,
    mediaType: 'book' | 'audio' | 'video'
  ): Promise<void> {
    console.log(`🔄 Building vector for ${mediaType} ${mediaId}...`);

    try {
      // Fetch the specific media
      let media: MediaItem | null = null;

      if (mediaType === 'book') {
        const result = await pool.query(
          'SELECT id, title, description, author, genre, language FROM books WHERE id = $1',
          [mediaId]
        );
        if (result.rows.length > 0) {
          const row = result.rows[0];
          media = {
            id: row.id,
            type: 'book',
            title: row.title,
            description: row.description,
            author: row.author,
            genre: row.genre,
            language: row.language,
            tags: []
          };
        }
      } else if (mediaType === 'audio') {
        const result = await pool.query(
          'SELECT id, title, description, author, narrator, genre, language FROM audio_books WHERE id = $1',
          [mediaId]
        );
        if (result.rows.length > 0) {
          const row = result.rows[0];
          media = {
            id: row.id,
            type: 'audio',
            title: row.title,
            description: row.description,
            author: row.author,
            narrator: row.narrator,
            genre: row.genre,
            language: row.language,
            tags: []
          };
        }
      } else if (mediaType === 'video') {
        const result = await pool.query(
          'SELECT id, title, description, category, language FROM videos WHERE id = $1',
          [mediaId]
        );
        if (result.rows.length > 0) {
          const row = result.rows[0];
          media = {
            id: row.id,
            type: 'video',
            title: row.title,
            description: row.description,
            category: row.category,
            genre: row.category,
            language: row.language,
            tags: []
          };
        }
      }

      if (!media) {
        throw new Error(`Media not found: ${mediaType} ${mediaId}`);
      }

      // Get existing corpus for IDF calculation
      const allMedia = await this.fetchAllMedia();
      const featureTexts = allMedia.map(m => this.extractFeatureText(m));

      // Calculate TF-IDF for entire corpus
      const tfidfVectors = this.calculateTFIDF(featureTexts);

      // Find the vector for our target media
      const targetIndex = allMedia.findIndex(m => m.id === mediaId && m.type === mediaType);

      if (targetIndex === -1) {
        throw new Error(`Media not found in corpus: ${mediaType} ${mediaId}`);
      }

      const { vector, magnitude } = this.normalizeVector(tfidfVectors[targetIndex]);

      const vectorData: VectorData = {
        mediaId: media.id,
        mediaType: media.type,
        vector,
        magnitude,
        featureText: this.extractFeatureText(media),
        language: media.language,
        genres: media.genre ? [media.genre] : [],
        tags: media.tags || []
      };

      await this.storeVector(vectorData);
      console.log(`✅ Vector built for ${mediaType} ${mediaId}`);
    } catch (error) {
      console.error(`❌ Error building vector for ${mediaType} ${mediaId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(vector1: TFIDFVector, vector2: TFIDFVector): number {
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    // Get all unique terms
    const allTerms = new Set([...Object.keys(vector1), ...Object.keys(vector2)]);

    for (const term of allTerms) {
      const val1 = vector1[term] || 0;
      const val2 = vector2[term] || 0;

      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    }

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  /**
   * Get vector for a media item
   */
  static async getVector(mediaId: string, mediaType: string): Promise<TFIDFVector | null> {
    const result = await pool.query(
      'SELECT vector_data FROM media_vectors WHERE media_id = $1 AND media_type = $2',
      [mediaId, mediaType]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].vector_data;
  }

  /**
   * Find similar items based on vector similarity
   */
  static async findSimilarItems(
    mediaId: string,
    mediaType: string,
    limit: number = 10,
    minSimilarity: number = 0.1
  ): Promise<Array<{ mediaId: string; mediaType: string; similarity: number }>> {
    // Get target vector
    const targetVector = await this.getVector(mediaId, mediaType);

    if (!targetVector) {
      console.warn(`No vector found for ${mediaType} ${mediaId}`);
      return [];
    }

    // Get all other vectors
    const result = await pool.query(`
      SELECT media_id, media_type, vector_data
      FROM media_vectors
      WHERE NOT (media_id = $1 AND media_type = $2)
    `, [mediaId, mediaType]);

    // Calculate similarities
    const similarities = result.rows
      .map(row => ({
        mediaId: row.media_id,
        mediaType: row.media_type,
        similarity: this.cosineSimilarity(targetVector, row.vector_data)
      }))
      .filter(item => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return similarities;
  }
}
