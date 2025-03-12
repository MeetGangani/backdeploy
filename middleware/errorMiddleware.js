const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  // Add CORS headers for error responses
  if (process.env.NODE_ENV === 'production') {
    // Get the origin from the request headers
    const origin = req.headers.origin;
    const allowedOrigins = [
      'https://nexusedu-jade.vercel.app',
      'https://nexusedu-meetgangani56-gmailcoms-projects.vercel.app'
    ];
    
    // Set the Access-Control-Allow-Origin header if the origin is allowed
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
  } else {
    // In development, allow any origin
    res.header('Access-Control-Allow-Origin', req.headers.origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Handle Mongoose errors
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }

  // Log the error
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
    path: req.path,
    method: req.method
  });

  res.status(statusCode).json({
    message: message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

export { notFound, errorHandler };
