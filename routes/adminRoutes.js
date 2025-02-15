import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
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

// Apply protect middleware first, then admin middleware
router.use(protect);
router.use(admin);

// Admin routes
router.route('/requests').get(getRequests);
router.route('/requests/:id').put(updateRequestStatus);
router.route('/dashboard').get(getDashboardStats);
router.route('/users').get(getAllUsers);
router.route('/users/:id/status').put(updateUserStatus);
router.route('/users/:id').delete(deleteUser);
router.route('/users').post(createUser);

export default router; 