const googleOptions = {
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.NODE_ENV === 'production'
    ? 'https://backdeploy-9bze.onrender.com/api/users/auth/google/callback'
    : 'http://localhost:5000/api/users/auth/google/callback',
  passReqToCallback: true
}; 