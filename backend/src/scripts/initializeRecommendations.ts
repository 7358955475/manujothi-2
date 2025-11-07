/**
 * Initialize Recommendation Engine
 *
 * This script should be run:
 * - After setting up the database
 * - When new media is added in bulk
 * - Periodically (e.g., nightly) to refresh vectors
 *
 * Usage:
 *   ts-node src/scripts/initializeRecommendations.ts [--skip-vectors] [--skip-cache]
 */

import { TFIDFService } from '../services/recommendation/TFIDFService';
import { ContentBasedService } from '../services/recommendation/ContentBasedService';
import pool from '../config/database';

interface InitOptions {
  skipVectors: boolean;
  skipCache: boolean;
}

async function parseArgs(): Promise<InitOptions> {
  const args = process.argv.slice(2);
  return {
    skipVectors: args.includes('--skip-vectors'),
    skipCache: args.includes('--skip-cache')
  };
}

async function main() {
  console.log('🚀 Initializing Recommendation Engine...\n');

  const options = await parseArgs();
  const startTime = Date.now();

  try {
    // Step 1: Build TF-IDF vectors
    if (!options.skipVectors) {
      console.log('📊 Step 1: Building TF-IDF vectors for all media...');
      const vectorResult = await TFIDFService.buildVectorsForAllMedia();
      console.log(`✅ Vectors built: ${vectorResult.processed} processed, ${vectorResult.errors} errors\n`);
    } else {
      console.log('⏭️  Step 1: Skipped (--skip-vectors flag)\n');
    }

    // Step 2: Precompute similar items cache
    if (!options.skipCache) {
      console.log('💾 Step 2: Precomputing similar items cache...');
      const cacheResult = await ContentBasedService.precomputeSimilarItems(20);
      console.log(`✅ Cache built: ${cacheResult.processed} items processed, ${cacheResult.errors} errors\n`);
    } else {
      console.log('⏭️  Step 2: Skipped (--skip-cache flag)\n');
    }

    // Step 3: Clean up old cache entries
    console.log('🧹 Step 3: Cleaning up expired cache entries...');
    const cleanupResult = await pool.query(`
      DELETE FROM recommendation_cache
      WHERE expires_at < CURRENT_TIMESTAMP
    `);
    console.log(`✅ Cleaned up ${cleanupResult.rowCount} expired cache entries\n`);

    // Step 4: Show statistics
    console.log('📈 Statistics:');
    const stats = await getStatistics();
    console.log(`   • Total media vectors: ${stats.vectors}`);
    console.log(`   • Total similar items cached: ${stats.similarItems}`);
    console.log(`   • Total user interactions: ${stats.interactions}`);
    console.log(`   • Total user profiles: ${stats.profiles}`);
    console.log(`   • Active cache entries: ${stats.cacheEntries}\n`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Initialization complete in ${duration}s`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

async function getStatistics() {
  const vectorsResult = await pool.query('SELECT COUNT(*) FROM media_vectors');
  const similarItemsResult = await pool.query('SELECT COUNT(*) FROM similar_items_cache');
  const interactionsResult = await pool.query('SELECT COUNT(*) FROM user_interactions');
  const profilesResult = await pool.query('SELECT COUNT(*) FROM user_preference_profiles');
  const cacheResult = await pool.query(`
    SELECT COUNT(*) FROM recommendation_cache WHERE expires_at > CURRENT_TIMESTAMP
  `);

  return {
    vectors: parseInt(vectorsResult.rows[0].count),
    similarItems: parseInt(similarItemsResult.rows[0].count),
    interactions: parseInt(interactionsResult.rows[0].count),
    profiles: parseInt(profilesResult.rows[0].count),
    cacheEntries: parseInt(cacheResult.rows[0].count)
  };
}

// Run the script
main();
