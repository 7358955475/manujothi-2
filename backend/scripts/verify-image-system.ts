#!/usr/bin/env ts-node

/**
 * Image System Verification Script
 *
 * Runs comprehensive checks to verify the image resizing system is working correctly.
 *
 * Usage:
 *   ts-node scripts/verify-image-system.ts
 *
 * Or add to package.json:
 *   "verify:images": "ts-node scripts/verify-image-system.ts"
 */

import { imageProcessingService } from '../src/services/ImageProcessingService';
import pool from '../src/config/database';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

const results: CheckResult[] = [];

function logResult(result: CheckResult) {
  results.push(result);

  const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
  const color = result.status === 'PASS' ? '\x1b[32m' : result.status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  const reset = '\x1b[0m';

  console.log(`${color}${icon} ${result.name}${reset}`);
  console.log(`  ${result.message}`);
  if (result.details) {
    console.log(`  Details:`, result.details);
  }
  console.log();
}

async function check1_DatabaseConnection() {
  try {
    await pool.query('SELECT 1');
    logResult({
      name: 'Database Connection',
      status: 'PASS',
      message: 'Successfully connected to database'
    });
  } catch (error) {
    logResult({
      name: 'Database Connection',
      status: 'FAIL',
      message: 'Failed to connect to database',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

async function check2_DatabaseSchema() {
  try {
    const columns = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'books'
        AND column_name LIKE 'cover_%'
      ORDER BY column_name
    `);

    const expectedColumns = [
      'cover_image_url',
      'cover_thumbnail',
      'cover_small',
      'cover_medium',
      'cover_large'
    ];

    const actualColumns = columns.rows.map((r: any) => r.column_name);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

    if (missingColumns.length === 0) {
      logResult({
        name: 'Database Schema',
        status: 'PASS',
        message: 'All responsive image columns exist',
        details: { columns: actualColumns }
      });
    } else {
      logResult({
        name: 'Database Schema',
        status: 'FAIL',
        message: 'Missing responsive image columns',
        details: { missing: missingColumns }
      });
    }
  } catch (error) {
    logResult({
      name: 'Database Schema',
      status: 'FAIL',
      message: 'Failed to check database schema',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

async function check3_SharpInstallation() {
  try {
    const versions = sharp.versions;

    logResult({
      name: 'Sharp Installation',
      status: 'PASS',
      message: 'Sharp is correctly installed',
      details: {
        sharp: versions.sharp,
        libvips: versions.vips
      }
    });
  } catch (error) {
    logResult({
      name: 'Sharp Installation',
      status: 'FAIL',
      message: 'Sharp is not properly installed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

async function check4_ImageProcessing() {
  const tempDir = tmpdir();
  const testImagePath = path.join(tempDir, 'test-verification.jpg');
  const outputDir = path.join(tempDir, 'test-output');

  try {
    // Create test image
    await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 100, g: 150, b: 200 }
      }
    })
      .jpeg()
      .toFile(testImagePath);

    await fs.mkdir(outputDir, { recursive: true });

    // Process image
    const result = await imageProcessingService.processUploadedImage(testImagePath, {
      aspectRatio: '3:4',
      outputDir,
      quality: 85,
      format: 'webp'
    });

    // Verify all variants created
    const variantsExist = await Promise.all([
      fs.access(result.thumbnail).then(() => true).catch(() => false),
      fs.access(result.small).then(() => true).catch(() => false),
      fs.access(result.medium).then(() => true).catch(() => false),
      fs.access(result.large).then(() => true).catch(() => false)
    ]);

    if (variantsExist.every(v => v)) {
      // Check file sizes
      const stats = await Promise.all([
        fs.stat(result.thumbnail),
        fs.stat(result.small),
        fs.stat(result.medium),
        fs.stat(result.large)
      ]);

      const sizes = {
        thumbnail: (stats[0].size / 1024).toFixed(2) + 'KB',
        small: (stats[1].size / 1024).toFixed(2) + 'KB',
        medium: (stats[2].size / 1024).toFixed(2) + 'KB',
        large: (stats[3].size / 1024).toFixed(2) + 'KB'
      };

      const mediumSize = stats[2].size / 1024;
      const status = mediumSize <= 220 ? 'PASS' : 'WARN';

      logResult({
        name: 'Image Processing',
        status,
        message: `All 4 variants generated successfully${status === 'WARN' ? ' (medium variant >200KB)' : ''}`,
        details: sizes
      });
    } else {
      logResult({
        name: 'Image Processing',
        status: 'FAIL',
        message: 'Some variants were not created',
        details: {
          thumbnail: variantsExist[0],
          small: variantsExist[1],
          medium: variantsExist[2],
          large: variantsExist[3]
        }
      });
    }

    // Cleanup
    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.unlink(testImagePath);

  } catch (error) {
    logResult({
      name: 'Image Processing',
      status: 'FAIL',
      message: 'Image processing failed',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

async function check5_FocalPointMapping() {
  try {
    const service = imageProcessingService as any;

    const testCases = [
      { input: undefined, expected: 'centre' },
      { input: { x: 0.5, y: 0.5 }, expected: 'centre' },
      { input: { x: 0.1, y: 0.1 }, expected: 'northwest' },
      { input: { x: 0.9, y: 0.9 }, expected: 'southeast' },
      { input: { x: 0.5, y: 0.1 }, expected: 'north' },
      { input: { x: 0.9, y: 0.5 }, expected: 'east' }
    ];

    let allPassed = true;
    const failures: string[] = [];

    for (const testCase of testCases) {
      const result = service.getFocalPosition(testCase.input);
      if (result !== testCase.expected) {
        allPassed = false;
        failures.push(`${JSON.stringify(testCase.input)} → ${result} (expected: ${testCase.expected})`);
      }
    }

    if (allPassed) {
      logResult({
        name: 'Focal Point Mapping',
        status: 'PASS',
        message: 'All focal point mappings correct',
        details: { testCases: testCases.length }
      });
    } else {
      logResult({
        name: 'Focal Point Mapping',
        status: 'FAIL',
        message: 'Some focal point mappings incorrect',
        details: { failures }
      });
    }
  } catch (error) {
    logResult({
      name: 'Focal Point Mapping',
      status: 'FAIL',
      message: 'Failed to test focal point mapping',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

async function check6_ImageDirectory() {
  const imageDir = path.join(__dirname, '../../public/images');

  try {
    await fs.access(imageDir);

    // Check if writable
    const testFile = path.join(imageDir, '.write-test');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);

    // Get directory size
    const files = await fs.readdir(imageDir);
    const stats = await Promise.all(
      files.map(f => fs.stat(path.join(imageDir, f)).catch(() => ({ size: 0 })))
    );
    const totalSize = stats.reduce((sum, s) => sum + s.size, 0);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

    logResult({
      name: 'Image Directory',
      status: 'PASS',
      message: 'Images directory exists and is writable',
      details: {
        path: imageDir,
        files: files.length,
        size: `${totalSizeMB} MB`
      }
    });
  } catch (error) {
    logResult({
      name: 'Image Directory',
      status: 'FAIL',
      message: 'Images directory not accessible or not writable',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

async function check7_ExistingImages() {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE cover_thumbnail IS NULL OR cover_small IS NULL
                         OR cover_medium IS NULL OR cover_large IS NULL) as missing
      FROM books
      WHERE cover_image_url IS NOT NULL
    `);

    const total = parseInt(result.rows[0]?.total || '0');
    const missing = parseInt(result.rows[0]?.missing || '0');

    if (total === 0) {
      logResult({
        name: 'Existing Images',
        status: 'PASS',
        message: 'No existing books to check',
        details: { total: 0 }
      });
    } else if (missing === 0) {
      logResult({
        name: 'Existing Images',
        status: 'PASS',
        message: 'All books have responsive variants',
        details: { total, missing: 0 }
      });
    } else {
      logResult({
        name: 'Existing Images',
        status: 'WARN',
        message: `${missing} of ${total} books are missing variants`,
        details: {
          total,
          missing,
          recommendation: 'Run: curl -X POST http://localhost:3001/api/images/regenerate-all'
        }
      });
    }
  } catch (error) {
    logResult({
      name: 'Existing Images',
      status: 'FAIL',
      message: 'Failed to check existing images',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

async function check8_WebPFormat() {
  const imageDir = path.join(__dirname, '../../public/images');

  try {
    const files = await fs.readdir(imageDir);
    const webpFiles = files.filter(f => f.endsWith('.webp'));
    const variantFiles = webpFiles.filter(f =>
      f.includes('-thumbnail') || f.includes('-small') ||
      f.includes('-medium') || f.includes('-large')
    );

    if (variantFiles.length > 0) {
      // Verify format of a sample
      const sampleFile = path.join(imageDir, variantFiles[0]);
      const metadata = await sharp(sampleFile).metadata();

      if (metadata.format === 'webp') {
        logResult({
          name: 'WebP Format',
          status: 'PASS',
          message: 'Images are correctly using WebP format',
          details: {
            totalWebP: webpFiles.length,
            variants: variantFiles.length
          }
        });
      } else {
        logResult({
          name: 'WebP Format',
          status: 'FAIL',
          message: 'Images are not in WebP format',
          details: { actualFormat: metadata.format }
        });
      }
    } else {
      logResult({
        name: 'WebP Format',
        status: 'WARN',
        message: 'No WebP variant images found',
        details: { webpFiles: webpFiles.length }
      });
    }
  } catch (error) {
    logResult({
      name: 'WebP Format',
      status: 'WARN',
      message: 'Could not verify WebP format (no images yet?)',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

async function runAllChecks() {
  console.log('\n========================================');
  console.log('  OGON Image System Verification');
  console.log('========================================\n');

  await check1_DatabaseConnection();
  await check2_DatabaseSchema();
  await check3_SharpInstallation();
  await check4_ImageProcessing();
  await check5_FocalPointMapping();
  await check6_ImageDirectory();
  await check7_ExistingImages();
  await check8_WebPFormat();

  console.log('========================================');
  console.log('  Summary');
  console.log('========================================\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const total = results.length;

  console.log(`Total Checks: ${total}`);
  console.log(`\x1b[32m✓ Passed: ${passed}\x1b[0m`);
  if (warned > 0) console.log(`\x1b[33m⚠ Warnings: ${warned}\x1b[0m`);
  if (failed > 0) console.log(`\x1b[31m✗ Failed: ${failed}\x1b[0m`);

  console.log();

  if (failed > 0) {
    console.log('\x1b[31mSome checks failed. Please review the errors above.\x1b[0m');
    process.exit(1);
  } else if (warned > 0) {
    console.log('\x1b[33mAll critical checks passed with some warnings.\x1b[0m');
    process.exit(0);
  } else {
    console.log('\x1b[32m✓ All checks passed! Image system is fully operational.\x1b[0m');
    process.exit(0);
  }
}

// Run verification
runAllChecks().catch(error => {
  console.error('\n\x1b[31mVerification script failed:\x1b[0m', error);
  process.exit(1);
});
