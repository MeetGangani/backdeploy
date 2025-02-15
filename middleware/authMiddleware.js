import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';

const protect = asyncHandler(async (req, res, next) => {
  let token = req.cookies.jwt;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.userId).select('-password');
      next();
    } catch (error) {
      res.status(401);
      throw new Error('Not authorized, token failed');
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
