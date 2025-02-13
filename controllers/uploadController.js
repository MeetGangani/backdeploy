import asyncHandler from 'express-async-handler';
import FileRequest from '../models/fileRequestModel.js';
import { processFile } from '../utils/encryptionUtils.js';

// Get institute's uploads
const getMyUploads = asyncHandler(async (req, res) => {
  try {
    const uploads = await FileRequest.find({ 
      institute: req.user._id 
    }).sort('-createdAt');

    res.json(uploads);
  } catch (error) {
    console.error('Get uploads error:', error);
    res.status(500);
    throw new Error('Failed to fetch uploads');
  }
});

// Upload file
const uploadFile = asyncHandler(async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      res.status(400);
      throw new Error('No file uploaded');
    }

    const { examName, description } = req.body;
    if (!examName || !description) {
      res.status(400);
      throw new Error('Please provide exam name and description');
    }

    const file = req.files.file;
    
    // Process and encrypt file
    const { encrypted: encryptedData, encryptionKey } = await processFile(file.data);

    // Create file request
    const fileRequest = await FileRequest.create({
      institute: req.user._id,
      examName,
      description,
      encryptedData,
      encryptionKey,
      totalQuestions: JSON.parse(file.data).questions.length,
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
    console.error('Upload error:', error);
    res.status(500);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
});

export {
  uploadFile,
  getMyUploads
}; 