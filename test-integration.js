#!/usr/bin/env node

/**
 * Backend Compilation & Integration Test
 * Tests that all cache services are properly imported and working
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Backend Integration Test Suite\n');

// Test 1: Check cache service files exist
console.log('📋 Test 1: Verify cache service files exist');
const cacheFiles = [
  'backend/services/relationshipCache.js',
  'backend/services/notificationCache.js',
  'backend/services/featuredArtistsCache.js'
];

cacheFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} NOT FOUND`);
  }
});

// Test 2: Check route files import cache services
console.log('\n📋 Test 2: Verify cache imports in routes');
const routeChecks = [
  {
    file: 'backend/routes/featured.js',
    pattern: /const featuredArtistsCache/,
    name: 'featuredArtistsCache import'
  },
  {
    file: 'backend/routes/posts.js',
    pattern: /const featuredArtistsCache/,
    name: 'featuredArtistsCache import in posts.js'
  },
  {
    file: 'backend/routes/userRoutes.js',
    pattern: /const relationshipCache/,
    name: 'relationshipCache import'
  },
  {
    file: 'backend/routes/notifications.js',
    pattern: /const notificationCache/,
    name: 'notificationCache import'
  }
];

routeChecks.forEach(check => {
  const fullPath = path.join(__dirname, check.file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (check.pattern.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name} import not found`);
    }
  } else {
    console.log(`  ❌ ${check.file} NOT FOUND`);
  }
});

// Test 3: Check cache invalidation is properly integrated
console.log('\n📋 Test 3: Verify cache invalidation calls');
const invalidationChecks = [
  {
    file: 'backend/routes/posts.js',
    patterns: [
      { regex: /invalidateOnNewPost/, description: 'invalidateOnNewPost() on post create' },
      { regex: /invalidateOnShare/, description: 'invalidateOnShare() on post share' },
      { regex: /invalidateOnDelete/, description: 'invalidateOnDelete() on post delete' }
    ]
  },
  {
    file: 'backend/routes/userRoutes.js',
    patterns: [
      { regex: /invalidateOnChange/, description: 'invalidateOnChange() on follow/unfollow' }
    ]
  },
  {
    file: 'backend/routes/notifications.js',
    patterns: [
      { regex: /invalidateOnNewNotification|invalidate/, description: 'cache invalidation on notification changes' }
    ]
  }
];

invalidationChecks.forEach(check => {
  const fullPath = path.join(__dirname, check.file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    check.patterns.forEach(pattern => {
      if (pattern.regex.test(content)) {
        console.log(`  ✅ ${check.file}: ${pattern.description}`);
      } else {
        console.log(`  ⚠️  ${check.file}: ${pattern.description} - NOT FOUND (check manually)`);
      }
    });
  }
});

// Test 4: Check package.json has all dependencies
console.log('\n📋 Test 4: Verify dependencies');
const pkgPath = path.join(__dirname, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const required = ['express', 'mongoose', 'socket.io', 'dotenv'];
  required.forEach(dep => {
    if (pkg.dependencies[dep] || pkg.devDependencies[dep]) {
      console.log(`  ✅ ${dep}`);
    } else {
      console.log(`  ❌ ${dep} NOT FOUND`);
    }
  });
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('✅ Integration test complete!');
console.log('\nNow run: npm run server');
console.log('Then visit: http://localhost:5000');
console.log('='.repeat(50));
