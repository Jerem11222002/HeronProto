/**
 * Exponential backoff retry utility for handling MongoDB timeouts and connection pool exhaustion
 * 
 * When MongoDB pool is exhausted, retrying immediately causes more timeouts.
 * Exponential backoff gives the pool time to recover while preventing cascade failures.
 */

async function retryWithBackoff(
  operation,
  maxRetries = 3,
  initialDelayMs = 100,
  operation_name = 'database operation'
) {
  let lastError;
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStartTime = Date.now();
    try {
      console.log(`[RETRY] Attempt ${attempt}/${maxRetries} for: ${operation_name}`);
      
      const result = await operation();
      
      const attemptDuration = Date.now() - attemptStartTime;
      console.log(`[RETRY] ✅ Success on attempt ${attempt} (${attemptDuration}ms): ${operation_name}`);
      return result;
    } catch (error) {
      const attemptDuration = Date.now() - attemptStartTime;
      console.error(
        `[RETRY] ❌ Attempt ${attempt}/${maxRetries} failed (${attemptDuration}ms): ${operation_name}\n` +
        `        Error: ${error.message}`
      );
      
      lastError = error;
      
      // Don't retry on validation errors
      if (error.message?.includes('Invalid') || error.message?.includes('validation')) {
        console.error(`[RETRY] 🛑 Non-retryable error (validation): ${error.message}`);
        throw error;
      }

      // Check if it's a timeout/connection error worth retrying
      const isRetryable = 
        error.message?.includes('timed out') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('pool') ||
        error.name === 'MongoNetworkTimeoutError' ||
        error.name === 'MongoServerError';

      if (!isRetryable || attempt === maxRetries) {
        const totalDuration = Date.now() - startTime;
        console.error(
          `[RETRY] 🔴 FINAL FAILURE after ${attempt} attempt(s) (${totalDuration}ms total): ${operation_name}\n` +
          `        Error: ${error.message}\n` +
          `        Type: ${error.name}`
        );
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms, etc.
      const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
      console.log(
        `[RETRY] ⏳ Waiting ${delayMs}ms before retry ${attempt + 1}/${maxRetries}...`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const totalDuration = Date.now() - startTime;
  console.error(
    `[RETRY] 💥 All ${maxRetries} retries exhausted (${totalDuration}ms total): ${operation_name}\n` +
    `        Last error: ${lastError?.message}`
  );
  throw lastError;
}

module.exports = { retryWithBackoff };
