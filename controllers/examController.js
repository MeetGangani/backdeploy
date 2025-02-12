import asyncHandler from 'express-async-handler';
import FileRequest from '../models/fileRequestModel.js';
import ExamResponse from '../models/examResponseModel.js';
import { decryptFile } from '../utils/encryptionUtils.js';
import sendEmail from '../utils/emailUtils.js';
import { examResultTemplate } from '../utils/emailTemplates.js';
import axios from 'axios';
import { createLogger } from '../utils/logger.js';
import Upload from '../models/uploadModel.js';

const logger = createLogger('examController');

// Get available exams for students
const getAvailableExams = asyncHandler(async (req, res) => {
  try {
    // Find all approved exams that the student hasn't attempted yet
    const attemptedExams = await ExamResponse.find({ 
      student: req.user._id 
    }).select('exam');

    const attemptedExamIds = attemptedExams.map(response => response.exam);

    // Updated query to include institute information
    const availableExams = await FileRequest.find({
      status: 'approved',
      _id: { $nin: attemptedExamIds }
    })
    .populate('institute', 'name') // Populate institute details
    .select('examName timeLimit totalQuestions ipfsHash institute')
    .lean();

    // Format the response
    const formattedExams = availableExams.map(exam => ({
      _id: exam._id,
      examName: exam.examName,
      instituteName: exam.institute?.name || 'Unknown Institute',
      timeLimit: exam.timeLimit,
      totalQuestions: exam.totalQuestions,
      ipfsHash: exam.ipfsHash
    }));

    res.json(formattedExams);
  } catch (error) {
    logger.error('Error fetching available exams:', error);
    res.status(500);
    throw new Error('Failed to fetch available exams');
  }
});

// Enhanced exam start with validation
const startExam = asyncHandler(async (req, res) => {
  try {
    const { ipfsHash } = req.body;
    const studentId = req.user._id;

    if (!ipfsHash) {
      logger.error('Missing IPFS hash');
      return res.status(400).json({
        message: 'IPFS hash is required'
      });
    }

    // Check if student has already attempted this exam
    const existingAttempt = await ExamResponse.findOne({
      student: studentId,
      'exam.ipfsHash': ipfsHash
    });

    if (existingAttempt) {
      logger.warn(`Student ${studentId} attempting to restart exam ${ipfsHash}`);
      return res.status(400).json({
        message: 'You have already attempted this exam'
      });
    }

    logger.info(`Starting exam with IPFS hash: ${ipfsHash}`);

    // Find the exam with more details
    const exam = await FileRequest.findOne({ 
      ipfsHash,
      status: 'approved'
    })
    .populate('institute', 'name')
    .select('encryptedData encryptionKey examName timeLimit totalQuestions institute');
    
    if (!exam) {
      logger.error('Exam not found or not approved for IPFS hash:', ipfsHash);
      return res.status(404).json({
        message: 'No approved exam found with this IPFS hash. Please verify the hash with your institute.'
      });
    }

    // Decrypt exam data using the stored encryption key
    let decryptedData;
    try {
      // Use decryptFile since data was encrypted with encryptFile
      decryptedData = decryptFile(exam.encryptedData, exam.encryptionKey);
      
      if (!decryptedData || !decryptedData.questions) {
        throw new Error('Invalid exam data structure');
      }
    } catch (decryptError) {
      logger.error('Decryption error:', decryptError);
      return res.status(500).json({
        message: 'Unable to process exam data. Please contact your institute.'
      });
    }

    // Create exam response with more details
    const examResponse = await ExamResponse.create({
      student: studentId,
      exam: {
        _id: exam._id,
        ipfsHash: ipfsHash,
        examName: exam.examName,
        instituteName: exam.institute?.name,
        timeLimit: exam.timeLimit,
        totalQuestions: exam.totalQuestions
      },
      startTime: new Date(),
      status: 'in-progress',
      answers: {},
      timeRemaining: exam.timeLimit * 60
    });

    // Remove correct answers from questions before sending to student
    const sanitizedQuestions = decryptedData.questions.map(q => ({
      question: q.question,
      options: q.options
    }));

    // Send exam data with more details
    return res.json({
      examResponseId: examResponse._id,
      examName: exam.examName,
      instituteName: exam.institute?.name,
      questions: sanitizedQuestions,
      totalQuestions: exam.totalQuestions,
      timeLimit: exam.timeLimit || 60
    });

  } catch (error) {
    logger.error('Exam start error:', error);
    return res.status(500).json({
      message: 'Failed to start exam. Please try again later.'
    });
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
    const decryptedData = decryptFile(response.data, exam.encryptionKey);

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