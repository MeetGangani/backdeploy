import asyncHandler from 'express-async-handler';
import FileRequest from '../models/fileRequestModel.js';
import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sendEmail from '../utils/emailUtils.js';
import { 
  encryptForIPFS, 
  generateEncryptionKey, 
  decryptFile
} from '../utils/encryptionUtils.js';
import { examApprovalTemplate } from '../utils/emailTemplates.js';
import { createLogger } from '../utils/logger.js';
import User from '../models/userModel.js';
import { generateStrongPassword } from '../utils/passwordUtils.js';
import { newUserCredentialsTemplate } from '../utils/emailTemplates.js';
dotenv.config();

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read contractABI.json using ES modules
const contractABI = JSON.parse(
  await readFile(join(__dirname, '../contractABI.json'), 'utf8')
);

// Contract setup - Updated for ethers v6
const contractAddress = process.env.CONTRACT_ADDRESS;
const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(contractAddress, contractABI, wallet);

// Add Pinata configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY;

const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY;
const PINATA_JWT = process.env.PINATA_JWT;

const logger = createLogger('adminController');

// Function to upload encrypted data to Pinata
const uploadEncryptedToPinata = async (jsonData) => {
  try {
    logger.info('Starting Pinata upload process');
    
    // Generate a new encryption key for IPFS
    const ipfsEncryptionKey = generateEncryptionKey();
    
    // Encrypt the data
    const encryptedData = encryptForIPFS(jsonData, ipfsEncryptionKey);
    
    const data = JSON.stringify({
      pinataOptions: {
        cidVersion: 1
      },
      pinataMetadata: {
        name: `exam_${Date.now()}`,
        keyvalues: {
          type: "encrypted_exam",
          timestamp: Date.now().toString()
        }
      },
      pinataContent: encryptedData
    });

    const config = {
      method: 'post',
      url: 'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PINATA_JWT}`
      },
      data: data
    };

    const response = await axios(config);
    
    if (!response.data || !response.data.IpfsHash) {
      throw new Error('Invalid response from Pinata');
    }

    logger.info('Pinata upload successful', {
      ipfsHash: response.data.IpfsHash
    });

    return {
      ipfsHash: response.data.IpfsHash,
      encryptionKey: ipfsEncryptionKey
    };
  } catch (error) {
    logger.error('Pinata upload error:', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Failed to upload to IPFS: ${error.message}`);
  }
};

// Get all file requests
const getRequests = asyncHandler(async (req, res) => {
  try {
    // Debug log
    console.log('Fetching requests for admin...');
    console.log('Admin user:', req.user._id);

    // Fetch all requests, including pending ones
    const requests = await FileRequest.find()
      .populate('institute', 'name email')
      .populate('submittedBy', 'name email')
      .sort('-createdAt')
      .lean();

    // Debug log
    console.log('Found requests:', requests.length);

    const formattedRequests = requests.map(request => ({
      _id: request._id,
      examName: request.examName,
      description: request.description,
      institute: request.institute,
      submittedBy: request.submittedBy,
      status: request.status,
      createdAt: request.createdAt,
      totalQuestions: request.totalQuestions,
      resultsReleased: request.resultsReleased || false
    }));

    // Set proper headers
    res.setHeader('Content-Type', 'application/json');
    res.json(formattedRequests);
  } catch (error) {
    console.error('Error in getRequests:', error);
    res.status(500);
    throw new Error('Failed to fetch requests: ' + error.message);
  }
});

// Get dashboard statistics
const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    const totalRequests = await FileRequest.countDocuments();
    const pendingRequests = await FileRequest.countDocuments({ status: 'pending' });
    const approvedRequests = await FileRequest.countDocuments({ status: 'approved' });
    const rejectedRequests = await FileRequest.countDocuments({ status: 'rejected' });

    // Set proper headers
    res.setHeader('Content-Type', 'application/json');
    res.json({
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests
    });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    res.status(500);
    throw new Error('Failed to fetch dashboard stats: ' + error.message);
  }
});

// Update request status
const updateRequestStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, adminComment } = req.body;

  try {
    logger.info(`Starting request update for ID: ${id}, Status: ${status}`);

    const fileRequest = await FileRequest.findById(id)
      .populate('institute', 'name email')
      .exec();

    if (!fileRequest) {
      logger.error(`Request not found for ID: ${id}`);
      res.status(404);
      throw new Error('Request not found');
    }

    // Process IPFS upload only for approved requests
    if (status === 'approved') {
      try {
        // Decrypt the stored exam data
        logger.info('Found file request:', {
          id: fileRequest._id,
          examName: fileRequest.examName,
          hasEncryptedData: !!fileRequest.encryptedData,
          hasEncryptionKey: !!fileRequest.encryptionKey
        });

        const decryptedData = decryptFile(fileRequest.encryptedData, fileRequest.encryptionKey);
        logger.info('Successfully decrypted exam data');

        // Upload to IPFS with encryption
        const { ipfsHash, encryptionKey } = await uploadEncryptedToPinata(decryptedData);
        logger.info('Successfully uploaded to IPFS:', { ipfsHash });

        // Update file request with IPFS details
        fileRequest.status = status;
        fileRequest.ipfsHash = ipfsHash;
        fileRequest.ipfsEncryptionKey = encryptionKey; // Store the IPFS encryption key
        fileRequest.adminComment = adminComment;
        fileRequest.reviewedAt = Date.now();
        fileRequest.reviewedBy = req.user._id;

        logger.info('Saving file request with IPFS details');
        await fileRequest.save();

        // Send approval email
        try {
          await sendEmail({
            to: fileRequest.institute.email,
            subject: 'Exam Review Update - NexusEdu',
            html: examApprovalTemplate({
              instituteName: fileRequest.institute.name,
              examName: fileRequest.examName,
              status: 'approved',
              feedback: adminComment,
              ipfsHash: ipfsHash,
              encryptionKey: encryptionKey
            })
          });
          logger.info('Approval email sent successfully');
        } catch (emailError) {
          logger.error('Failed to send approval email:', emailError);
        }

        res.json({
          message: 'Request approved and uploaded to IPFS successfully',
          status: fileRequest.status,
          ipfsHash,
          ipfsEncryptionKey: encryptionKey
        });

      } catch (error) {
        logger.error('Approval process error:', {
          error: error.message,
          stack: error.stack
        });
        throw new Error(`Approval process failed: ${error.message}`);
      }
    } else {
      // Handle rejection
      fileRequest.status = status;
      fileRequest.adminComment = adminComment;
      fileRequest.reviewedAt = Date.now();
      fileRequest.reviewedBy = req.user._id;
      
      logger.info('Saving rejected file request');
      await fileRequest.save();

      try {
        // Send rejection email using the template
        await sendEmail({
          to: fileRequest.institute.email,
          subject: 'Exam Review Update - NexusEdu',
          html: examApprovalTemplate({
            instituteName: fileRequest.institute.name,
            examName: fileRequest.examName,
            status: 'rejected',
            feedback: adminComment
          })
        });
        logger.info('Rejection email sent successfully');
      } catch (emailError) {
        logger.error('Failed to send rejection email:', emailError);
      }

      res.json({
        message: 'Request rejected successfully',
        status: fileRequest.status
      });
    }
  } catch (error) {
    logger.error('Status update error:', {
      error: error.message,
      stack: error.stack,
      requestId: id,
      status
    });
    res.status(500).json({
      message: `Failed to process ${status}: ${error.message}`,
      error: error.message
    });
  }
});

// Get all users
const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort('-createdAt')
      .lean();

    res.json(users);
  } catch (error) {
    res.status(500);
    throw new Error('Failed to fetch users: ' + error.message);
  }
});

// Update user status
const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      userType: user.userType,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500);
    throw new Error('Failed to update user status: ' + error.message);
  }
});

// Delete user
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    await User.deleteOne({ _id: id });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500);
    throw new Error('Failed to delete user: ' + error.message);
  }
});

// Add this new endpoint for admin user creation
const createUser = asyncHandler(async (req, res) => {
  const { name, email, userType } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    // Generate a strong password
    const generatedPassword = generateStrongPassword();

    // Create user with generated password
    const user = new User({
      name,
      email,
      password: generatedPassword, // This will be hashed by the User model
      userType,
      isActive: true
    });

    // Save user
    await user.save();

    // Send credentials email
    try {
      await sendEmail({
        to: email,
        subject: 'Your NexusEdu Account Credentials',
        html: newUserCredentialsTemplate({
          name,
          email,
          password: generatedPassword,
          userType
        })
      });
    } catch (emailError) {
      console.error('Failed to send credentials email:', emailError);
      // Continue with the response even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully and credentials sent via email',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        isActive: user.isActive
      }
    });

  } catch (error) {
    res.status(500);
    throw new Error(error.message || 'Failed to create user');
  }
});

export {
  getRequests,
  updateRequestStatus,
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  deleteUser,
  createUser
}; 