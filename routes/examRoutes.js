import express from 'express';
import multer from 'multer';
import {
  getAvailableExams,
  startExam,
  submitExam,
  releaseResults,
  getMyResults,
  getExamResults,
  checkExamMode,
  createExam,
  uploadExamImages,
  fixExamEncryptionKeys,
  fixEncryptionKeys
} from '../controllers/examController.js';
import { protect, instituteOnly, adminOnly } from '../middleware/authMiddleware.js';
import { updateExamMode } from '../controllers/fileUploadController.js';
import axios from 'axios';
import FormData from 'form-data';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size is too large. Maximum size is 5MB.'
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  next(err);
};

// Student routes
router.route('/submit')
  .post(protect, submitExam);

router.get('/available', protect, getAvailableExams);
router.post('/start', protect, startExam);
router.get('/my-results', protect, getMyResults);

// Institute routes
router.get('/results/:examId', protect, getExamResults);
router.post('/release/:examId', protect, releaseResults);

router.route('/:id/exam-mode').put(protect, updateExamMode);

// Route to check exam mode
// router.get('/exams/:ipfsHash', checkExamMode);
router.get('/check-mode/:ipfsHash', checkExamMode);

// Route to start the exam
router.post('/exams/start', startExam);

// New routes for exam creation
router.post(
  '/create-binary',
  protect,
  instituteOnly,
  express.json({ limit: '50mb' }),
  createExam
);

// Configure image upload route with proper headers and error handling
router.post('/upload-images', 
  protect,
  (req, res, next) => {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).send();
    }
    next();
  },
  upload.array('images', 10), // Allow up to 10 images
  handleMulterError, // Add error handling middleware
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        });
      }

      // Process the uploaded files
      const result = await uploadExamImages(req, res);
      return result;
    } catch (error) {
      console.error('Error in image upload:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Error uploading images'
      });
    }
  }
);

// Excel upload endpoint
router.post('/proxy/excel', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    // Create form data for the Excel processor service
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // Forward the Excel file to the processor service
    const processorResponse = await axios.post(
      'https://excelprocessor.onrender.com',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    // Validate the processor response
    const processedData = processorResponse.data;
    if (!processedData.questions || !Array.isArray(processedData.questions)) {
      throw new Error('Invalid response from Excel processor');
    }

    // Validate each question
    processedData.questions.forEach((q, index) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || !q.correctAnswer) {
        throw new Error(`Invalid question format at index ${index}`);
      }
    });

    // Return the processed questions
    res.json({ 
      success: true,
      questions: processedData.questions 
    });

  } catch (error) {
    console.error('Excel processing error:', error);
    res.status(error.response?.status || 500).json({ 
      success: false,
      message: error.message || 'Failed to process Excel file' 
    });
  }
});

// Admin routes
router.get('/fix-keys/:id', protect, adminOnly, fixExamEncryptionKeys);
router.get('/fix-encryption-keys', protect, adminOnly, fixEncryptionKeys);

export default router; 