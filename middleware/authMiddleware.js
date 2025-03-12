import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Session from '../models/sessionModel.js';

const protect = asyncHandler(async (req, res, next) => {
  let token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get the user
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        res.status(401);
        throw new Error('User not found');
      }
      
      // Set the user in the request
      req.user = user;
      
      // Get IP and device info for session tracking
      const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                req.connection.remoteAddress;
      const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
      
      // For students, check if there's already an active session with a different token
      if (user.userType === 'student') {
        // Find the current session
        const currentSession = await Session.findOne({ 
          token,
          isActive: true
        });
        
        // If no current session exists, check if there are other active sessions
        if (!currentSession) {
          const activeSessions = await Session.find({
            userId: user._id,
            isActive: true
          });
          
          if (activeSessions.length > 0) {
            res.status(401);
            throw new Error('You are already logged in on another device. Please log out from there first.');
          }
          
          // Create a new session record
          await Session.create({
            userId: user._id,
            token,
            deviceInfo,
            ipAddress: ip,
            isActive: true
          });
        } else {
          // Update last activity time
          currentSession.lastActivity = new Date();
          await currentSession.save();
        }
      }
      
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401);
      throw new Error(error.message || 'Not authorized, token failed');
    }
  } else {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

const adminOnly = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.userType === 'admin') {
    next();
  } else {
    console.log('User attempting admin access:', req.user);
    res.status(403);
    throw new Error('Not authorized as an admin');
  }
});

const instituteOnly = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.userType === 'institute') {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized as an institute');
  }
});

const studentOnly = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.userType === 'student') {
    next();
  } else {
    res.status(403);
    throw new Error('Not authorized as a student');
  }
});

export { protect, adminOnly, instituteOnly, studentOnly };
