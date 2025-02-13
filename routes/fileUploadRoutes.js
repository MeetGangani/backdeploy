import express from 'express';
import { protect, instituteOnly } from '../middleware/authMiddleware.js';
import { uploadFile, getMyUploads, getUploadDetails } from '../controllers/fileUploadController.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect); // All routes require authentication

router.route('/')
  .post(instituteOnly, upload.single('file'), uploadFile);

router.get('/my-uploads', instituteOnly, getMyUploads);
router.get('/requests/:id', instituteOnly, getUploadDetails);

export default router; 