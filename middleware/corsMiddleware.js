const corsMiddleware = (req, res, next) => {
  // Allow requests from your Vercel frontend in production
  const allowedOrigins = [
    'https://nexusedu-meetgangani56-gmailcoms-projects.vercel.app',
    'http://localhost:3000'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  // Allow credentials
  res.header('Access-Control-Allow-Credentials', 'true');

  // Allow specific headers
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );

  // Allow specific methods
  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
};

export default corsMiddleware; 