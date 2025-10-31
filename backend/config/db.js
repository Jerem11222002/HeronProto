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
        serverSelectionTimeoutMS: 5000, // ✅ Cleaned options
      });

      console.log(
        `[${new Date().toISOString()}] MongoDB Connected: ${conn.connection.host} (DB: ${conn.connection.name})`
      );
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