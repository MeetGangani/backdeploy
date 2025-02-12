import express from 'express';
import multer from 'multer';
import { protect, instituteOnly } from '../middleware/authMiddleware.js';
import { uploadFile, getMyUploads } from '../controllers/uploadController.js';

const router = express.Router();

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Routes
router.post('/', protect, instituteOnly, upload.single('file'), uploadFile);
router.get('/my-uploads', protect, instituteOnly, getMyUploads);

export default router; 