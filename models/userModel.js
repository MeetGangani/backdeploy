import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minLength: [2, 'Name must be at least 2 characters long']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minLength: [6, 'Password must be at least 6 characters long']
    },
    userType: {
      type: String,
      required: true,
      enum: {
        values: ['student', 'admin', 'institute'],
        message: '{VALUE} is not a valid user type'
      },
      default: 'student'
    },
    // Common fields for contact info
    contactNumber: {
      type: String,
      validate: {
        validator: function(v) {
          return /^\+?[\d\s-]{10,}$/.test(v);
        },
        message: props => `${props.value} is not a valid phone number!`
      }
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: String
    },
    // Student specific fields
    gender: {
      type: String,
      enum: {
        values: ['male', 'female', 'other'],
        message: '{VALUE} is not a valid gender'
      },
      required: function() { return this.userType === 'student'; }
    },
    dateOfBirth: {
      type: Date,
      required: function() { return this.userType === 'student'; }
    },
    guardianInfo: {
      name: {
        type: String,
        required: function() { return this.userType === 'student'; }
      },
      contactNumber: {
        type: String,
        required: function() { return this.userType === 'student'; },
        validate: {
          validator: function(v) {
            return /^\+?[\d\s-]{10,}$/.test(v);
          },
          message: props => `${props.value} is not a valid phone number!`
        }
      },
      relation: {
        type: String,
        required: function() { return this.userType === 'student'; }
      }
    },
    // Institute specific fields
    website: {
      type: String,
      required: function() { return this.userType === 'institute'; },
      validate: {
        validator: function(v) {
          return /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(v);
        },
        message: props => `${props.value} is not a valid URL!`
      }
    },
    registrationNumber: {
      type: String,
      required: function() { return this.userType === 'institute'; },
      unique: true,
      sparse: true
    },
    instituteType: {
      type: String,
      enum: {
        values: ['school', 'college', 'university'],
        message: '{VALUE} is not a valid institute type'
      },
      required: function() { return this.userType === 'institute'; }
    },
    lastLogin: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
  }
);

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

export default User;
