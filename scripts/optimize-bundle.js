#!/usr/bin/env node

/**
 * Bundle Optimization Script
 * 
 * Analyzes and suggests optimizations for bundle size reduction
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n🚀 Bundle Optimization Analysis\n');
console.log('═'.repeat(60));

// 1. Check for duplicate dependencies
console.log('\n1️⃣  Checking for duplicate dependencies...\n');
try {
  execSync('npm dedupe', { stdio: 'inherit' });
  console.log('✅ Duplicate dependencies removed\n');
} catch (error) {
  console.log('⚠️  No duplicates found or dedupe failed\n');
}

// 2. Check for unused dependencies
console.log('2️⃣  Checking for unused dependencies...\n');
const packageJson = require(path.join(process.cwd(), 'package.json'));
const dependencies = Object.keys(packageJson.dependencies || {});

// Simple check - look for imports in source files
const srcPath = path.join(process.cwd(), 'src');
const usedDeps = new Set();

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      scanDirectory(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(filePath, 'utf8');
      dependencies.forEach(dep => {
        if (content.includes(`from "${dep}"`) || content.includes(`from '${dep}'`) ||
            content.includes(`require("${dep}")`) || content.includes(`require('${dep}')`)) {
          usedDeps.add(dep);
        }
      });
    }
  });
}

try {
  scanDirectory(srcPath);
  
  const unused = dependencies.filter(dep => !usedDeps.has(dep));
  
  if (unused.length > 0) {
    console.log('⚠️  Potentially unused dependencies:');
    unused.forEach(dep => {
      console.log(`   - ${dep}`);
    });
    console.log('\n   Run: npm uninstall ' + unused.join(' '));
    console.log('   (Verify manually before removing)\n');
  } else {
    console.log('✅ All dependencies appear to be in use\n');
  }
} catch (error) {
  console.log('⚠️  Could not scan for unused dependencies\n');
}

// 3. Check bundle size
console.log('3️⃣  Analyzing bundle size...\n');
const nextDir = path.join(process.cwd(), '.next');

if (fs.existsSync(nextDir)) {
  try {
    execSync('node scripts/analyze-bundle.js', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  Could not analyze bundle\n');
  }
} else {
  console.log('⚠️  No build found. Run `npm run build` first.\n');
}

// 4. Optimization suggestions
console.log('\n4️⃣  Optimization Recommendations:\n');
console.log('📦 Bundle Size Reduction:');
console.log('   • Replace framer-motion with CSS animations (saves ~80-120KB)');
console.log('   • Use icon bundle instead of full lucide-react (saves ~20-30KB)');
console.log('   • Enable dynamic imports for admin pages (saves ~50-80KB)');
console.log('   • Remove unused dependencies (variable savings)');

console.log('\n⚡ Performance:');
console.log('   • Enable service worker for better caching');
console.log('   • Add blur placeholders to images');
console.log('   • Implement code splitting for routes');
console.log('   • Use adaptive loading strategies');

console.log('\n🎨 Code Quality:');
console.log('   • Run `npm run lint` to check for issues');
console.log('   • Run `npm run typecheck` to verify types');
console.log('   • Use `npm audit` to check security vulnerabilities');

// 5. Check for large files
console.log('\n5️⃣  Checking for large source files...\n');

function findLargeFiles(dir, threshold = 100) {
  const largeFiles = [];
  
  function scan(directory) {
    const files = fs.readdirSync(directory);
    
    files.forEach(file => {
      const filePath = path.join(directory, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('.next')) {
        scan(filePath);
      } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
        const sizeKB = stat.size / 1024;
        if (sizeKB > threshold) {
          largeFiles.push({
            path: filePath.replace(process.cwd(), ''),
            size: sizeKB.toFixed(2),
          });
        }
      }
    });
  }
  
  try {
    scan(dir);
    
    if (largeFiles.length > 0) {
      console.log('⚠️  Large source files found (> 100KB):');
      largeFiles.sort((a, b) => b.size - a.size);
      largeFiles.forEach(file => {
        console.log(`   ${file.size}KB - ${file.path}`);
      });
      console.log('\n   Consider splitting these files into smaller modules.\n');
    } else {
      console.log('✅ No unusually large source files found\n');
    }
  } catch (error) {
    console.log('⚠️  Could not scan for large files\n');
  }
}

findLargeFiles(srcPath);

// 6. Quick actions
console.log('\n═'.repeat(60));
console.log('\n💡 Quick Actions:\n');
console.log('# Reduce bundle size');
console.log('npm run build              # Build and analyze');
console.log('npm run analyze:deps       # Check dependencies');
console.log('npm dedupe                 # Remove duplicates');
console.log('npm prune                  # Remove unused packages');
console.log('\n# Performance testing');
console.log('npm run lighthouse         # Run performance audit');
console.log('npm run perf:full         # Complete performance check');
console.log('\n# Code quality');
console.log('npm run lint               # Check code quality');
console.log('npm run typecheck          # Verify TypeScript');
console.log('npm audit                  # Security check');

console.log('\n✅ Optimization analysis complete!\n');
