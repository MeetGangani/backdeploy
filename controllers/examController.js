import asyncHandler from 'express-async-handler';
import FileRequest from '../models/fileRequestModel.js';
import ExamResponse from '../models/examResponseModel.js';
import { decryptFromIPFS } from '../utils/encryptionUtils.js';
import sendEmail from '../utils/emailUtils.js';
import { examResultTemplate } from '../utils/emailTemplates.js';
import axios from 'axios';
import { createLogger } from '../utils/logger.js';
import { encryptFile, generateEncryptionKey } from '../utils/encryptionUtils.js';
import { uploadToCloudinary } from '../utils/cloudinaryUtils.js';

const logger = createLogger('examController');

// Get available exams for students
const getAvailableExams = asyncHandler(async (req, res) => {
  try {
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

// Check if exam mode is enabled
const checkExamMode = asyncHandler(async (req, res) => {
  const { ipfsHash } = req.params;
  logger.info(`Checking exam mode for IPFS hash: ${ipfsHash}`);

  const exam = await FileRequest.findOne({ ipfsHash: ipfsHash.trim() });

  if (!exam) {
    res.status(404);
    throw new Error('Exam not found');
  }

  // Return both examMode status and a message
  res.json({
    examMode: exam.examMode,
    message: exam.examMode ? 'Exam is active' : 'Exam has not been started yet'
  });
});

// Start exam with validation
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

    // Check exam mode before proceeding
    if (!exam.examMode) {
      logger.error('Attempt to start exam when exam mode is disabled');
      res.status(400);
      throw new Error('This exam has not been started by the institute yet');
    }

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

    let examResponse = existingAttempt;
    if (!examResponse) {
      examResponse = await ExamResponse.create({
        student: req.user._id,
        exam: exam._id,
        answers: {},
        score: 0,
        correctAnswers: 0,
        totalQuestions: exam.totalQuestions,
        status: 'in-progress',
        resultsAvailable: false,
        timeLimit: exam.timeLimit
      });
    }

    try {
      const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
      
      if (!response.data || !response.data.iv || !response.data.encryptedData) {
        logger.error('Invalid IPFS data format:', response.data);
        throw new Error('Invalid data format from IPFS');
      }

      const decryptedData = decryptFromIPFS(response.data, exam.ipfsEncryptionKey);
      
      if (!decryptedData || !decryptedData.questions) {
        logger.error('Invalid decrypted data structure');
        throw new Error('Invalid exam data structure');
      }

      if (!Array.isArray(decryptedData.questions)) {
        logger.error('Questions is not an array:', typeof decryptedData.questions);
        throw new Error('Invalid questions format');
      }

      const sanitizedQuestions = decryptedData.questions.map(q => ({
        text: q.question,
        options: q.options
      }));

      const examData = await ExamResponse.find({ exam: exam._id }).populate('student', 'name email');

      res.json({
        _id: exam._id,
        examName: exam.examName,
        timeLimit: exam.timeLimit,
        totalQuestions: exam.totalQuestions,
        questions: sanitizedQuestions,
        examResponseId: examResponse._id,
        examData
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

// Submit exam with validation and scoring
const submitExam = asyncHandler(async (req, res) => {
  const { examId, answers } = req.body;

  try {
    logger.info(`Processing exam submission:`, { examId, answers });

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

    const exam = await FileRequest.findById(examId);
    if (!exam) {
      logger.error('Exam not found');
      res.status(404);
      throw new Error('Exam not found');
    }

    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${exam.ipfsHash}`);
    const decryptedData = decryptFromIPFS(response.data, exam.ipfsEncryptionKey);

    if (!decryptedData || !decryptedData.questions) {
      throw new Error('Invalid exam data structure');
    }

    let correctCount = 0;
    const totalQuestions = decryptedData.questions.length;

    logger.info('Starting answer verification:', {
      submittedAnswers: answers,
      totalQuestions: totalQuestions
    });

    Object.entries(answers).forEach(([questionIndex, submittedAnswer]) => {
      const question = decryptedData.questions[questionIndex];
      const submittedNum = Number(submittedAnswer);
      const correctNum = Number(question.correctAnswer) - 1;

      logger.info('Checking answer:', {
        questionIndex,
        submittedAnswer: submittedNum,
        correctAnswer: correctNum,
        matches: submittedNum === correctNum
      });

      if (submittedNum === correctNum) {
        correctCount++;
      }
    });

    const score = Number(((correctCount / totalQuestions) * 100).toFixed(2));

    examResponse.answers = answers;
    examResponse.score = score;
    examResponse.correctAnswers = correctCount;
    examResponse.totalQuestions = totalQuestions;
    examResponse.submittedAt = new Date();
    examResponse.status = 'completed';
    examResponse.resultsAvailable = false;

    await examResponse.save();

    res.json({
      message: 'Exam submitted successfully. Results will be available once released by the institute.',
      totalQuestions,
      submittedAt: examResponse.submittedAt
    });

  } catch (error) {
    logger.error('Submit exam error:', error);
    res.status(500);
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
      select: 'examName ipfsHash resultsReleased'
    })
    .select('score correctAnswers totalQuestions submittedAt resultsAvailable')
    .sort('-submittedAt')
    .lean();

    const formattedResults = results.map(result => ({
      _id: result._id,
      exam: {
        examName: result.exam?.examName || 'N/A',
        ipfsHash: result.exam?.ipfsHash || 'N/A',
        resultsReleased: result.exam?.resultsReleased || false
      },
      score: result.exam?.resultsReleased ? Number(result.score.toFixed(2)) : null,
      correctAnswers: result.exam?.resultsReleased ? result.correctAnswers : null,
      totalQuestions: result.totalQuestions,
      submittedAt: result.submittedAt,
      resultsAvailable: result.exam?.resultsReleased || false
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

    await ExamResponse.updateMany(
      { exam: examId },
      { resultsAvailable: true }
    );

    const responses = await ExamResponse.find({ exam: examId })
      .populate('student', 'email name')
      .lean();

    // Send emails in batches with better error handling
    const batchSize = 50;
    for (let i = 0; i < responses.length; i += batchSize) {
      const batch = responses.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (response) => {
        if (!response.student?.email) {
          logger.warn(`No email found for student: ${response.student?._id}`);
          return;
        }

        try {
          // Format the submission date
          const submittedAt = new Date(response.submittedAt).toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });

          // Create the dashboard URL
          const dashboardUrl = `${process.env.FRONTEND_URL}/student/results/${response._id}`;

          // Prepare result data
          const resultData = {
            examName: exam.examName,
            score: response.score || 0,
            correctAnswers: response.correctAnswers || 0,
            totalQuestions: response.totalQuestions,
            submittedAt: submittedAt,
            dashboardUrl: dashboardUrl,
            studentName: response.student.name
          };

          await sendEmail({
            to: response.student.email,
            subject: `Exam Results Available - ${exam.examName}`,
            html: examResultTemplate({ resultData })
          });

          logger.info(`Result notification sent to: ${response.student.email}`);
        } catch (emailError) {
          logger.error('Email notification error:', {
            error: emailError.message,
            studentId: response.student._id,
            examId: exam._id
          });
        }
      }));
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

// @desc    Create a new exam from binary data
// @route   POST /api/exams/create-binary
// @access  Institute Only
const createExam = asyncHandler(async (req, res) => {
  try {
    // 1. Validate request
    if (!req.file) {
      res.status(400);
      throw new Error('No exam data provided');
    }

    // 2. Parse binary data
    const examDataBuffer = req.file.buffer;
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(examDataBuffer);
    const examData = JSON.parse(jsonString);

    // 3. Validate exam data
    if (!examData.examName || !examData.timeLimit || !examData.questions || !Array.isArray(examData.questions)) {
      res.status(400);
      throw new Error('Invalid exam data format');
    }

    // 4. Validate questions
    validateQuestions(examData.questions);

    // 5. Generate encryption key and encrypt data
    const encryptionKey = generateEncryptionKey();
    const encryptedData = encryptFile(JSON.stringify(examData), encryptionKey);

    // 6. Create file request in database
    const fileRequest = await FileRequest.create({
      institute: req.user._id,
      submittedBy: req.user._id,
      examName: examData.examName,
      description: examData.description || 'No description provided',
      encryptedData: encryptedData,
      encryptionKey: encryptionKey,
      totalQuestions: examData.questions.length,
      status: 'pending',
      timeLimit: examData.timeLimit,
      passingPercentage: examData.passingPercentage || 60,
    });

    // 7. Send success response
    res.status(201).json({
      message: 'Exam created successfully',
      requestId: fileRequest._id,
      examName: fileRequest.examName,
      totalQuestions: fileRequest.totalQuestions,
    });
  } catch (error) {
    console.error('Exam creation error:', error);
    res.status(error.status || 500);
    throw new Error(error.message || 'Failed to create exam');
  }
});

// Validate questions format for both single and multiple choice
const validateQuestions = (questions) => {
  if (!Array.isArray(questions)) throw new Error('Questions must be an array');
  
  questions.forEach((q, index) => {
    if (!q.questionText && !q.questionImage) {
      throw new Error(`Question ${index + 1} must have text or an image`);
    }
    
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Question ${index + 1} must have at least 2 options`);
    }
    
    // Check if any option is empty
    q.options.forEach((opt, optIndex) => {
      if (!opt.text && !opt.image) {
        throw new Error(`Option ${optIndex + 1} in question ${index + 1} must have text or an image`);
      }
    });
    
    // Validate based on question type (inferred from correctOptions presence)
    if (Array.isArray(q.correctOptions) && q.correctOptions.length > 0) {
      // Multiple choice question
      if (q.correctOptions.length === 0) {
        throw new Error(`Question ${index + 1} must have at least one correct answer`);
      }
      
      // Check if all correct options are valid indices
      q.correctOptions.forEach(optIndex => {
        if (optIndex < 0 || optIndex >= q.options.length) {
          throw new Error(`Question ${index + 1} has invalid correct option index`);
        }
      });
    } else {
      // Single choice question
      if (typeof q.correctOption !== 'number' || q.correctOption < 0 || q.correctOption >= q.options.length) {
        throw new Error(`Question ${index + 1} has invalid correct answer index`);
      }
    }
  });
  
  return true;
};

// @desc    Upload exam images
// @route   POST /api/exams/upload-images
// @access  Institute Only
const uploadExamImages = asyncHandler(async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      res.status(400);
      throw new Error('No images provided');
    }

    logger.info(`Uploading ${req.files.length} images`);
    
    // Process each file and upload to Cloudinary
    const uploadPromises = req.files.map(file => {
      return uploadToCloudinary(file.buffer);
    });

    const imageUrls = await Promise.all(uploadPromises);
    
    logger.info('Images uploaded successfully:', imageUrls);

    res.status(200).json({
      message: 'Images uploaded successfully',
      imageUrls: imageUrls
    });
  } catch (error) {
    logger.error('Image upload error:', error);
    res.status(500);
    throw new Error('Failed to upload images: ' + error.message);
  }
});

export {
  getAvailableExams,
  checkExamMode,
  startExam,
  submitExam,
  releaseResults,
  getMyResults,
  getExamResults,
  createExam,
  uploadExamImages
};