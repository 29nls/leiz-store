#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * 
 * Analyzes Next.js build output to identify large bundles
 * and opportunities for optimization
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', '.next');
const CHUNKS_DIR = path.join(BUILD_DIR, 'static', 'chunks');

function getFileSizeInKB(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / 1024).toFixed(2);
}

function analyzeChunks() {
  if (!fs.existsSync(CHUNKS_DIR)) {
    console.error('❌ Build directory not found. Run `npm run build` first.');
    process.exit(1);
  }

  console.log('\n📊 Analyzing bundle sizes...\n');

  const files = fs.readdirSync(CHUNKS_DIR);
  const chunks = files
    .filter(file => file.endsWith('.js'))
    .map(file => ({
      name: file,
      size: parseFloat(getFileSizeInKB(path.join(CHUNKS_DIR, file))),
      path: path.join(CHUNKS_DIR, file),
    }))
    .sort((a, b) => b.size - a.size);

  // Show top 10 largest chunks
  console.log('🔍 Top 10 Largest Chunks:\n');
  chunks.slice(0, 10).forEach((chunk, index) => {
    const emoji = chunk.size > 200 ? '🔴' : chunk.size > 100 ? '🟡' : '🟢';
    console.log(`${index + 1}. ${emoji} ${chunk.name}`);
    console.log(`   Size: ${chunk.size} KB\n`);
  });

  // Calculate total size
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  console.log(`📦 Total JavaScript: ${totalSize.toFixed(2)} KB`);

  // Identify problematic chunks
  const largeChunks = chunks.filter(chunk => chunk.size > 200);
  if (largeChunks.length > 0) {
    console.log(`\n⚠️  Warning: ${largeChunks.length} chunk(s) larger than 200 KB`);
    console.log('\nRecommendations:');
    console.log('- Consider code splitting with dynamic imports');
    console.log('- Review dependencies in large chunks');
    console.log('- Enable tree-shaking for unused code');
  }

  // Check for duplicate dependencies
  const potentialDuplicates = findPotentialDuplicates(chunks);
  if (potentialDuplicates.length > 0) {
    console.log('\n🔄 Potential Duplicate Dependencies:');
    potentialDuplicates.forEach(dup => {
      console.log(`- ${dup}`);
    });
  }

  console.log('\n✅ Analysis complete!\n');
}

function findPotentialDuplicates(chunks) {
  const patterns = ['react', 'lodash', 'moment', 'axios', 'framer-motion'];
  const duplicates = [];

  patterns.forEach(pattern => {
    const matching = chunks.filter(chunk => 
      chunk.name.toLowerCase().includes(pattern)
    );
    if (matching.length > 1) {
      duplicates.push(`${pattern} (${matching.length} chunks)`);
    }
  });

  return duplicates;
}

// Run analysis
try {
  analyzeChunks();
} catch (error) {
  console.error('❌ Error analyzing bundles:', error.message);
  process.exit(1);
}
