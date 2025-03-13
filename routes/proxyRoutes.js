import express from 'express';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import { protect } from '../middleware/authMiddleware.js';
import xlsx from 'xlsx';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Proxy endpoint for Excel processing
router.post('/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read the Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Convert to JSON and filter out empty rows
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    const nonEmptyRows = jsonData.filter(row => 
      row.some(cell => cell !== null && cell !== undefined && cell !== '')
    );

    // Create a new workbook with only non-empty rows
    const newWorkbook = xlsx.utils.book_new();
    const newWorksheet = xlsx.utils.json_to_sheet(nonEmptyRows, { skipHeader: true });
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Sheet1');
    
    // Convert back to buffer
    const cleanBuffer = xlsx.write(newWorkbook, { type: 'buffer' });

    const formData = new FormData();
    formData.append('file', cleanBuffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await axios.post(
      'https://silent-unit-5477.ploomber.app/api/process-excel',
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
