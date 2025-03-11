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
  uploadExamImages
} from '../controllers/examController.js';
import { protect, instituteOnly } from '../middleware/authMiddleware.js';
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

// Configure image upload route with proper headers
router.post('/upload-images', 
  protect, 
  (req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Credentials', true);
    next();
  },
  upload.array('images', 10), // Allow up to 10 images
  uploadExamImages
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

export default router; 