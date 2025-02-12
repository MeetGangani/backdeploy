import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept only JSON files
  if (file.mimetype === 'application/json') {
    cb(null, true);
  } else {
    cb(new Error('Only JSON files are allowed!'), false);
  }
};

// Custom error handling for multer
const uploadErrorHandler = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        message: 'File is too large. Maximum size is 1MB'
      });
    } else {
      res.status(400).json({
        message: 'File upload error: ' + error.message
      });
    }
  } else if (error) {
    res.status(400).json({
      message: error.message
    });
  } else {
    next();
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024, // 1MB limit
    files: 1 // Only allow 1 file per request
  }
});

export { upload, uploadErrorHandler }; 