import express from 'express';
import multer from 'multer';
import { protect, instituteOnly } from '../middleware/authMiddleware.js';
import {
  uploadFile,
  getMyUploads,
  getUploadDetails
} from '../controllers/fileUploadController.js';
import { upload, uploadErrorHandler } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Configure multer for file uploads
const uploadMulter = multer({ storage: multer.memoryStorage() });

// Institute routes
router.post('/', 
  protect, 
  instituteOnly, 
  uploadMulter.single('file'), 
  uploadErrorHandler,
  uploadFile
);
router.get('/my-uploads', protect, instituteOnly, getMyUploads);
router.get('/requests/:id', protect, instituteOnly, getUploadDetails);

export default router; 