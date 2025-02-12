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
import { encryptForIPFS, generateEncryptionKey, decryptFile, binaryToJson } from '../utils/encryptionUtils.js';
import { examApprovalTemplate } from '../utils/emailTemplates.js';
import { createLogger } from '../utils/logger.js';
import Upload from '../models/uploadModel.js';

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

// @desc    Get all upload requests
// @route   GET /api/admin/requests
// @access  Private/Admin
const getRequests = asyncHandler(async (req, res) => {
  try {
    const requests = await Upload.find()
      .populate('institute', 'name email')
      .select('-file.data')
      .sort('-createdAt');

    const totalCount = await Upload.countDocuments();
    const pendingCount = await Upload.countDocuments({ status: 'pending' });
    const approvedCount = await Upload.countDocuments({ status: 'approved' });
    const rejectedCount = await Upload.countDocuments({ status: 'rejected' });

    res.json({
      requests,
      stats: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      }
    });
  } catch (error) {
    logger.error('Get requests error:', error);
    res.status(500);
    throw new Error('Failed to fetch requests');
  }
});

// @desc    Update request status
// @route   PUT /api/admin/requests/:id
// @access  Private/Admin
const updateRequestStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      res.status(400);
      throw new Error('Invalid status');
    }

    // Get the request with institute details
    const request = await FileRequest.findById(id).populate('institute', 'email name');
    if (!request) {
      res.status(404);
      throw new Error('Request not found');
    }

    if (status === 'approved') {
      try {
        logger.info(`Processing approval for exam ${request.examName}`);

        // Convert stored binary data back to JSON
        const decryptedData = decryptFile(request.encryptedData, request.encryptionKey);
        const examData = binaryToJson(decryptedData);

        // Generate new encryption key for IPFS
        const ipfsEncryptionKey = generateEncryptionKey();

        // Prepare and encrypt data for IPFS
        const ipfsData = {
          examName: examData.examName,
          questions: examData.questions,
          totalQuestions: examData.totalQuestions,
          timeLimit: examData.timeLimit,
          timestamp: Date.now()
        };

        const encryptedIPFSData = encryptForIPFS(ipfsData, ipfsEncryptionKey);

        // Prepare metadata for IPFS
        const pinataData = {
          pinataOptions: { cidVersion: 1 },
          pinataMetadata: {
            name: `exam_${examData.examName}_${Date.now()}`,
            keyvalues: {
              examId: request._id.toString(),
              type: "encrypted_exam",
              timestamp: Date.now().toString()
            }
          },
          pinataContent: encryptedIPFSData
        };

        // Upload to IPFS
        const pinataResponse = await axios.post(
          'https://api.pinata.cloud/pinning/pinJSONToIPFS',
          pinataData,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.PINATA_JWT}`
            }
          }
        );

        logger.info('File uploaded to IPFS successfully');

        // Update request with IPFS data
        request.ipfsHash = pinataResponse.data.IpfsHash;
        request.ipfsEncryptionKey = ipfsEncryptionKey;
      } catch (error) {
        logger.error('Error in approval process:', error);
        throw new Error('Failed to process approval: ' + error.message);
      }
    }

    // Update request status
    request.status = status;
    request.feedback = feedback;
    request.reviewedBy = req.user._id;
    request.reviewedAt = Date.now();

    const updatedRequest = await request.save();

    // Send email notification
    try {
      const emailContent = examApprovalTemplate({
        instituteName: request.institute.name,
        examName: request.examName,
        status,
        feedback,
        ipfsHash: request.ipfsHash,
        encryptionKey: request.ipfsEncryptionKey
      });

      await sendEmail({
        to: request.institute.email,
        subject: `Exam Request ${status.toUpperCase()}`,
        html: emailContent
      });
    } catch (emailError) {
      logger.error('Email sending error:', emailError);
    }

    res.json({
      message: `Request ${status} successfully`,
      request: {
        _id: updatedRequest._id,
        examName: updatedRequest.examName,
        status: updatedRequest.status,
        feedback: updatedRequest.feedback,
        ipfsHash: updatedRequest.ipfsHash
      }
    });

  } catch (error) {
    logger.error('Update status error:', error);
    throw new Error(error.message || 'Failed to update request status');
  }
});

export { getRequests, updateRequestStatus }; 