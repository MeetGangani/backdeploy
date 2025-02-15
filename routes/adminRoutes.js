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

// Updated to use adminOnly instead of admin
router.use(protect);
router.use(adminOnly);

// Admin routes
router.route('/requests').get(getRequests);
router.route('/requests/:id').put(updateRequestStatus);
router.route('/dashboard').get(getDashboardStats);
router.route('/users').get(getAllUsers);
router.route('/users/:id/status').put(updateUserStatus);
router.route('/users/:id').delete(deleteUser);
router.route('/users').post(createUser);

export default router; 