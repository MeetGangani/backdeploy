import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true
  },
  options: {
    type: [{
      type: String,
      required: true,
      trim: true
    }],
    validate: {
      validator: function(v) {
        return v.length === 4;
      },
      message: 'Each question must have exactly 4 options'
    }
  },
  correctAnswer: {
    type: Number,
    required: true,
    min: [1, 'Correct answer must be between 1 and 4'],
    max: [4, 'Correct answer must be between 1 and 4']
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
    required: [true, 'Exam name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
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
    sparse: true,
    index: true
  },
  totalQuestions: {
    type: Number,
    required: true,
    min: [1, 'Exam must have at least 1 question']
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
  adminComment: String,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  resultsReleased: {
    type: Boolean,
    default: false
  },
  timeLimit: {
    type: Number,
    default: 60,
    min: [15, 'Time limit must be at least 15 minutes'],
    max: [180, 'Time limit cannot exceed 180 minutes']
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  questions: [questionSchema]
}, {
  timestamps: true
});

// Add indexes for better query performance
fileRequestSchema.index({ institute: 1, status: 1 });
fileRequestSchema.index({ status: 1, createdAt: -1 });
fileRequestSchema.index({ ipfsHash: 1 }, { sparse: true });

const FileRequest = mongoose.model('FileRequest', fileRequestSchema);
export default FileRequest; 