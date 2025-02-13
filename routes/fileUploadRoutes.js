import express from 'express';
import multer from 'multer';
import { protect, instituteOnly } from '../middleware/authMiddleware.js';
import {
  uploadFile,
  getMyUploads,
  getUploadDetails
} from '../controllers/fileUploadController.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Institute routes
router.post('/', protect, instituteOnly, upload.single('file'), uploadFile);
router.get('/my-uploads', protect, instituteOnly, getMyUploads);
router.get('/requests/:id', protect, instituteOnly, getUploadDetails);

export default router; 