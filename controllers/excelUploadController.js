const asyncHandler = require('express-async-handler');
const axios = require('axios');
const FileRequest = require('../models/fileRequestModel');
const { generateEncryptionKey, encryptFile } = require('../utils/encryption');

const uploadExcel = asyncHandler(async (req, res) => {
  try {
    // 1. Validate request
    if (!req.file || !req.body.examName || !req.body.description || !req.body.examDuration) {
      res.status(400);
      throw new Error('Please provide all required fields');
    }

    // 2. Send file to Python service for processing
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const pythonServiceResponse = await axios.post(
      'https://your-render-service-url/api/process-excel',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    const processedQuestions = pythonServiceResponse.data.questions;

    // 3. Generate encryption key and encrypt data
    const encryptionKey = generateEncryptionKey();
    const encryptedData = encryptFile(processedQuestions, encryptionKey);

    // 4. Create file request in database
    const fileRequest = await FileRequest.create({
      institute: req.user._id,
      submittedBy: req.user._id,
      examName: req.body.examName,
      description: req.body.description,
      encryptedData: encryptedData,
      encryptionKey: encryptionKey,
      totalQuestions: processedQuestions.length,
      status: 'pending',
      timeLimit: req.body.examDuration,
    });

    // 5. Send success response
    res.status(201).json({
      message: 'Excel file processed successfully',
      requestId: fileRequest._id,
      examName: fileRequest.examName,
      totalQuestions: fileRequest.totalQuestions,
    });

  } catch (error) {
    console.error('Excel upload error:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to process Excel file'
    });
  }
});

module.exports = {
  uploadExcel
}; 