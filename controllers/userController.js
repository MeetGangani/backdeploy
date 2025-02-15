import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import generateToken from '../utils/generateToken.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { welcomeEmailTemplate, loginNotificationTemplate } from '../utils/emailTemplates.js';
import sendEmail from '../utils/emailUtils.js';
import UAParser from 'ua-parser-js';

dotenv.config();

// Passport serialization
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.NODE_ENV === 'production'
        ? 'https://backdeploy-9bze.onrender.com/api/users/auth/google/callback'
        : 'http://localhost:5000/api/users/auth/google/callback',
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          // Create new user if doesn't exist
          user = await User.create({
            name: profile.displayName,
            email: profile.emails[0].value,
            password: 'google-auth', // You might want to handle this differently
            userType: 'student',
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Google Auth Routes
const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account'
});

const googleCallback = async (req, res) => {
  try {
    const frontendURL = process.env.NODE_ENV === 'production'
      ? 'https://nexusedu-jade.vercel.app'
      : 'http://localhost:3000';

    if (req.user) {
      // Generate JWT token
      generateToken(res, req.user._id);
      
      // Redirect with success
      res.redirect(`${frontendURL}/register?loginSuccess=true`);
    } else {
      res.redirect(`${frontendURL}/register?error=${encodeURIComponent('Google authentication failed')}`);
    }
  } catch (error) {
    console.error('Google callback error:', error);
    const frontendURL = process.env.NODE_ENV === 'production'
      ? 'https://nexusedu-jade.vercel.app'
      : 'http://localhost:3000';
    res.redirect(`${frontendURL}/register?error=${encodeURIComponent(error.message)}`);
  }
};

// Helper function to get device info
const getDeviceInfo = (userAgent) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  return `${result.browser.name} on ${result.os.name}`;
};

// @desc    Auth user & get token
// @route   POST /api/users/auth
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      // Get device and location info
      const device = getDeviceInfo(req.headers['user-agent']);
      const time = new Date().toLocaleString();
      const location = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      // Send login notification
      try {
        await sendEmail({
          to: email,
          subject: 'New Login to Your NexusEdu Account',
          html: loginNotificationTemplate({
            name: user.name,
            time,
            location,
            device
          })
        });
      } catch (emailError) {
        console.error('Login notification email error:', emailError);
      }

      generateToken(res, user._id);

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
      });
    } else {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    res.status(500);
    throw new Error(error.message || 'Login failed');
  }
});

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, userType } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    const user = await User.create({
      name,
      email,
      password,
      userType,
    });

    if (user) {
      // Send welcome email
      try {
        await sendEmail({
          to: email,
          subject: 'Welcome to NexusEdu!',
          html: welcomeEmailTemplate({
            name,
            userType
          })
        });
      } catch (emailError) {
        console.error('Welcome email error:', emailError);
      }

      // Only generate token if it's a regular registration
      if (!req.user || req.user.userType !== 'admin') {
        generateToken(res, user._id);
      }

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    res.status(500);
    throw new Error(error.message || 'Failed to create user');
  }
});

// @desc    Logout user / clear cookie
// @route   POST /api/users/logout
// @access  Public
const logoutUser = asyncHandler(async (req, res) => {
  try {
    // Clear the JWT cookie
    res.cookie('jwt', '', {
      httpOnly: true,
      expires: new Date(0),
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/'
    
    });

    // Clear session if it exists
    if (req.session) {
      await new Promise((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) reject(err);
          resolve();
        });
      });
    }

    res.status(200).json({ 
      message: 'Logged out successfully',
      success: true 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500);
    throw new Error('Error during logout');
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      userType: user.userType,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.userType = req.body.userType || user.userType;

    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      userType: updatedUser.userType,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Check user authentication status
// @route   GET /api/users/check-auth
// @access  Public
const checkAuth = asyncHandler(async (req, res) => {
  try {
    const token = req.cookies.jwt;
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is blacklisted (if you implement a blacklist)
    // const isBlacklisted = await BlacklistedToken.findOne({ token });
    // if (isBlacklisted) {
    //   return res.status(401).json({ message: 'Token is no longer valid' });
    // }

    // Get user data
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      userType: user.userType,
    });
  } catch (error) {
    console.error('Check auth error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

export {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  googleAuth,
  googleCallback,
  checkAuth,
};
