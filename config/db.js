import mongoose from 'mongoose';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('database');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Timeout after 30s instead of 10s
      socketTimeoutMS: 45000, // Close sockets after 45s
      family: 4 // Use IPv4, skip trying IPv6
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        logger.error('Error closing MongoDB connection:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    // Implement retry logic
    setTimeout(connectDB, 5000); // Retry after 5 seconds
  }
};

export default connectDB;
