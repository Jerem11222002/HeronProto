const mongoose = require('mongoose');

const PerformanceMetricsSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    index: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  pageUrl: {
    type: String,
    required: true,
    index: true
  },
  timestamp: { type: Date, default: Date.now, index: true },
  
  // Core Web Vitals
  metrics: {
    // Navigation Timing
    dnsTime: Number, // DNS lookup time
    tcpTime: Number, // TCP connection time
    ttfb: Number, // Time to First Byte
    responseTime: Number, // Server response time
    domLoadTime: Number, // DOM content loaded
    windowLoadTime: Number, // Full page load time
    
    // Core Web Vitals
    lcp: Number, // Largest Contentful Paint
    fid: Number, // First Input Delay
    cls: Number, // Cumulative Layout Shift
    fcp: Number, // First Contentful Paint
    ttfb: Number, // Time to First Byte
    inp: Number, // Interaction to Next Paint
    
    // Resource metrics
    totalResourceSize: Number, // bytes
    resourceCount: Number,
    imageSize: Number,
    scriptSize: Number,
    cssSize: Number,
    
    // Memory (if available)
    memoryUsed: Number, // JS heap size
    memoryTotal: Number,
    
    // Network
    connectionType: String, // 4g, 3g, wifi, etc.
    effectiveType: String,
    downlink: Number,
    rtt: Number // Round trip time
  },
  
  // Resource timing entries (simplified)
  slowResources: [{
    name: String,
    duration: Number,
    size: Number,
    type: String
  }],
  
  alerts: [{
    type: { type: String, enum: ['slow_page', 'large_resource', 'layout_shift', 'slow_interaction'] },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    message: String,
    value: Number,
    threshold: Number
  }],
  
  isAdmin: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Indexes
PerformanceMetricsSchema.index({ timestamp: -1 });
PerformanceMetricsSchema.index({ pageUrl: 1, timestamp: -1 });
PerformanceMetricsSchema.index({ 'metrics.lcp': 1 });
PerformanceMetricsSchema.index({ 'alerts.severity': 1 });

// Static methods
PerformanceMetricsSchema.statics.getAverageMetrics = async function(timeRange = 24, pageUrl = null) {
  const startDate = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  const match = { timestamp: { $gte: startDate } };
  if (pageUrl) match.pageUrl = pageUrl;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: pageUrl ? null : '$pageUrl',
        avgLCP: { $avg: '$metrics.lcp' },
        avgFID: { $avg: '$metrics.fid' },
        avgCLS: { $avg: '$metrics.cls' },
        avgFCP: { $avg: '$metrics.fcp' },
        avgLoadTime: { $avg: '$metrics.windowLoadTime' },
        avgTTFB: { $avg: '$metrics.ttfb' },
        count: { $sum: 1 },
        slowPages: {
          $sum: { $cond: [{ $gt: ['$metrics.windowLoadTime', 3000] }, 1, 0] }
        }
      }
    }
  ]);
};

PerformanceMetricsSchema.statics.getPerformanceTrends = async function(hours = 24) {
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: {
          hour: { $hour: '$timestamp' },
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
        },
        avgLoadTime: { $avg: '$metrics.windowLoadTime' },
        avgLCP: { $avg: '$metrics.lcp' },
        count: { $sum: 1 },
        loadTimes: { $push: '$metrics.windowLoadTime' }
      }
    },
    { $sort: { '_id.date': 1, '_id.hour': 1 } }
  ]);
};

module.exports = mongoose.model('PerformanceMetrics', PerformanceMetricsSchema);
