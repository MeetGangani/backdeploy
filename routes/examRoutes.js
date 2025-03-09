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

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

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
router.post('/upload-images', protect, upload.array('images'), uploadExamImages);

// Excel upload endpoint - keeping it simple
router.post('/proxy/excel', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Process the file and return questions
    const questions = []; // Your question processing logic here
    
    res.json({ 
      success: true,
      questions 
    });

  } catch (error) {
    console.error('Excel processing error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process Excel file' 
    });
  }
});

export default router; 