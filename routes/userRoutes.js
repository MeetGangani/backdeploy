import express from 'express';
import {
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
} from '../controllers/userController.js';
import { protect, adminOnly, instituteOnly } from '../middleware/authMiddleware.js';
import passport from 'passport';

const router = express.Router();

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/', registerUser);
router.post('/auth', authUser);
router.post('/logout', logoutUser);
router
  .route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

// Example of role-based routes (you can add more as needed)
router.get('/admin-only', protect, adminOnly, (req, res) => {
  res.json({ message: 'Admin access granted' });
});

router.get('/institute-only', protect, instituteOnly, (req, res) => {
  res.json({ message: 'Institute access granted' });
});

router.get('/auth/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));

router.get('/auth/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: process.env.NODE_ENV === 'production'
      ? 'https://nexusedu-meetgangani56-gmailcoms-projects.vercel.app/login'
      : 'http://localhost:3000/login',
    session: false 
  }),
  googleCallback
);

// Add check-auth route
router.get('/check-auth', checkAuth);

// Add this route to handle admin requests
router.get('/admin/requests', protect, adminOnly, async (req, res) => {
  try {
    // Return empty data for now
    res.json({
      requests: [],
      stats: {
        totalRequests: 0,
        pendingRequests: 0,
        approvedRequests: 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
