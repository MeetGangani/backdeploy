import express from 'express';
import { protect, instituteOnly } from '../middleware/authMiddleware.js';
import { uploadFile } from '../controllers/fileUploadController.js';
import upload from '../middleware/uploadMiddleware.js';
import multer from 'multer';
import { uploadExcel } from '../controllers/excelUploadController.js';
import axios from 'axios';
import FormData from 'form-data';

const router = express.Router();

router.post('/', protect, instituteOnly, upload.single('file'), uploadFile);
router.post('/excel', protect, instituteOnly, upload.single('file'), uploadExcel);

// Proxy endpoint for Excel processing
router.post('/process-excel', upload.single('file'), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await axios.post(
      'https://silent-unit-5477.ploomber.app/api/process-excel',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Excel processing error:', error);
    res.status(500).json({ error: 'Failed to process Excel file' });
  }
});

export default router; 