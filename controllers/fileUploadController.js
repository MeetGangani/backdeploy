import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import FileRequest from '../models/fileRequestModel.js';
import { encryptFile, generateEncryptionKey } from '../utils/encryptionUtils.js';

// Utility function to process and encrypt file
const processFile = (buffer) => {
  try {
    // Parse JSON content
    const jsonContent = JSON.parse(buffer.toString());
    
    // Generate encryption key
    const encryptionKey = generateEncryptionKey();
    
    // Encrypt the JSON data
    const encrypted = encryptFile(JSON.stringify(jsonContent), encryptionKey);
    
    // Convert encrypted data to Buffer if it isn't already
    const encryptedBuffer = Buffer.from(encrypted);
    
    return { 
      encrypted: encryptedBuffer,
      encryptionKey 
    };
  } catch (error) {
    console.error('File processing error:', error);
    throw new Error('Failed to process file');
  }
};

const validateQuestionFormat = (questions) => {
  if (!Array.isArray(questions)) throw new Error('Questions must be an array');
  
  questions.forEach((q, index) => {
    if (!q.question) throw new Error(`Question ${index + 1} is missing question text`);
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question ${index + 1} must have exactly 4 options`);
    }
    if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 1 || q.correctAnswer > 4) {
      throw new Error(`Question ${index + 1} has invalid correct answer index (must be 1-4)`);
    }
  });
  return true;
};

// @desc    Upload file and create request
// @route   POST /api/upload
// @access  Institute Only
const uploadFile = asyncHandler(async (req, res) => {
  try {
    // 1. Validate request
    if (!req.file || !req.body.examName || !req.body.description || !req.body.examDuration) {
      res.status(400);
      throw new Error('Please provide all required fields');
    }

    // 2. Parse and validate JSON content
    let jsonContent;
    try {
      jsonContent = JSON.parse(req.file.buffer.toString());
      validateQuestionFormat(jsonContent.questions);
    } catch (error) {
      res.status(400);
      throw new Error(`Invalid JSON format: ${error.message}`);
    }

    // 3. Generate encryption key and encrypt data
    const encryptionKey = generateEncryptionKey();
    const encryptedData = encryptFile(jsonContent, encryptionKey);

    // 4. Create file request in database
    const fileRequest = await FileRequest.create({
      institute: req.user._id,
      submittedBy: req.user._id,
      examName: req.body.examName,
      description: req.body.description,
      encryptedData: encryptedData,
      encryptionKey: encryptionKey,
      totalQuestions: jsonContent.questions.length,
      status: 'pending',
      timeLimit: req.body.examDuration, // Save the provided exam duration
    });

    // 5. Send success response
    res.status(201).json({
      message: 'File uploaded successfully',
      requestId: fileRequest._id,
      examName: fileRequest.examName,
      totalQuestions: fileRequest.totalQuestions,
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(error.status || 500);
    throw new Error(error.message || 'Failed to upload file');
  }
});

// @desc    Get all pending requests
// @route   GET /api/upload/requests
// @access  Admin Only
const getPendingRequests = asyncHandler(async (req, res) => {
  const requests = await FileRequest.find({ status: 'pending' })
    .populate('institute', 'name email')
    .select('fileName description status createdAt institute')
    .sort('-createdAt');
    
  res.json(requests);
});

// @desc    Get request details for admin review
// @route   GET /api/upload/requests/:id
// @access  Admin Only
const getRequestDetails = asyncHandler(async (req, res) => {
  const request = await FileRequest.findById(req.params.id)
    .populate('institute', 'name email')
    .select('-encryptionKey'); // Don't send encryption key

  if (!request) {
    res.status(404);
    throw new Error('Request not found');
  }

  res.json(request);
});

// @desc    Approve or reject request
// @route   PUT /api/upload/requests/:id
// @access  Admin Only
const updateRequestStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminComment } = req.body;

  const fileRequest = await FileRequest.findById(id);
  
  if (!fileRequest) {
    res.status(404);
    throw new Error('Request not found');
  }

  if (!['approved', 'rejected'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status');
  }

  fileRequest.status = status;
  fileRequest.adminComment = adminComment;
  fileRequest.reviewedAt = Date.now();
  fileRequest.reviewedBy = req.user._id;

  await fileRequest.save();

  res.json({
    message: `Request ${status}`,
    requestId: fileRequest._id,
    status: fileRequest.status
  });
});

// @desc    Get institute's uploaded files
// @route   GET /api/upload/my-uploads
// @access  Institute Only
const getMyUploads = asyncHandler(async (req, res) => {
  try {
    const uploads = await FileRequest.find({ 
      institute: req.user._id 
    })
    .select('examName description status createdAt totalQuestions resultsReleased')
    .sort('-createdAt');

    if (!uploads || uploads.length === 0) {
      return res.status(404).json({
        message: 'No uploads found'
      });
    }

    res.status(200).json(uploads);
  } catch (error) {
    console.error('Error in getMyUploads:', error);
    res.status(500).json({
      message: 'Failed to fetch uploads',
      error: error.message
    });
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

// @desc    Update exam mode for a file request
// @route   PUT /api/exams/:id/exam-mode
// @access  Institute Only
const updateExamMode = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { examMode } = req.body; // Expecting a boolean value

  const fileRequest = await FileRequest.findById(id);
  
  if (!fileRequest) {
    res.status(404);
    throw new Error('Request not found');
  }

  fileRequest.examMode = examMode;
  await fileRequest.save();

  res.json({
    message: `Exam mode ${examMode ? 'enabled' : 'disabled'} successfully`,
    examMode: fileRequest.examMode
  });
});

export { 
  uploadFile, 
  getPendingRequests, 
  getRequestDetails,
  updateRequestStatus,
  getMyUploads,
  getUploadDetails,
  updateExamMode
}; 