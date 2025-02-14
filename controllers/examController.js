import asyncHandler from 'express-async-handler';
import FileRequest from '../models/fileRequestModel.js';
import ExamResponse from '../models/examResponseModel.js';
import { decryptFromIPFS } from '../utils/encryption.js';
import axios from 'axios';
import logger from '../utils/logger.js';

// Get available exams for student
const getAvailableExams = asyncHandler(async (req, res) => {
  try {
    const exams = await FileRequest.find({
      status: 'approved',
      isActive: true
    }).select('examName timeLimit totalQuestions');

    res.json(exams);
  } catch (error) {
    logger.error('Get available exams error:', error);
    res.status(500);
    throw new Error('Failed to fetch available exams');
  }
});

// Start exam for student
const startExam = asyncHandler(async (req, res) => {
  const { ipfsHash } = req.body;

  try {
    logger.info(`Starting exam with IPFS hash: ${ipfsHash}`);

    // Find exam by IPFS hash
    const exam = await FileRequest.findOne({ ipfsHash });
    if (!exam) {
      logger.error('Exam not found for hash:', ipfsHash);
      res.status(404);
      throw new Error('Exam not found');
    }

    // Check if exam is active
    if (!exam.isActive) {
      logger.error('Exam is not active:', exam._id);
      res.status(400);
      throw new Error('This exam is not currently active');
    }

    // Check for existing attempt
    const existingAttempt = await ExamResponse.findOne({
      student: req.user._id,
      exam: exam._id,
      status: { $in: ['in-progress', 'completed'] }
    });

    if (existingAttempt?.status === 'completed') {
      logger.error('Student already completed this exam:', {
        student: req.user._id,
        exam: exam._id
      });
      res.status(400);
      throw new Error('You have already completed this exam');
    }

    // Create new exam response if one doesn't exist
    let examResponse = existingAttempt;
    if (!examResponse) {
      examResponse = await ExamResponse.create({
        student: req.user._id,
        exam: exam._id,
        answers: {},
        score: 0,
        correctAnswers: 0,
        totalQuestions: exam.totalQuestions,
        status: 'in-progress'
      });
    }

    try {
      logger.info('Fetching exam data from IPFS...');
      const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
      
      if (!response.data || !response.data.iv || !response.data.encryptedData) {
        logger.error('Invalid IPFS data format:', response.data);
        throw new Error('Invalid data format from IPFS');
      }

      logger.info('Decrypting exam data...');
      const decryptedData = decryptFromIPFS(response.data, exam.ipfsEncryptionKey);
      
      if (!decryptedData || !decryptedData.questions) {
        logger.error('Invalid decrypted data structure');
        throw new Error('Invalid exam data structure');
      }

      // Validate questions format
      if (!Array.isArray(decryptedData.questions)) {
        logger.error('Questions is not an array:', typeof decryptedData.questions);
        throw new Error('Invalid questions format');
      }

      logger.info('Preparing exam data for student...');
      // Return exam data without correct answers
      const sanitizedQuestions = decryptedData.questions.map(q => ({
        text: q.question,
        options: q.options
      }));

      res.json({
        _id: exam._id,
        examName: exam.examName,
        timeLimit: exam.timeLimit,
        totalQuestions: exam.totalQuestions,
        questions: sanitizedQuestions,
        examResponseId: examResponse._id
      });

    } catch (error) {
      // Clean up the exam response if there's an error
      await ExamResponse.findByIdAndDelete(examResponse._id);
      throw error;
    }

  } catch (error) {
    logger.error('Start exam error:', {
      error: error.message,
      stack: error.stack,
      ipfsHash
    });
    res.status(error.status || 500);
    throw new Error(error.message);
  }
});

