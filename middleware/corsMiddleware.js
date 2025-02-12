const corsMiddleware = (req, res, next) => {
  // Allow requests from your Vercel frontend in production
  const allowedOrigins = [
    'https://nexusedu-jade.vercel.app', // New Vercel URL
    'https://nexusedu-meetgangani56-gmailcoms-projects.vercel.app', // Old URL (can be removed)
    'http://localhost:3000'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
};

export default corsMiddleware; 