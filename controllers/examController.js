import asyncHandler from 'express-async-handler';
import FileRequest from '../models/fileRequestModel.js';
import ExamResponse from '../models/examResponseModel.js';
import { decryptFromIPFS, generateEncryptionKey } from '../utils/encryptionUtils.js';
import sendEmail from '../utils/emailUtils.js';
import { examResultTemplate } from '../utils/emailTemplates.js';
import axios from 'axios';
import { createLogger } from '../utils/logger.js';
import { encryptFile } from '../utils/encryptionUtils.js';
import { cloudinary } from '../utils/cloudinaryUtils.js';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';

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
      // Get encrypted data from IPFS
      const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${exam.ipfsHash}`);
      
      // Log encryption keys for debugging
      logger.info('Attempting to decrypt exam data:', { 
        hasEncryptionKey: !!exam.encryptionKey,
        hasIpfsEncryptionKey: !!exam.ipfsEncryptionKey,
        ipfsHash: exam.ipfsHash
      });
      
      // Decrypt the exam data
      let decryptedData;
      let decryptionSuccessful = false;
      
      // Try with encryptionKey first
      if (exam.encryptionKey) {
        try {
          logger.info('Attempting decryption with encryptionKey:', { keyLength: exam.encryptionKey.length });
          decryptedData = decryptFromIPFS(response.data, exam.encryptionKey);
          decryptionSuccessful = true;
          logger.info('Decryption with encryptionKey successful');
        } catch (error) {
          logger.error('Decryption with encryptionKey failed:', error);
        }
      }
      
      // If encryptionKey failed or doesn't exist, try with ipfsEncryptionKey
      if (!decryptionSuccessful && exam.ipfsEncryptionKey) {
        try {
          logger.info('Attempting decryption with ipfsEncryptionKey:', { keyLength: exam.ipfsEncryptionKey.length });
          decryptedData = decryptFromIPFS(response.data, exam.ipfsEncryptionKey);
          decryptionSuccessful = true;
          logger.info('Decryption with ipfsEncryptionKey successful');
          
          // If ipfsEncryptionKey worked but encryptionKey didn't, sync the keys
          if (!exam.encryptionKey) {
            logger.info('Syncing ipfsEncryptionKey to encryptionKey');
            exam.encryptionKey = exam.ipfsEncryptionKey;
            await exam.save();
          }
        } catch (error) {
          logger.error('Decryption with ipfsEncryptionKey also failed:', error);
        }
      }
      
      // If both keys failed, throw an error
      if (!decryptionSuccessful) {
        logger.error('All decryption attempts failed');
        throw new Error('Failed to decrypt exam data');
      }
      
      if (!decryptedData || !decryptedData.questions) {
        logger.error('Invalid decrypted data structure');
        throw new Error('Invalid exam data structure');
      }

      if (!Array.isArray(decryptedData.questions)) {
        logger.error('Questions is not an array:', typeof decryptedData.questions);
        throw new Error('Invalid questions format');
      }

      // Format questions for the frontend
      const sanitizedQuestions = decryptedData.questions.map((q, index) => {
        // Process options to handle both text and images
        const processedOptions = q.options.map(opt => {
          if (typeof opt === 'string') {
            return opt;
          }
          
          // If option has an image, format it as a special string that the frontend can parse
          if (opt.image) {
            return `${opt.text || ''}::img::${opt.image}`;
          }
          
          return opt.text || '';
        });
        
        // Log question type for debugging
        logger.info(`Question ${index + 1} type:`, { 
          allowMultiple: q.allowMultiple, 
          correctAnswer: q.correctAnswer,
          questionText: q.question.substring(0, 30) + '...'
        });
        
        return {
          text: q.question,
          questionImage: q.questionImage || null,
          options: processedOptions,
          allowMultiple: q.allowMultiple || false // Ensure allowMultiple is passed to frontend
        };
      });

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
    throw new Error('Failed to prepare exam: ' + error.message);
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

    // Get encrypted data from IPFS
    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${exam.ipfsHash}`);
    
    // Log encryption keys for debugging
    logger.info('Attempting to decrypt exam data for submission:', { 
      hasEncryptionKey: !!exam.encryptionKey,
      hasIpfsEncryptionKey: !!exam.ipfsEncryptionKey,
      ipfsHash: exam.ipfsHash
    });
    
    // Decrypt the exam data
    let decryptedData;
    let decryptionSuccessful = false;
    
    // Try with encryptionKey first
    if (exam.encryptionKey) {
      try {
        logger.info('Attempting decryption with encryptionKey:', { keyLength: exam.encryptionKey.length });
        decryptedData = decryptFromIPFS(response.data, exam.encryptionKey);
        decryptionSuccessful = true;
        logger.info('Decryption with encryptionKey successful');
      } catch (error) {
        logger.error('Decryption with encryptionKey failed:', error);
      }
    }
    
    // If encryptionKey failed or doesn't exist, try with ipfsEncryptionKey
    if (!decryptionSuccessful && exam.ipfsEncryptionKey) {
      try {
        logger.info('Attempting decryption with ipfsEncryptionKey:', { keyLength: exam.ipfsEncryptionKey.length });
        decryptedData = decryptFromIPFS(response.data, exam.ipfsEncryptionKey);
        decryptionSuccessful = true;
        logger.info('Decryption with ipfsEncryptionKey successful');
        
        // If ipfsEncryptionKey worked but encryptionKey didn't, sync the keys
        if (!exam.encryptionKey) {
          logger.info('Syncing ipfsEncryptionKey to encryptionKey');
          exam.encryptionKey = exam.ipfsEncryptionKey;
          await exam.save();
        }
      } catch (error) {
        logger.error('Decryption with ipfsEncryptionKey also failed:', error);
      }
    }
    
    // If both keys failed, throw an error
    if (!decryptionSuccessful) {
      logger.error('All decryption attempts failed');
      res.status(500);
      throw new Error('Failed to decrypt exam data');
    }

    if (!decryptedData || !decryptedData.questions) {
      logger.error('Invalid decrypted data structure');
      res.status(500);
      throw new Error('Invalid exam data structure');
    }

    let correctCount = 0;
    const totalQuestions = decryptedData.questions.length;

    logger.info('Starting answer verification:', {
      submittedAnswers: answers,
      totalQuestions: totalQuestions
    });

    // Process and validate answers
    const processedAnswers = {};
    
    Object.entries(answers).forEach(([questionIndex, submittedAnswer]) => {
      const question = decryptedData.questions[questionIndex];
      
      // Store the answer in the processed answers object
      // Keep arrays as arrays and numbers as numbers
      processedAnswers[questionIndex] = submittedAnswer;
      
      if (question.allowMultiple) {
        // For multiple choice questions
        const submittedAnswers = Array.isArray(submittedAnswer) 
          ? submittedAnswer.map(ans => Number(ans))
          : [Number(submittedAnswer)]; // Convert to array if not already
          
        const correctAnswers = Array.isArray(question.correctAnswer) 
          ? question.correctAnswer.map(ans => Number(ans))
          : [Number(question.correctAnswer)];

        // Check if arrays have the same values (order doesn't matter)
        const isCorrect = submittedAnswers.length === correctAnswers.length &&
          submittedAnswers.every(ans => correctAnswers.includes(ans)) &&
          correctAnswers.every(ans => submittedAnswers.includes(ans));

        logger.info('Checking multiple choice answer:', {
          questionIndex,
          submittedAnswers,
          correctAnswers,
          isCorrect
        });

        if (isCorrect) {
          correctCount++;
        }
      } else {
        // For single choice questions
        const submittedNum = Number(submittedAnswer);
        const correctNum = Number(question.correctAnswer);

        logger.info('Checking single choice answer:', {
          questionIndex,
          submittedAnswer: submittedNum,
          correctAnswer: correctNum,
          matches: submittedNum === correctNum
        });

        if (submittedNum === correctNum) {
          correctCount++;
        }
      }
    });

    const score = Number(((correctCount / totalQuestions) * 100).toFixed(2));

    // Update the exam response with the processed answers
    examResponse.answers = processedAnswers;
    examResponse.score = score;
    examResponse.correctAnswers = correctCount;
    examResponse.totalQuestions = totalQuestions;
    examResponse.submittedAt = new Date();
    examResponse.status = 'completed';
    examResponse.resultsAvailable = false;

    try {
      await examResponse.save();
      logger.info('Exam response saved successfully:', {
        examId,
        studentId: req.user._id,
        score,
        correctAnswers: correctCount,
        totalQuestions
      });
    } catch (saveError) {
      logger.error('Error saving exam response:', saveError);
      res.status(500);
      throw new Error('Failed to save exam response: ' + saveError.message);
    }

    res.json({
      message: 'Exam submitted successfully. Results will be available once released by the institute.',
      totalQuestions,
      submittedAt: examResponse.submittedAt
    });
  } catch (error) {
    logger.error('Error submitting exam:', error);
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
      .select('score correctAnswers totalQuestions submittedAt startTime timeLimit');

    // Calculate time taken for each result
    const formattedResults = results.map(result => {
      // Calculate time taken in seconds
      let timeTaken = 0;
      
      if (result.submittedAt && result.startTime) {
        // Calculate the difference in seconds
        const submittedTime = new Date(result.submittedAt).getTime();
        const startTime = new Date(result.startTime).getTime();
        timeTaken = Math.floor((submittedTime - startTime) / 1000);
        
        // If time taken is negative or exceeds the time limit, use the time limit
        if (timeTaken < 0 || (result.timeLimit && timeTaken > result.timeLimit * 60)) {
          timeTaken = result.timeLimit ? result.timeLimit * 60 : 0;
        }
      }
      
      // Convert to plain object and add timeTaken
      const resultObj = result.toObject();
      resultObj.timeTaken = timeTaken;
      
      return resultObj;
    });

    res.json(formattedResults);
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
    const { examName, description, subject, timeLimit, passingPercentage, questions } = req.body;
    
    // Enhanced validation
    if (!examName || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Exam name and subject are required'
      });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one question is required'
      });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText && !q.questionImage) {
        return res.status(400).json({
          success: false,
          error: `Question ${i + 1} must have either text or an image`
        });
      }

      if (!Array.isArray(q.options) || q.options.length < 2) {
        return res.status(400).json({
          success: false,
          error: `Question ${i + 1} must have at least 2 options`
        });
      }

      // Validate options
      for (let j = 0; j < q.options.length; j++) {
        const opt = q.options[j];
        if (!opt.text && !opt.image) {
          return res.status(400).json({
            success: false,
            error: `Option ${j + 1} in question ${i + 1} must have either text or an image`
          });
        }
      }

      // Validate correct answer
      if (q.questionType === 'multiple') {
        if (!Array.isArray(q.correctAnswer) || q.correctAnswer.length === 0) {
          return res.status(400).json({
            success: false,
            error: `Question ${i + 1} (multiple choice) must have at least one correct answer`
          });
        }
      } else {
        if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 1 || q.correctAnswer > q.options.length) {
          return res.status(400).json({
            success: false,
            error: `Question ${i + 1} (single choice) must have a valid correct answer`
          });
        }
      }
    }

    // Generate encryption key and encrypt the exam data
    const encryptionKey = generateEncryptionKey();
    
    // Log the questions for debugging
    logger.info(`Creating exam with ${questions.length} questions`);
    questions.forEach((q, i) => {
      logger.info(`Question ${i+1} type: ${q.questionType}, allowMultiple: ${q.questionType === 'multiple'}`);
    });
    
    const examData = {
      examName,
      description,
      subject,
      questions: questions.map(q => ({
        question: q.questionText,
        questionImage: q.questionImage,
        options: q.options,
        allowMultiple: q.questionType === 'multiple',
        correctAnswer: q.correctAnswer
      }))
    };

    // Encrypt the exam data
    const encryptedData = encryptFile(examData, encryptionKey);

    // Create a new exam document
    const newExam = new FileRequest({
      examName,
      description: description || examName,
      subject,
      timeLimit: timeLimit || 60,
      passingPercentage: passingPercentage || 60,
      totalQuestions: questions.length,
      encryptedData,
      encryptionKey: encryptionKey,
      institute: req.user._id,
      submittedBy: req.user._id,
      status: 'pending',
      examMode: false
    });
    
    // Save the exam
    const savedExam = await newExam.save();
    
    return res.status(201).json({
      success: true,
      message: 'Exam created successfully and is pending admin approval',
      examId: savedExam._id
    });
  } catch (error) {
    console.error('Error creating exam:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create exam'
    });
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

