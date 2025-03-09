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
import cloudinary from '../config/cloudinary.js';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import path from 'path';

const router = express.Router();

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'exam-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  }
});

const upload = multer({ storage });

// Configure multer for memory storage
const memoryStorage = multer.memoryStorage();
const memoryUpload = multer({ 
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
    }
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

// Image upload endpoint
router.post('/upload-images', protect, memoryUpload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No images uploaded' 
      });
    }

    const uploadPromises = req.files.map(async (file) => {
      try {
        const result = await cloudinary.uploader.upload_stream({
          folder: 'nexus-edu-exam-images',
        }).end(file.buffer);
        return result.secure_url;
      } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
      }
    });

    const imageUrls = await Promise.all(uploadPromises);

    res.json({
      success: true,
      imageUrls
    });

  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload images'
    });
  }
});

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