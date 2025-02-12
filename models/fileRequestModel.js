import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: [{
    type: String,
    required: true
  }],
  correctAnswer: {
    type: Number, // Index of correct option (0-3)
    required: true
  }
});

const fileRequestSchema = new mongoose.Schema({
  institute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  examName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  encryptedData: {
    type: String,
    required: true
  },
  encryptionKey: {
    type: String,
    required: true
  },
  ipfsEncryptionKey: {
    type: String,
    required: true
  },
  ipfsHash: {
    type: String,
    default: null
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminComment: {
    type: String
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  resultsReleased: {
    type: Boolean,
    default: false
  },
  timeLimit: {
    type: Number,
    default: 60 // 60 minutes default
  },
  questions: [questionSchema] // Will be populated after decryption
}, {
  timestamps: true
});

// Add index for better query performance
fileRequestSchema.index({ institute: 1, status: 1 });
fileRequestSchema.index({ status: 1, createdAt: -1 });

const FileRequest = mongoose.model('FileRequest', fileRequestSchema);
export default FileRequest; 