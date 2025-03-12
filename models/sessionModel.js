import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deviceInfo: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  token: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Automatically expire after 24 hours (in seconds)
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Create index for faster lookups
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ token: 1 });

const Session = mongoose.model('Session', sessionSchema);

export default Session; 