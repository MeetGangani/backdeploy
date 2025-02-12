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
    required: true,
    validate: {
      validator: function(v) {
        return v.size > 0;
      },
      message: 'At least one answer must be provided'
    }
  },
  score: {
    type: Number,
    required: true,
    min: [0, 'Score cannot be negative'],
    max: [100, 'Score cannot exceed 100']
  },
  correctAnswers: {
    type: Number,
    required: true,
    min: 0
  },
  totalQuestions: {
    type: Number,
    required: true,
    min: 1
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  timeSpent: {
    type: Number, // in minutes
    required: true,
    min: 0
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Add compound index for better query performance
examResponseSchema.index({ student: 1, exam: 1 }, { unique: true });
examResponseSchema.index({ exam: 1, submittedAt: -1 });

const ExamResponse = mongoose.model('ExamResponse', examResponseSchema);
export default ExamResponse; 