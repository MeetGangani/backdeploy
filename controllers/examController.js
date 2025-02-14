import asyncHandler from 'express-async-handler';
import FileRequest from '../models/fileRequestModel.js';
import ExamResponse from '../models/examResponseModel.js';
import { decryptFromIPFS } from '../utils/encryptionUtils.js';
import sendEmail from '../utils/emailUtils.js';
import { examResultTemplate } from '../utils/emailTemplates.js';
import axios from 'axios';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('examController');

// Get available exams for students
const getAvailableExams = asyncHandler(async (req, res) => {
  try {
    // Find all approved exams that the student hasn't attempted yet
    const attemptedExams = await ExamResponse.find({ 
      student: req.user._id 
    }).select('exam');

    const attemptedExamIds = attemptedExams.map(response => response.exam);

    const availableExams = await FileRequest.find({
      status: 'approved',
      _id: { $nin: attemptedExamIds }
    }).select('examName timeLimit totalQuestions ipfsHash').lean();

    res.json(availableExams);
  } catch (error) {
    logger.error('Error fetching available exams:', error);
    res.status(500);
    throw new Error('Failed to fetch available exams');
  }
});

// Enhanced exam start with validation
const startExam = asyncHandler(async (req, res) => {
  const { ipfsHash } = req.body;

  try {
    logger.info(`Starting exam with IPFS hash: ${ipfsHash}`);

    const exam = await FileRequest.findOne({
      ipfsHash: ipfsHash.trim()
    });

    if (!exam) {
      logger.error(`No exam found with IPFS hash: ${ipfsHash}`);
      res.status(404);
      throw new Error('Exam not found with the provided IPFS hash');
    }

    // Check for any existing exam response
    const existingAttempt = await ExamResponse.findOne({
      exam: exam._id,
      student: req.user._id
    });

    if (existingAttempt) {
      if (existingAttempt.status === 'in-progress') {
        logger.info('Resuming existing exam attempt');
      } else {
        logger.error('Student has already completed this exam');
        res.status(400);
        throw new Error('You have already attempted this exam');
      }
    }

    // Create new exam response only if one doesn't exist
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

      if (!Array.isArray(decryptedData.questions)) {
        logger.error('Questions is not an array:', typeof decryptedData.questions);
        throw new Error('Invalid questions format');
      }

      logger.info('Preparing exam data for student...');
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
      await ExamResponse.findByIdAndDelete(examResponse._id);
      throw error;
    }
  } catch (error) {
    logger.error('Exam preparation error:', error);
    res.status(500);
    throw new Error('Failed to prepare exam');
  }
});

// Submit exam with enhanced validation and scoring
const submitExam = asyncHandler(async (req, res) => {
  const { examId, answers } = req.body;

  try {
    logger.info(`Processing exam submission for exam: ${examId}`);

    // Find the exam response
    const examResponse = await ExamResponse.findOne({
      exam: examId,
      student: req.user._id,
      status: 'in-progress'
    });

    if (!examResponse) {
      logger.error('No active exam session found');
      res.status(404);
      throw new Error('No active exam session found');
    }

    // Get exam details and decrypt questions
    const exam = await FileRequest.findById(examId);
    if (!exam) {
      logger.error('Exam not found');
      res.status(404);
      throw new Error('Exam not found');
    }

    // Fetch and decrypt exam data
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

    // Compare answers with correct solutions
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

    // Calculate final score
    const score = Number(((correctCount / totalQuestions) * 100).toFixed(2));

    logger.info('Score calculation complete:', {
      correctCount,
      totalQuestions,
      score,
      answersSubmitted: Object.keys(answers).length
    });

    // Update exam response with results
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

// Get exam results for student
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

// Get exam results for institute
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

// Release exam results
const releaseResults = asyncHandler(async (req, res) => {
  const { examId } = req.params;

  try {
    logger.info(`Releasing results for exam: ${examId}`);

    const exam = await FileRequest.findOne({
      _id: examId,
      institute: req.user._id
    });

    if (!exam) {
      res.status(404);
      throw new Error('Exam not found');
    }

    exam.resultsReleased = true;
    await exam.save();

    // Get all responses with student details
    const responses = await ExamResponse.find({ exam: examId })
      .populate('student', 'email name')
      .lean();

    // Process email notifications in batches
    const batchSize = 50;
    for (let i = 0; i < responses.length; i += batchSize) {
      const batch = responses.slice(i, i + batchSize);
      for (const response of batch) {
        if (response.student && response.student.email) {
          try {
            await sendEmail({
              to: response.student.email,
              subject: `Exam Results Available - ${exam.examName}`,
              html: examResultTemplate({
                examName: exam.examName,
                score: response.score,
                correctAnswers: response.correctAnswers,
                totalQuestions: response.totalQuestions,
                submittedAt: response.submittedAt,
                dashboardUrl: `${process.env.FRONTEND_URL}/student/results/${response._id}`
              })
            });
          } catch (emailError) {
            logger.error('Email notification error:', emailError);
          }
        }
      }
    }

    res.json({
      message: 'Results released successfully',
      examId: exam._id,
      totalNotified: responses.length
    });

  } catch (error) {
    logger.error('Release results error:', error);
    res.status(500);
    throw new Error('Failed to release results');
  }
});

export {
  getAvailableExams,
  startExam,
  submitExam,
  releaseResults,
  getMyResults,
  getExamResults
};