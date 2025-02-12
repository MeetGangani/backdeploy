import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import FileRequest from '../models/fileRequestModel.js';
import { encryptFile, generateEncryptionKey, jsonToBinary, processFile } from '../utils/encryptionUtils.js';

// Utility function to process and encrypt file
const processFile = (buffer) => {
  try {
    // Parse JSON content
    const jsonContent = JSON.parse(buffer.toString());
    
    // Generate encryption key
    const encryptionKey = generateEncryptionKey();
    
    // Encrypt the JSON data
    const encrypted = encryptFile(JSON.stringify(jsonContent), encryptionKey);
    
    return { encrypted, encryptionKey };
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
    const { examName, description, questions, totalQuestions, timeLimit } = req.body;

    // Convert exam data to binary
    const examData = {
      examName,
      description,
      questions,
      totalQuestions,
      timeLimit
    };
    const binaryData = jsonToBinary(examData);

    // Process file (encrypt for initial storage)
    const { encrypted: encryptedData, encryptionKey } = processFile(binaryData);

    // Create file request
    const fileRequest = await FileRequest.create({
      institute: req.user._id,
      examName,
      description,
      encryptedData,
      encryptionKey,
      totalQuestions,
      timeLimit,
      questions,
      submittedBy: req.user._id,
      status: 'pending'
    });

    res.status(201).json({
      message: 'File uploaded successfully',
      fileRequest: {
        _id: fileRequest._id,
        examName: fileRequest.examName,
        status: fileRequest.status
      }
    });

  } catch (error) {
    logger.error('File upload error:', error);
    res.status(500);
    throw new Error('Failed to upload file');
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
  const uploads = await FileRequest.find({ institute: req.user._id })
    .select('examName description status createdAt totalQuestions ipfsHash resultsReleased')
    .sort('-createdAt');

  res.json(uploads);
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
  getPendingRequests, 
  getRequestDetails,
  updateRequestStatus,
  getMyUploads,
  getUploadDetails
}; 