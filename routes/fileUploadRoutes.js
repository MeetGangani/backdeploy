import express from 'express';
import multer from 'multer';
import { protect, instituteOnly } from '../middleware/authMiddleware.js';
import {
  uploadFile,
  getMyUploads,
  getUploadDetails
} from '../controllers/fileUploadController.js';

const router = express.Router();

// Configure multer for file upload
const storage = multer.memoryStorage();
const uploadMiddleware = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Handle file upload
router.post('/', protect, instituteOnly, uploadMiddleware.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const result = await uploadFile(req.file);
    res.json(result);
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ 
      message: 'Error uploading file',
      error: error.message 
    });
  }
});

router.get('/my-uploads', protect, instituteOnly, getMyUploads);
router.get('/requests/:id', protect, instituteOnly, getUploadDetails);

export default router; 