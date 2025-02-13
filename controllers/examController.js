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

    // Find the exam using IPFS hash
    const exam = await FileRequest.findOne({
      ipfsHash,
      status: 'approved'
    });

    if (!exam) {
      res.status(404);
      throw new Error('Exam not found or not approved');
    }

    // Check if student has already attempted this exam
    const existingAttempt = await ExamResponse.findOne({
      exam: exam._id,
      student: req.user._id
    });

    if (existingAttempt) {
      res.status(400);
      throw new Error('You have already attempted this exam');
    }

    try {
      logger.info('Fetching exam data from IPFS...');
      // Fetch encrypted data from IPFS
      const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
      
      if (!response.data || !response.data.iv || !response.data.encryptedData) {
        throw new Error('Invalid data format from IPFS');
      }

      logger.info('Decrypting exam data...');
      // Decrypt the exam data using the stored IPFS encryption key
      const decryptedData = decryptFromIPFS(response.data, exam.ipfsEncryptionKey);
      
      if (!decryptedData || !decryptedData.questions) {
        throw new Error('Invalid exam data structure');
      }

      // Validate questions format
      if (!Array.isArray(decryptedData.questions)) {
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
        questions: sanitizedQuestions
      });

    } catch (error) {
      logger.error('Exam preparation error:', error);
      res.status(500);
      throw new Error('Failed to prepare exam content');
    }

  } catch (error) {
    logger.error('Start exam error:', error);
    res.status(error.status || 500);
    throw new Error(`Failed to start exam: ${error.message}`);
  }
});

// Enhanced exam submission with detailed validation
const submitExam = asyncHandler(async (req, res) => {
  const { examId, answers } = req.body;

  try {
    logger.info(`Processing exam submission for exam: ${examId}`);

    const exam = await FileRequest.findById(examId);
    if (!exam) {
      res.status(404);
      throw new Error('Exam not found');
    }

    const now = new Date();
    
    // Validate submission time
    if (now > new Date(exam.endDate)) {
      throw new Error('Exam submission period has ended');
    }

    // Get and decrypt exam data
    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${exam.ipfsHash}`);
    const decryptedData = decryptFromIPFS(response.data, exam.ipfsEncryptionKey);

    // Calculate score with detailed analysis
    let correctAnswers = 0;
    const totalQuestions = decryptedData.questions.length;
    const answerAnalysis = [];

    Object.entries(answers).forEach(([questionIndex, studentAnswer]) => {
      const question = decryptedData.questions[parseInt(questionIndex)];
      const isCorrect = studentAnswer === question.correctAnswer;
      
      if (isCorrect) correctAnswers++;

      answerAnalysis.push({
        questionId: question.id,
        correct: isCorrect,
        studentAnswer,
        correctAnswer: question.correctAnswer
      });
    });

    const score = (correctAnswers / totalQuestions) * 100;

    // Create exam response with detailed data
    const examResponse = await ExamResponse.create({
      student: req.user._id,
      exam: examId,
      answers,
      score,
      correctAnswers,
      totalQuestions,
      answerAnalysis,
      submittedAt: now
    });

    // Send immediate feedback email
    try {
      await sendEmail({
        to: req.user.email,
        subject: `Exam Submission Confirmation - ${exam.examName}`,
        html: examResultTemplate({
          examName: exam.examName,
          score,
          correctAnswers,
          totalQuestions,
          submittedAt: examResponse.submittedAt,
          dashboardUrl: `${process.env.FRONTEND_URL}/student/results/${examResponse._id}`
        })
      });
      
      logger.info('Result email sent successfully');
    } catch (emailError) {
      logger.error('Email sending error:', emailError);
    }

    res.json({
      message: 'Exam submitted successfully',
      examResponse: {
        _id: examResponse._id,
        exam: {
          _id: exam._id,
          examName: exam.examName,
          resultsReleased: exam.resultsReleased
        },
        score,
        correctAnswers,
        totalQuestions,
        submittedAt: examResponse.submittedAt
      }
    });

  } catch (error) {
    logger.error('Submit exam error:', error);
    res.status(500);
    throw new Error('Failed to submit exam');
  }
});

// Enhanced results release with batch processing
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

// Get my results (for student)
const getMyResults = asyncHandler(async (req, res) => {
  try {
    logger.info('Fetching results for student:', req.user._id);
    
    const results = await ExamResponse.find({ 
      student: req.user._id 
    })
    .populate({
      path: 'exam',
      select: 'examName resultsReleased'
    })
    .select('score correctAnswers totalQuestions submittedAt')
    .sort('-submittedAt')
    .lean();

    logger.info('Raw results from DB:', results);

    const formattedResults = results.map(result => ({
      _id: result._id,
      exam: {
        examName: result.exam?.examName || 'N/A',
        resultsReleased: result.exam?.resultsReleased || false
      },
      score: result.score,
      correctAnswers: result.correctAnswers,
      totalQuestions: result.totalQuestions,
      submittedAt: result.submittedAt
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
  releaseResults,
  getMyResults,
  getExamResults
}; 