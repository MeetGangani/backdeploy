import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import { 
  getRequests, 
  updateRequestStatus, 
  getDashboardStats 
} from '../controllers/adminController.js';

const router = express.Router();

// Apply admin middleware to all routes
router.use(protect, admin);

router.get('/requests', getRequests);
router.get('/dashboard', getDashboardStats);
router.put('/requests/:id', updateRequestStatus);

export default router; 