// @desc    Upload images for exam questions/options
// @route   POST /api/exams/upload-images
// @access  Private
const uploadExamImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // Upload all images to Cloudinary
    const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
    const imageUrls = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      imageUrls
    });
  } catch (error) {
    console.error('Error in uploadExamImages:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error uploading images'
    });
  }
};

// @desc    Check and fix exam encryption keys
// @route   GET /api/exams/fix-keys/:id
// @access  Admin Only
const fixExamEncryptionKeys = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    // If ID is provided, fix a specific exam
    if (id && id !== 'all') {
      const exam = await FileRequest.findById(id);
      
      if (!exam) {
        return res.status(404).json({
          success: false,
          message: 'Exam not found'
        });
      }
      
      // Check if encryptionKey is missing but ipfsEncryptionKey exists
      if (!exam.encryptionKey && exam.ipfsEncryptionKey) {
        exam.encryptionKey = exam.ipfsEncryptionKey;
        await exam.save();
        
        return res.status(200).json({
          success: true,
          message: 'Exam encryption key fixed',
          examId: exam._id
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Exam encryption key is already set',
        examId: exam._id
      });
    }
    
    // Fix all exams with missing encryption keys
    const examsToFix = await FileRequest.find({
      encryptionKey: { $exists: false },
      ipfsEncryptionKey: { $exists: true }
    });
    
    if (examsToFix.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No exams need fixing'
      });
    }
    
    // Update all exams
    const updatePromises = examsToFix.map(async (exam) => {
      exam.encryptionKey = exam.ipfsEncryptionKey;
      return exam.save();
    });
    
    await Promise.all(updatePromises);
    
    return res.status(200).json({
      success: true,
      message: `Fixed ${examsToFix.length} exams`,
      fixedCount: examsToFix.length
    });
    
  } catch (error) {
    logger.error('Error fixing exam keys:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fix exam keys',
      error: error.message
    });
  }
});

