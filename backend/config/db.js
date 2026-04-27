const mongoose = require("mongoose");

const connectDB = async () => {
  const maxRetries = 5;
  const retryDelay = process.env.DB_RETRY_DELAY || 5000;
  let attempt = 0;

  if (!process.env.MONGO_URI) {
    console.error("Error: MONGO_URI is not defined in environment variables.");
    process.exit(1);
  }

  while (attempt < maxRetries) {
    try {
      attempt++;
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        // ⚡ Connection Pool Optimization for multi-connection users
        maxPoolSize: 20,              // Increase from default 10 to 20 connections
        minPoolSize: 5,               // Keep 5 connections warm
        maxIdleTimeMS: 30000,         // Close idle connections after 30s
        waitQueueTimeoutMS: 10000,    // Wait up to 10s for a connection before timing out
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,       // 45s timeout for individual operations
        connectTimeoutMS: 10000      // TCP handshake timeout (not "connectionTimeoutMS")
      });

      console.log(
        `[${new Date().toISOString()}] MongoDB Connected: ${conn.connection.host} (DB: ${conn.connection.name})`
      );
      console.log('🔌 Connection pool configured: maxPoolSize=20, minPoolSize=5');
      return;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] MongoDB Connection Attempt ${attempt} Failed: ${error.message}`
      );

      if (attempt < maxRetries) {
        console.log(`Retrying connection (${attempt}/${maxRetries}) in ${retryDelay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      } else {
        console.error("Max retries reached. Exiting...");
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;