/**
 * Request Timing Middleware
 * Logs the response time for each API request to identify bottlenecks
 * Particularly useful for diagnosing slow queries on multi-connection users
 */

const requestTiming = (req, res, next) => {
  // Start timer
  const startTime = Date.now();
  const startHR = process.hrtime();
  let hasLogged = false; // Prevent double-logging

  // Helper function to log timing
  const logTiming = () => {
    if (hasLogged) return; // Only log once
    hasLogged = true;

    const duration = Date.now() - startTime;
    const [seconds, nanoseconds] = process.hrtime(startHR);
    const durationMs = seconds * 1000 + nanoseconds / 1000000;

    // Determine severity level
    let severity = '✅';
    if (durationMs > 5000) severity = '🔴'; // >5s = RED
    else if (durationMs > 2000) severity = '🟠'; // >2s = ORANGE
    else if (durationMs > 1000) severity = '🟡'; // >1s = YELLOW

    // Extract useful info
    const method = req.method;
    const url = req.originalUrl;
    const userId = req.user ? req.user._id : 'anonymous';
    const statusCode = res.statusCode;

    // Log the timing
    console.log(
      `${severity} [${duration}ms] ${method} ${url} | User: ${userId} | Status: ${statusCode}`
    );

    // If very slow, log additional context
    if (durationMs > 2000) {
      console.log(
        `⚠️  SLOW REQUEST: ${method} ${url} took ${durationMs.toFixed(2)}ms`
      );
      if (req.query && Object.keys(req.query).length > 0) {
        console.log(`   Query params:`, req.query);
      }
      if (req.body && Object.keys(req.body).length > 0) {
        console.log(`   Body keys:`, Object.keys(req.body));
      }
    }
  };

  // Override res.json to capture response time before sending
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    logTiming();
    return originalJson(data);
  };

  // Override res.send for non-JSON responses
  const originalSend = res.send.bind(res);
  res.send = function(data) {
    logTiming();
    return originalSend(data);
  };

  next();
};

module.exports = requestTiming;
