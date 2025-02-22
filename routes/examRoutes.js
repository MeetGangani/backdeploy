import express from 'express';
import {
  getAvailableExams,
  startExam,
  submitExam,
  releaseResults,
  getMyResults,
  getExamResults,
  checkExamMode
} from '../controllers/examController.js';
import { protect } from '../middleware/authMiddleware.js';
import { updateExamMode } from '../controllers/fileUploadController.js';

const router = express.Router();

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

export default router; 