import asyncHandler from 'express-async-handler';
import Upload from '../models/uploadModel.js';

// @desc    Upload exam file
// @route   POST /api/upload
// @access  Private/Institute
const uploadFile = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No file uploaded');
    }

    // Parse the JSON content
    const jsonContent = JSON.parse(req.file.buffer.toString());

    // Create new upload document
    const upload = await Upload.create({
      institute: req.user._id,
      examName: req.body.examName,
      description: req.body.description,
      questions: jsonContent.questions,
      totalQuestions: jsonContent.questions.length,
      status: 'pending',
      file: {
        data: req.file.buffer,
        contentType: req.file.mimetype
      }
    });

    if (upload) {
      res.status(201).json({
        message: 'File uploaded successfully',
        upload: {
          _id: upload._id,
          examName: upload.examName,
          description: upload.description,
          totalQuestions: upload.totalQuestions,
          status: upload.status,
          createdAt: upload.createdAt
        }
      });
    } else {
      res.status(400);
      throw new Error('Invalid upload data');
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      message: 'Error uploading file',
      error: error.message
    });
  }
});

// @desc    Get my uploads
// @route   GET /api/upload/my-uploads
// @access  Private/Institute
const getMyUploads = asyncHandler(async (req, res) => {
  const uploads = await Upload.find({ institute: req.user._id })
    .select('-file.data')
    .sort('-createdAt');
  res.json(uploads);
});

export { uploadFile, getMyUploads }; 