import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import {
  getRequests,
  updateRequestStatus,
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  deleteUser,
  createUser
} from '../controllers/adminController.js';

const router = express.Router();

// Protect all admin routes
router.use(protect);
router.use(adminOnly);

// Admin routes
router.post('/users/create', createUser); // Specific endpoint for user creation
router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);
router.get('/requests', getRequests);
router.put('/requests/:id', updateRequestStatus);
router.get('/dashboard', getDashboardStats);

export default router; 