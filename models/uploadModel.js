import mongoose from 'mongoose';

const uploadSchema = new mongoose.Schema(
  {
    institute: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    examName: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    questions: [{
      question: {
        type: String,
        required: true
      },
      options: [{
        type: String,
        required: true
      }],
      correctAnswer: {
        type: Number,
        required: true
      }
    }],
    totalQuestions: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    resultsReleased: {
      type: Boolean,
      default: false
    },
    file: {
      data: Buffer,
      contentType: String
    }
  },
  {
    timestamps: true
  }
);

const Upload = mongoose.model('Upload', uploadSchema);

export default Upload; 