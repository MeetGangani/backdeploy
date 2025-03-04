import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import OTP from '../models/otpModel.js';
import generateToken from '../utils/generateToken.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { welcomeEmailTemplate, loginNotificationTemplate, instituteGuidelinesTemplate, otpEmailTemplate } from '../utils/emailTemplates.js';
import sendEmail from '../utils/emailUtils.js';
import * as UAParser from 'ua-parser-js';
import axios from 'axios';

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
  const parser = new UAParser.UAParser(userAgent);
  const result = parser.getResult();
  return `${result.browser.name || 'Unknown browser'} on ${result.os.name || 'Unknown OS'}`;
};

// Modified getLocationInfo function to include city and state
const getLocationInfo = async (ip) => {
  try {
    // First attempt with ipapi.co
    const response = await axios.get(`https://ipapi.co/${ip}/json/`, {
      timeout: 3000,
      headers: {
        'User-Agent': 'NexusEdu/1.0'
      }
    });

    // Check if we got rate limited
    if (response.data.error && response.data.reason === 'RateLimited') {
      throw new Error('Rate limited');
    }

    // Extract all location data
    const locationData = {
      city: response.data.city || 'Unknown City',
      state: response.data.region || 'Unknown State',
      country: response.data.country_name || 'Unknown Country',
      ip: ip
    };

    // Log the response for debugging
    console.log('Location API Response:', response.data);
    console.log('Parsed Location Data:', locationData);

    return locationData;
  } catch (error) {
    console.log('Location lookup error:', error.message);
    
    // Fallback with default values
    return {
      city: 'Unknown City',
      state: 'Unknown State',
      country: 'Location Unavailable',
      ip: ip
    };
  }
};

// @desc    Auth user & get token
// @route   POST /api/users/auth
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      if (user.userType === 'institute' || user.userType === 'admin') {
        try {
          const device = getDeviceInfo(req.headers['user-agent']);
          const time = new Date().toLocaleString('en-US', { 
            timeZone: 'Asia/Kolkata',
            dateStyle: 'long',
            timeStyle: 'medium'
          });
          
          // Get IP address
          const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                    req.connection.remoteAddress;
          
          // Get location info
          const locationInfo = await getLocationInfo(ip);

          await sendEmail({
            to: email,
            subject: 'New Login to Your NexusEdu Account',
            html: loginNotificationTemplate({
              name: user.name,
              time,
              location: locationInfo,
              device
            })
          });
        } catch (notificationError) {
          console.error('Login notification error:', notificationError);
        }
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
    res.status(error.status || 500);
    throw new Error(error.message || 'Login failed');
  }
});

// @desc    Send OTP for email verification
// @route   POST /api/users/send-otp
// @access  Public
const sendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Check if email already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store OTP in database with expiration
  await OTP.findOneAndUpdate(
    { email },
    { 
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
    },
    { upsert: true, new: true }
  );

  // Send OTP email
  try {
    await sendEmail({
      to: email,
      subject: 'Verify your email for NexusEdu',
      html: otpEmailTemplate({
        otp,
        email
      })
    });

    res.status(200).json({ 
      message: 'OTP sent successfully',
      email 
    });
  } catch (error) {
    res.status(500);
    throw new Error('Failed to send OTP email');
  }
});

// @desc    Verify OTP
// @route   POST /api/users/verify-otp
// @access  Public
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const otpRecord = await OTP.findOne({ 
    email,
    expiresAt: { $gt: new Date() }
  });

  if (!otpRecord) {
    res.status(400);
    throw new Error('OTP expired or not found');
  }

  if (otpRecord.otp !== otp) {
    res.status(400);
    throw new Error('Invalid OTP');
  }

  // Delete the OTP record after successful verification
  await OTP.deleteOne({ email });

  res.status(200).json({ 
    message: 'Email verified successfully',
    verified: true 
  });
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

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      userType,
    });

    if (user) {
      // Send appropriate welcome email based on user type
      try {
        if (userType === 'institute') {
          // Send both welcome and guidelines emails for institutes
          await Promise.all([
            sendEmail({
              to: email,
              subject: 'Welcome to NexusEdu!',
              html: welcomeEmailTemplate({
                name,
                userType
              })
            }),
            sendEmail({
              to: email,
              subject: 'NexusEdu - Question Paper Guidelines',
              html: instituteGuidelinesTemplate({
                name
              })
            })
          ]);
        } else {
          // Send only welcome email for other user types
          await sendEmail({
            to: email,
            subject: 'Welcome to NexusEdu!',
            html: welcomeEmailTemplate({
              name,
              userType
            })
          });
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }

      // Generate token if it's a regular registration
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
  sendOTP,
  verifyOTP,
};
