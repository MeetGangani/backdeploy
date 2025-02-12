import express from 'express';
import {
  authUser,
  registerUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  googleAuth,
  googleAuthCallback,
} from '../controllers/userController.js';
import { protect, adminOnly, instituteOnly } from '../middleware/authMiddleware.js';
import passport from 'passport';

const router = express.Router();


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
    failureRedirect: 'http://localhost:3000/login',
    session: false 
  }),
  googleAuthCallback
);

export default router;
