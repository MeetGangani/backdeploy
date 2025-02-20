import mongoose from 'mongoose';

const examResponseSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FileRequest',
    required: true
  },
  answers: {
    type: Map,
    of: Number,
    required: true
  },
  
  score: {
    type: Number,
    required: true
  },
  correctAnswers: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  submittedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'timed-out'],
    default: 'in-progress'
  }
}, {
  timestamps: true
});

// Index for efficient queries
examResponseSchema.index({ student: 1, exam: 1 }, { unique: true });

const ExamResponse = mongoose.model('ExamResponse', examResponseSchema);
export default ExamResponse; 
