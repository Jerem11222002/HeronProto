/**
 * MongoDB Cluster Health & Usage Diagnostic
 * 
 * Checks:
 * 1. Cluster tier and limits
 * 2. Database storage usage
 * 3. Collection sizes
 * 4. Index health
 * 5. Connection pool status
 * 6. Query performance stats
 */

const mongoose = require('mongoose');
require('dotenv').config();

const log = {
  info: (msg) => console.log(`\x1b[34mℹ\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m✗\x1b[0m ${msg}`),
  section: (msg) => console.log(`\n\x1b[36m${msg}\x1b[0m`),
  metric: (label, value, unit = '') => {
    const formatted = typeof value === 'number' ? value.toLocaleString() : value;
    console.log(`   ${label}: \x1b[35m${formatted}${unit}\x1b[0m`);
  }
};

async function runDiagnostic() {
  try {
    log.section('=== MONGODB CLUSTER HEALTH & USAGE DIAGNOSTIC ===\n');
    
    // 1. Display connection string info
    log.section('1. CONNECTION INFO');
    const uri = process.env.MONGO_URI;
    if (!uri) {
      log.error('MONGO_URI not found in .env');
      return;
    }
    
    // Extract cluster name from URI
    const clusterMatch = uri.match(/mongodb\+srv:\/\/[^:]+:[^@]+@([^.]+)/);
    const clusterName = clusterMatch ? clusterMatch[1] : 'Unknown';
    
    log.metric('Cluster', clusterName);
    log.metric('Connection Type', 'MongoDB Atlas (Cloud)');
    
    // 2. Connect to MongoDB
    log.info('Connecting to MongoDB...');
    await mongoose.connect(uri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000
    });
    log.success('Connected successfully');
    
    const db = mongoose.connection.db;
    
    // 3. Get server info
    log.section('\n2. SERVER INFORMATION');
    try {
      const serverStatus = await db.admin().serverStatus();
      log.metric('MongoDB Version', serverStatus.version);
      log.metric('Process ID', serverStatus.pid);
      log.metric('Uptime', `${Math.floor(serverStatus.uptime / 3600)} hours`);
      log.metric('Current Connections', serverStatus.connections?.current);
      log.metric('Available Connections', serverStatus.connections?.available);
      
      // Check if near connection limit
      const currentConn = serverStatus.connections?.current || 0;
      const availableConn = serverStatus.connections?.available || 0;
      const totalConn = currentConn + availableConn;
      const connUsage = ((currentConn / totalConn) * 100).toFixed(1);
      
      log.metric('Connection Usage', `${connUsage}%`);
      
      if (connUsage > 80) {
        log.warn(`⚠️  Connection pool usage is HIGH (${connUsage}%)`);
        log.warn('   This could cause slowness - consider upgrading cluster');
      }
    } catch (error) {
      log.warn(`Server status unavailable: ${error.message}`);
    }
    
    // 4. Get database statistics
    log.section('\n3. DATABASE SIZE & STORAGE');
    try {
      const stats = await db.stats();
      const dataSize = (stats.dataSize / (1024 * 1024)).toFixed(2); // MB
      const indexSize = (stats.indexSize / (1024 * 1024)).toFixed(2); // MB
      const totalSize = ((stats.dataSize + stats.indexSize) / (1024 * 1024)).toFixed(2); // MB
      const storageSize = (stats.storageSize / (1024 * 1024)).toFixed(2); // MB
      
      log.metric('Data Size', dataSize, ' MB');
      log.metric('Index Size', indexSize, ' MB');
      log.metric('Total Used', totalSize, ' MB');
      log.metric('Storage Size', storageSize, ' MB');
      log.metric('Collections', stats.collections);
      
      // FREE TIER LIMIT CHECK
      log.section('\n4. FREE TIER LIMIT CHECK');
      const freeLimit = 512; // MB
      const usagePercent = ((totalSize / freeLimit) * 100).toFixed(1);
      
      log.metric('Free Tier Limit', freeLimit, ' MB');
      log.metric('Current Usage', totalSize, ' MB');
      log.metric('Usage %', usagePercent, '%');
      
      if (totalSize > freeLimit) {
        log.error(`❌ OVER LIMIT: Using ${totalSize}MB of ${freeLimit}MB allowed`);
        log.error(`   You are ${(totalSize - freeLimit).toFixed(2)}MB OVER the free tier limit!`);
        log.warn('\n   LIKELY CAUSE OF SLOWNESS:');
        log.warn('   • Queries are throttled when over limit');
        log.warn('   • Connection timeouts');
        log.warn('   • Query timeouts and hangs');
        log.warn('   • High latency');
        log.warn('\n   SOLUTION: Upgrade to paid cluster or delete old data');
      } else if (totalSize > freeLimit * 0.9) {
        log.warn(`⚠️  APPROACHING LIMIT: ${usagePercent}% of free tier used`);
        log.warn('   Consider upgrading or cleaning up old data');
      } else {
        log.success(`✓ Well within limits (${usagePercent}% used)`);
      }
    } catch (error) {
      log.warn(`Database stats unavailable: ${error.message}`);
    }
    
    // 5. Get collection sizes
    log.section('\n5. COLLECTION SIZES');
    try {
      const collections = await db.listCollections().toArray();
      const collectionStats = [];
      
      for (const collection of collections) {
        const stats = await db.collection(collection.name).stats();
        const size = (stats.size / (1024 * 1024)).toFixed(2);
        const indexSize = (stats.totalIndexSize / (1024 * 1024)).toFixed(2);
        const count = stats.count;
        
        collectionStats.push({
          name: collection.name,
          size: parseFloat(size),
          indexSize: parseFloat(indexSize),
          count: count
        });
      }
      
      // Sort by size
      collectionStats.sort((a, b) => b.size - a.size);
      
      for (const stat of collectionStats) {
        console.log(`   ${stat.name}:`);
        console.log(`      Size: \x1b[35m${stat.size} MB\x1b[0m (${stat.count} documents)`);
        console.log(`      Indexes: \x1b[35m${stat.indexSize} MB\x1b[0m`);
      }
      
      // Find largest collection
      if (collectionStats.length > 0) {
        log.warn(`\n   Largest collection: ${collectionStats[0].name} (${collectionStats[0].size} MB)`);
      }
    } catch (error) {
      log.warn(`Collection stats unavailable: ${error.message}`);
    }
    
    // 6. Check indexes
    log.section('\n6. INDEX HEALTH');
    try {
      const collections = await db.listCollections().toArray();
      let totalIndexes = 0;
      let duplicateIndexes = 0;
      
      for (const collection of collections) {
        const indexes = await db.collection(collection.name).getIndexes();
        totalIndexes += indexes.length;
        
        // Check for duplicate indexes
        const indexKeys = new Set();
        for (const index of indexes) {
          const key = JSON.stringify(index.key);
          if (indexKeys.has(key)) {
            duplicateIndexes++;
          }
          indexKeys.add(key);
        }
      }
      
      log.metric('Total Indexes', totalIndexes);
      log.metric('Duplicate Indexes', duplicateIndexes);
      
      if (duplicateIndexes > 0) {
        log.warn(`⚠️  Found ${duplicateIndexes} duplicate/redundant indexes`);
        log.warn('   These waste storage space - consider removing them');
      }
    } catch (error) {
      log.warn(`Index check unavailable: ${error.message}`);
    }
    
    // 7. Performance recommendations
    log.section('\n7. RECOMMENDATIONS');
    
    try {
      const stats = await db.stats();
      const totalSize = (stats.dataSize + stats.indexSize) / (1024 * 1024);
      
      if (totalSize > 512) {
        log.error('🔴 CRITICAL: Over free tier limit');
        log.info('   1. Upgrade to M2 (paid) - $0.10/hour');
        log.info('   2. Or: Delete old/unused data');
        log.info('   3. Or: Archive data to separate collection');
      } else if (totalSize > 460) {
        log.warn('🟡 WARNING: Approaching limit');
        log.info('   1. Monitor storage usage');
        log.info('   2. Consider upgrading proactively');
        log.info('   3. Clean up old/test data');
      } else if (totalSize > 400) {
        log.warn('🟡 CAUTION: Using significant storage');
        log.info('   1. Keep monitoring');
        log.info('   2. Plan for future growth');
      } else {
        log.success('🟢 Healthy: Well within free tier');
      }
    } catch (error) {
      log.warn('Could not generate recommendations');
    }
    
    // 8. Final summary
    log.section('\n8. SUMMARY');
    try {
      const stats = await db.stats();
      const totalSize = ((stats.dataSize + stats.indexSize) / (1024 * 1024)).toFixed(2);
      const usagePercent = ((totalSize / 512) * 100).toFixed(1);
      
      if (totalSize > 512) {
        log.error(`\n❌ DATABASE OVER LIMIT\n`);
        log.error(`   Current size: ${totalSize} MB`);
        log.error(`   Free tier limit: 512 MB`);
        log.error(`   EXCESS: ${(totalSize - 512).toFixed(2)} MB`);
        log.error(`\n   THIS IS ALMOST CERTAINLY CAUSING THE SLOWNESS!\n`);
        log.warn('ACTION REQUIRED:');
        log.info('   • Upgrade cluster to M2 (paid tier)');
        log.info('   • Delete unnecessary old data');
        log.info('   • Archive data to separate collection');
      } else {
        log.success(`\n✓ Storage healthy: ${usagePercent}% of limit used\n`);
        log.info('   Slowness likely due to other factors:');
        log.info('   • Query optimization (addressed with aggregation pipelines)');
        log.info('   • Caching (being implemented)');
        log.info('   • Connection pooling (check connection count above)');
      }
    } catch (error) {
      log.warn('Could not generate final summary');
    }
    
  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    log.info('\nDisconnected from MongoDB');
  }
}

runDiagnostic();
