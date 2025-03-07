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
  submittedBy: {
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
  totalQuestions: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminComment: {
    type: String
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  timeLimit: {
    type: Number,
    required: true,
    default: 60 // Default 60 minutes
  },
  passingPercentage: {
    type: Number,
    default: 60 // Default 60%
  },
  examMode: {
    type: Boolean,
    default: false
  },
  resultsReleased: {
    type: Boolean,
    default: false
  },
  ipfsHash: {
    type: String
  },
  questions: [questionSchema], // Will be populated after decryption
  ipfsEncryptionKey: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Add index for better query performance
fileRequestSchema.index({ institute: 1, status: 1 });
fileRequestSchema.index({ status: 1, createdAt: -1 });

const FileRequest = mongoose.model('FileRequest', fileRequestSchema);
export default FileRequest; 