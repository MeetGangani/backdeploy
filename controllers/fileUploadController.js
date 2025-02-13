import asyncHandler from 'express-async-handler';
import FileRequest from '../models/fileRequestModel.js';
import { encryptFile, generateEncryptionKey, processFile } from '../utils/encryptionUtils.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('fileUploadController');

// Validate question format utility
const validateQuestionFormat = (questions) => {
  if (!Array.isArray(questions)) throw new Error('Questions must be an array');
  
  questions.forEach((q, index) => {
    if (!q.question) throw new Error(`Question ${index + 1} is missing question text`);
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question ${index + 1} must have exactly 4 options`);
    }
    if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
      throw new Error(`Question ${index + 1} has invalid correct answer index`);
    }
  });
};

// @desc    Upload file and create request
// @route   POST /api/upload
// @access  Institute Only
const uploadFile = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No file uploaded');
    }

    // Parse and validate JSON content
    let jsonContent;
    try {
      jsonContent = JSON.parse(req.file.buffer.toString());
      validateQuestionFormat(jsonContent.questions);
    } catch (error) {
      res.status(400);
      throw new Error(`Invalid JSON file: ${error.message}`);
    }

    // Process the file and get encrypted binary data
    const { encrypted, encryptionKey } = processFile(req.file.buffer);
    const ipfsEncryptionKey = generateEncryptionKey();

    // Create file request with encrypted binary data
    const fileRequest = await FileRequest.create({
      institute: req.user._id,
      examName: req.body.examName,
      description: req.body.description,
      encryptedData: encrypted,
      encryptionKey: encryptionKey,
      ipfsEncryptionKey: ipfsEncryptionKey,
      totalQuestions: jsonContent.questions.length,
      status: 'pending',
      submittedBy: req.user._id,
      timeLimit: parseInt(req.body.timeLimit) || 60,
      questions: jsonContent.questions // Store questions for later use
    });

    res.status(201).json({
      message: 'File uploaded successfully',
      requestId: fileRequest._id,
      examName: fileRequest.examName,
      totalQuestions: fileRequest.totalQuestions,
      status: fileRequest.status
    });

  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500);
    throw new Error('Failed to upload file');
  }
});

// @desc    Get institute's uploaded files
// @route   GET /api/upload/my-uploads
// @access  Institute Only
const getMyUploads = asyncHandler(async (req, res) => {
  try {
    const uploads = await FileRequest.find({ 
      institute: req.user._id 
    })
    .select('examName description status createdAt totalQuestions ipfsHash resultsReleased')
    .sort('-createdAt');

    res.json(uploads);
  } catch (error) {
    logger.error('Get uploads error:', error);
    res.status(500);
    throw new Error('Failed to fetch uploads');
  }
});

// @desc    Get upload details
// @route   GET /api/upload/requests/:id
// @access  Institute Only (own requests)
const getUploadDetails = asyncHandler(async (req, res) => {
  const request = await FileRequest.findOne({
    _id: req.params.id,
    institute: req.user._id
  }).select('-encryptedData -encryptionKey');

  if (!request) {
    res.status(404);
    throw new Error('Request not found');
  }

  res.json(request);
});

export { 
  uploadFile, 
  getMyUploads,
  getUploadDetails
};