// Submit exam
const submitExam = asyncHandler(async (req, res) => {
  const { examId, answers } = req.body;

  try {
    logger.info('Processing exam submission:', { examId, answers });

    // Find the existing exam response
    const examResponse = await ExamResponse.findOne({
      exam: examId,
      student: req.user._id,
      status: 'in-progress'
    });

    if (!examResponse) {
      logger.error('No active exam response found');
      res.status(404);
      throw new Error('No active exam session found');
    }

    // Get the exam details
    const exam = await FileRequest.findById(examId);
    if (!exam) {
      logger.error('Exam not found');
      res.status(404);
      throw new Error('Exam not found');
    }

    // Fetch and decrypt exam data from IPFS
    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${exam.ipfsHash}`);
    const decryptedData = decryptFromIPFS(response.data, exam.ipfsEncryptionKey);

    if (!decryptedData || !decryptedData.questions) {
      throw new Error('Invalid exam data structure');
    }

    // Calculate score with detailed logging
    let correctCount = 0;
    const totalQuestions = decryptedData.questions.length;

    logger.info('Starting answer verification:', {
      submittedAnswers: answers,
      totalQuestions
    });

    // Convert answers to strings for consistent comparison
    Object.entries(answers).forEach(([questionIndex, submittedAnswer]) => {
      const question = decryptedData.questions[questionIndex];
      const correctAnswer = question?.correctAnswer;

      logger.info('Checking answer:', {
        questionIndex,
        submittedAnswer: String(submittedAnswer),
        correctAnswer: String(correctAnswer),
        matches: String(submittedAnswer) === String(correctAnswer)
      });

      if (correctAnswer !== undefined && String(submittedAnswer) === String(correctAnswer)) {
        correctCount++;
      }
    });

    // Calculate score
    const score = Number(((correctCount / totalQuestions) * 100).toFixed(2));

    logger.info('Score calculation complete:', {
      correctCount,
      totalQuestions,
      score,
      answersSubmitted: Object.keys(answers).length
    });

    // Update the exam response
    examResponse.answers = answers;
    examResponse.score = score;
    examResponse.correctAnswers = correctCount;
    examResponse.totalQuestions = totalQuestions;
    examResponse.submittedAt = new Date();
    examResponse.status = 'completed';
    examResponse.resultsAvailable = true;

    await examResponse.save();

    // Update exam to release results
    await FileRequest.findByIdAndUpdate(examId, {
      resultsReleased: true
    });

    // Return results
    res.json({
      message: 'Exam submitted successfully',
      score,
      correctAnswers: correctCount,
      totalQuestions,
      resultsAvailable: true
    });

  } catch (error) {
    logger.error('Submit exam error:', {
      error: error.message,
      stack: error.stack,
      examId,
      userId: req.user._id
    });
    res.status(error.status || 500);
    throw new Error('Failed to submit exam');
  }
});

// Get my results (for student)
const getMyResults = asyncHandler(async (req, res) => {
  try {
    logger.info('Fetching results for student:', req.user._id);
    
    const results = await ExamResponse.find({ 
      student: req.user._id,
      status: 'completed'
    })
    .populate({
      path: 'exam',
      select: 'examName resultsReleased'
    })
    .select('score correctAnswers totalQuestions submittedAt resultsAvailable')
    .sort('-submittedAt')
    .lean();

    const formattedResults = results.map(result => ({
      _id: result._id,
      exam: {
        examName: result.exam?.examName || 'N/A',
        resultsReleased: true
      },
      score: typeof result.score === 'number' ? Number(result.score.toFixed(2)) : 0,
      correctAnswers: typeof result.correctAnswers === 'number' ? result.correctAnswers : 0,
      totalQuestions: result.totalQuestions,
      submittedAt: result.submittedAt,
      resultsAvailable: true
    }));

    logger.info('Formatted results:', formattedResults);
    res.json(formattedResults);
  } catch (error) {
    logger.error('Get results error:', error);
    res.status(500);
    throw new Error('Failed to fetch exam results');
  }
});

// Get exam results (for institute)
const getExamResults = asyncHandler(async (req, res) => {
  const { examId } = req.params;

  try {
    const exam = await FileRequest.findOne({
      _id: examId,
      institute: req.user._id
    });

    if (!exam) {
      res.status(404);
      throw new Error('Exam not found');
    }

    const results = await ExamResponse.find({ exam: examId })
      .populate('student', 'name email')
      .sort('-submittedAt')
      .select('score correctAnswers totalQuestions submittedAt');

    res.json(results);
  } catch (error) {
    logger.error('Get exam results error:', error);
    res.status(500);
    throw new Error('Failed to fetch exam results');
  }
});

export {
  getAvailableExams,
  startExam,
  submitExam,
  getMyResults,
  getExamResults
};