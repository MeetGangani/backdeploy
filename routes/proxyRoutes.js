import express from 'express';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Proxy endpoint for Excel processing
router.post('/excel', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await axios.post(
      'http://0.0.0.0:10000/api/process-excel',
      formData,
      {
        headers: {
          ...formData.getHeaders()
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Excel processing error:', error);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      res.status(error.response.status).json({ 
        error: error.response.data.error || 'Failed to process Excel file' 
      });
    } else if (error.request) {
      // The request was made but no response was received
      res.status(503).json({ error: 'Excel processor service unavailable' });
    } else {
      // Something happened in setting up the request
      res.status(500).json({ error: 'Failed to process Excel file' });
    }
  }
});

export default router; 
