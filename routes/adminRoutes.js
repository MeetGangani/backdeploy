import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { getRequests, updateRequestStatus } from '../controllers/adminController.js';

const router = express.Router();

router.get('/requests', protect, adminOnly, getRequests);
router.put('/requests/:id', protect, adminOnly, updateRequestStatus);

export default router; 