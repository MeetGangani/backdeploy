import mongoose from 'mongoose';

const examResponseSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exam: {
    _id: mongoose.Schema.Types.ObjectId,
    ipfsHash: String,
    examName: String,
    timeLimit: Number,
    totalQuestions: Number
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: Date,
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'timed-out'],
    default: 'in-progress'
  },
  answers: {
    type: Map,
    of: Number,
    default: {}
  },
  score: Number,
  timeRemaining: Number,
  submittedAt: Date
}, {
  timestamps: true
});

// Add index for querying
examResponseSchema.index({ student: 1, 'exam.ipfsHash': 1 });

const ExamResponse = mongoose.model('ExamResponse', examResponseSchema);

export default ExamResponse; 