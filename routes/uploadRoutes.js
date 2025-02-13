import express from 'express';
import { protect, instituteOnly } from '../middleware/authMiddleware.js';
import { uploadFile } from '../controllers/fileUploadController.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/', protect, instituteOnly, upload.single('file'), uploadFile);

export default router; 