import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check if route is for Excel upload
  if (req.path.includes('excel') || req.path.includes('process-excel')) {
    // Accept Excel files
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // xlsx
      file.mimetype === 'application/vnd.ms-excel' ||  // xls
      file.mimetype === 'application/octet-stream'  // generic binary
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed for this route!'), false);
    }
  } else {
    // For other routes, accept JSON files
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed!'), false);
    }
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export default upload; 