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
import Session from '../models/sessionModel.js';

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
  const { email, password, forceLogin } = req.body;

  try {
    // Check if email is provided
    if (!email) {
      res.status(400);
      throw new Error('Email address is required');
    }

    // Check if password is provided
    if (!password) {
      res.status(400);
      throw new Error('Password is required');
    }

    // Find the user by email
    const user = await User.findOne({ email });

    // If user doesn't exist
    if (!user) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // If user exists and password matches
    if (user && isMatch) {
      // For students, check if there's already an active session
      if (user.userType === 'student' && !forceLogin) {
        const activeSessions = await Session.find({
          userId: user._id,
          isActive: true
        });
        
        if (activeSessions.length > 0) {
          // Get device info from the active session
          const deviceInfo = activeSessions[0].deviceInfo || 'another device';
          const deviceType = deviceInfo.includes('Mobile') ? 'mobile device' : 'computer';
          
          res.status(401);
          throw new Error(`You are already logged in on another ${deviceType}. Please log out from there first or use the option to log out other sessions.`);
        }
      }
      
      // For institutes and admins, send login notification
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

      // If forceLogin is true, deactivate all other sessions
      if (forceLogin) {
        const deactivatedCount = await Session.updateMany(
          { userId: user._id, isActive: true },
          { isActive: false }
        );
        
        console.log(`Deactivated ${deactivatedCount.modifiedCount} active sessions for user ${user._id}`);
      }

      // Generate token
      const token = generateToken(res, user._id);
      
      // For students, create a session record
      if (user.userType === 'student') {
        const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                  req.connection.remoteAddress;
        
        await Session.create({
          userId: user._id,
          token,
          deviceInfo,
          ipAddress: ip,
          isActive: true
        });
        
        console.log(`Created new session for student ${user._id} on device: ${deviceInfo.substring(0, 50)}...`);
      }

      // Update last login time
      user.lastLogin = new Date();
      await user.save();

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
      });
    }
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(error.status || 500);
    throw new Error(error.message || 'Login failed. Please try again later.');
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
    const token = req.cookies.jwt;
    let sessionInfo = null;
    
    // If there's a token, deactivate the session
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user info for the response
        const user = await User.findById(decoded.userId).select('name userType');
        
        // Find and deactivate the session
        const session = await Session.findOne({
          userId: decoded.userId,
          token,
          isActive: true
        });
        
        if (session) {
          sessionInfo = {
            deviceInfo: session.deviceInfo,
            lastActivity: session.lastActivity
          };
          
          // Deactivate the session
          session.isActive = false;
          await session.save();
          
          console.log(`Session deactivated for user ${decoded.userId}`);
        } else {
          // Deactivate any sessions that might exist with this token
          const result = await Session.updateMany(
            { 
              userId: decoded.userId,
              token,
              isActive: true
            },
            { 
              isActive: false
            }
          );
          
          console.log(`Deactivated ${result.modifiedCount} sessions for user ${decoded.userId}`);
        }
      } catch (tokenError) {
        console.error('Token verification error during logout:', tokenError);
      }
    }
    
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

    // Prepare response message
    let message = 'Logged out successfully';
    if (sessionInfo) {
      const deviceType = sessionInfo.deviceInfo.includes('Mobile') ? 'mobile device' : 'computer';
      const lastActive = new Date(sessionInfo.lastActivity).toLocaleString();
      message = `Logged out successfully from your ${deviceType}. Last activity: ${lastActive}`;
    }

    res.status(200).json({ 
      message,
      success: true 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500);
    throw new Error('Error during logout. Please try again.');
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

// @desc    Force logout from other devices
// @route   POST /api/users/force-logout-others
// @access  Private
const forceLogoutOtherDevices = asyncHandler(async (req, res) => {
  try {
    const token = req.cookies.jwt;
    
    if (!token) {
      res.status(401);
      throw new Error('Not authorized, no token');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find active sessions for this user
    const activeSessions = await Session.find({
      userId: decoded.userId,
      token: { $ne: token },
      isActive: true
    });
    
    // Get information about the sessions being logged out
    const sessionCount = activeSessions.length;
    const deviceInfo = activeSessions.map(session => {
      const deviceType = session.deviceInfo.includes('Mobile') ? 'mobile device' : 'computer';
      const lastActive = new Date(session.lastActivity).toLocaleString();
      return { deviceType, lastActive };
    });
    
    // Keep only the current session active
    const result = await Session.updateMany(
      { 
        userId: decoded.userId,
        token: { $ne: token },
        isActive: true
      },
      { 
        isActive: false
      }
    );
    
    // Log the action
    console.log(`User ${decoded.userId} forced logout from ${result.modifiedCount} other devices`);
    
    // Prepare response message
    let message = 'No other active sessions found';
    if (sessionCount > 0) {
      message = `Successfully logged out from ${sessionCount} other device${sessionCount !== 1 ? 's' : ''}`;
      
      // Add details if there are sessions
      if (deviceInfo.length > 0) {
        const deviceDetails = deviceInfo.map(device => 
          `${device.deviceType} (last active: ${device.lastActive})`
        ).join(', ');
        
        message += `. Devices: ${deviceDetails}`;
      }
    }
    
    res.status(200).json({
      success: true,
      message,
      sessionsTerminated: sessionCount
    });
  } catch (error) {
    console.error('Force logout error:', error);
    res.status(500);
    throw new Error('Error during force logout. Please try again.');
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
  forceLogoutOtherDevices,
};
