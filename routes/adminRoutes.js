import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { 
  getRequests, 
  updateRequestStatus, 
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  deleteUser
} from '../controllers/adminController.js';

const router = express.Router();

// Apply admin middleware to all routes
router.use(protect, adminOnly);

// Add explicit OPTIONS handling for preflight requests
router.options('*', (req, res) => {
  res.sendStatus(200);
});

router.get('/requests', getRequests);
router.get('/dashboard', getDashboardStats);
router.put('/requests/:id', updateRequestStatus);
router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

export default router; 