import asyncHandler from 'express-async-handler';
import FileRequest from '../models/fileRequestModel.js';
import crypto from 'crypto';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sendEmail from '../utils/emailUtils.js';
import { processFile } from '../utils/encryptionUtils.js';
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
    console.error('Get requests error:', error);
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

    const request = await Upload.findById(id).populate('institute', 'email name');
    if (!request) {
      res.status(404);
      throw new Error('Request not found');
    }

    if (status === 'approved') {
      try {
        // Process and encrypt file using existing utility
        const { encrypted: encryptedData, encryptionKey } = await processFile(request.file.data);
        request.encryptedData = encryptedData;
        request.encryptionKey = encryptionKey;
      } catch (error) {
        console.error('File processing error:', error);
        res.status(500);
        throw new Error('Failed to process file');
      }
    }

    request.status = status;
    request.feedback = feedback || '';
    const updatedRequest = await request.save();

    // Send email notification
    try {
      const emailContent = examApprovalTemplate({
        instituteName: request.institute.name,
        examName: request.examName,
        status: status,
        feedback: feedback || '',
        totalQuestions: request.totalQuestions
      });

      await sendEmail({
        to: request.institute.email,
        subject: `Exam Request ${status.toUpperCase()}`,
        html: emailContent
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Continue even if email fails
    }

    res.json({
      message: `Request ${status}`,
      request: {
        _id: updatedRequest._id,
        examName: updatedRequest.examName,
        status: updatedRequest.status,
        feedback: updatedRequest.feedback
      }
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(error.status || 500);
    throw new Error(error.message || 'Failed to update request status');
  }
});

export { getRequests, updateRequestStatus }; 