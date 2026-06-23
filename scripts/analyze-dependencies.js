#!/usr/bin/env node

/**
 * Dependency Analysis Script
 * 
 * Analyzes package.json dependencies and suggests optimizations
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log('\n📦 Dependency Analysis\n');

const dependencies = packageJson.dependencies || {};
const devDependencies = packageJson.devDependencies || {};

console.log('📊 Production Dependencies:\n');
Object.entries(dependencies).forEach(([name, version]) => {
  const size = estimatePackageSize(name);
  const emoji = size > 100 ? '🔴' : size > 50 ? '🟡' : '🟢';
  console.log(`${emoji} ${name}@${version} (est. ${size}KB)`);
});

console.log('\n🔍 Optimization Suggestions:\n');

// Check for heavy dependencies
const heavyDeps = {
  'framer-motion': {
    suggestion: 'Consider lazy loading or using CSS animations for simpler cases',
    alternative: '@react-spring/web (lighter alternative)',
  },
  'lodash': {
    suggestion: 'Import specific functions instead of the entire library',
    alternative: 'lodash-es with tree-shaking',
  },
  'moment': {
    suggestion: 'Replace with date-fns or dayjs for smaller bundle size',
    alternative: 'date-fns or dayjs',
  },
  '@material-ui/core': {
    suggestion: 'Consider using headless UI libraries',
    alternative: '@headlessui/react',
  },
};

let foundHeavy = false;
Object.keys(dependencies).forEach((dep) => {
  if (heavyDeps[dep]) {
    foundHeavy = true;
    console.log(`⚠️  ${dep}:`);
    console.log(`   ${heavyDeps[dep].suggestion}`);
    console.log(`   Alternative: ${heavyDeps[dep].alternative}\n`);
  }
});

if (!foundHeavy) {
  console.log('✅ No heavy dependencies detected requiring immediate optimization\n');
}

// Check for potential duplicates
console.log('🔄 Checking for duplicate functionality:\n');
const functionalityGroups = {
  'UI Components': ['@radix-ui', '@headlessui', '@material-ui', 'react-bootstrap'],
  'Animation': ['framer-motion', 'react-spring', 'gsap', 'anime'],
  'Forms': ['react-hook-form', 'formik', 'react-final-form'],
  'State Management': ['zustand', 'redux', 'mobx', 'jotai', 'recoil'],
  'Date': ['moment', 'date-fns', 'dayjs', 'luxon'],
  'Utilities': ['lodash', 'ramda', 'underscore'],
};

Object.entries(functionalityGroups).forEach(([category, libs]) => {
  const found = libs.filter(lib => 
    Object.keys(dependencies).some(dep => dep.includes(lib))
  );
  if (found.length > 1) {
    console.log(`⚠️  Multiple ${category} libraries: ${found.join(', ')}`);
    console.log(`   Consider consolidating to one library\n`);
  }
});

// Check for unused peer dependencies
console.log('\n🔍 Development Dependencies:\n');
Object.entries(devDependencies).forEach(([name, version]) => {
  console.log(`   ${name}@${version}`);
});

console.log('\n💡 General Recommendations:\n');
console.log('1. Run `npm dedupe` to remove duplicate dependencies');
console.log('2. Use `npm prune` to remove unused dependencies');
console.log('3. Consider using `webpack-bundle-analyzer` for detailed analysis');
console.log('4. Check for updated versions with `npm outdated`');
console.log('5. Use dynamic imports for large dependencies\n');

console.log('✅ Analysis complete!\n');

// Estimate package size (rough approximation)
function estimatePackageSize(packageName) {
  const sizeMap = {
    'next': 120,
    'react': 40,
    'react-dom': 130,
    'framer-motion': 180,
    'lucide-react': 60,
    'zustand': 5,
    'zod': 15,
    'react-hook-form': 45,
    '@hookform/resolvers': 10,
    'tailwind-merge': 5,
    'clsx': 2,
    'class-variance-authority': 8,
    'bcryptjs': 25,
    'jsonwebtoken': 30,
    'cookie': 3,
    'dotenv': 5,
  };
  return sizeMap[packageName] || 20;
}