// @desc    Fix encryption keys in the database
// @route   GET /api/exams/fix-encryption-keys
// @access  Admin Only
const fixEncryptionKeys = asyncHandler(async (req, res) => {
  try {
    // Find all exams
    const exams = await FileRequest.find({});
    
    let fixedCount = 0;
    let alreadyFixedCount = 0;
    
    // Process each exam
    for (const exam of exams) {
      // Check if both keys exist
      if (exam.encryptionKey && exam.ipfsEncryptionKey) {
        // If both keys exist but are different, make them the same
        if (exam.encryptionKey !== exam.ipfsEncryptionKey) {
          logger.info(`Fixing mismatched keys for exam ${exam._id}`);
          exam.ipfsEncryptionKey = exam.encryptionKey;
          await exam.save();
          fixedCount++;
        } else {
          alreadyFixedCount++;
        }
      } 
      // If only encryptionKey exists
      else if (exam.encryptionKey && !exam.ipfsEncryptionKey) {
        logger.info(`Copying encryptionKey to ipfsEncryptionKey for exam ${exam._id}`);
        exam.ipfsEncryptionKey = exam.encryptionKey;
        await exam.save();
        fixedCount++;
      } 
      // If only ipfsEncryptionKey exists
      else if (!exam.encryptionKey && exam.ipfsEncryptionKey) {
        logger.info(`Copying ipfsEncryptionKey to encryptionKey for exam ${exam._id}`);
        exam.encryptionKey = exam.ipfsEncryptionKey;
        await exam.save();
        fixedCount++;
      }
      // If neither key exists, log an error
      else {
        logger.error(`Exam ${exam._id} has no encryption keys`);
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Fixed ${fixedCount} exams, ${alreadyFixedCount} already fixed`,
      fixedCount,
      alreadyFixedCount
    });
  } catch (error) {
    logger.error('Error fixing encryption keys:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fix encryption keys',
      error: error.message
    });
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
  uploadExamImages,
  fixExamEncryptionKeys,
  fixEncryptionKeys
};