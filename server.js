import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import cookieParser from 'cookie-parser';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import userRoutes from './routes/userRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import fileUploadRoutes from './routes/fileUploadRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import examRoutes from './routes/examRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import passport from 'passport';
import session from 'express-session';
import User from './models/userModel.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { createLogger } from './utils/logger.js';
import cors from 'cors';
import MongoStore from 'connect-mongo';
import proxyRoutes from './routes/proxyRoutes.js';

const logger = createLogger('server');
dotenv.config();

const app = express();
 
const startServer = async () => {
  try {
    await connectDB();
    
    app.use(helmet());
    app.use(mongoSanitize());

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many requests from this IP, please try again later'
    });
    app.use('/api/', limiter);

    const corsOptions = {
      origin: [
        'https://nexusedu-jade.vercel.app',
        'http://localhost:3000',
        'https://nexusedu-meetgangani56-gmailcoms-projects.vercel.app'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-CSRF-Token',
        'X-Auth-Token',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Methods',
        'Access-Control-Allow-Headers'
      ],
      exposedHeaders: ['Set-Cookie', 'Authorization'],
      optionsSuccessStatus: 200,
      maxAge: 86400 // 24 hours
    };
    
    // Apply CORS middleware before other middleware
    app.use(cors(corsOptions));
    
    // Enable pre-flight requests for all routes
    app.options('*', cors(corsOptions));

    // Add CORS debugging middleware
    app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      logger.debug('Request Headers:', req.headers);
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        logger.debug('Handling OPTIONS request');
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
        return res.status(200).send();
      }
      
      next();
    });

    // Increase payload limit for file uploads
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    if (process.env.NODE_ENV === 'production') {
      app.set('trust proxy', 1);
    }
 
    app.use(cookieParser());

    app.use(session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60
      }),
      cookie: {
        secure: true, // Required for cross-origin cookies
        sameSite: 'None', // Allows cross-origin requests
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        path: '/'
      }
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser(async (id, done) => {
      try {
        const user = await User.findById(id);
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      app.use((req, res, next) => {
        logger.debug(`${req.method} ${req.originalUrl}`);
        next();
      });
    }

    app.use('/api/users', userRoutes);
    app.use('/api/files', fileRoutes);
    app.use('/api/upload', fileUploadRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/exams', examRoutes);
    app.use('/api/contact', contactRoutes);
    app.use('/api/proxy', proxyRoutes);
    app.use('/api', uploadRoutes);

    app.get('/', (req, res) => res.json({ message: 'API is running' }));

    app.use(errorHandler);

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

export default app;