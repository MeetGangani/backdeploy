import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import { 
  getRequests, 
  updateRequestStatus, 
  getDashboardStats 
} from '../controllers/adminController.js';

const router = express.Router();

// Protect all routes with admin middleware
router.use(protect);
router.use(adminOnly);

router.get('/requests', getRequests);
router.get('/dashboard', getDashboardStats);
router.put('/requests/:id', updateRequestStatus);

export default router; 