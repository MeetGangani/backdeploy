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
          timestamp: encryptedData.timestamp.toString()
        }
      },
      pinataContent: encryptedData // Upload encrypted content
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
    return {
      ipfsHash: response.data.IpfsHash,
      encryptionKey: ipfsEncryptionKey
    };
  } catch (error) {
    console.error('Pinata upload error:', error);
    throw new Error('Failed to upload encrypted data to IPFS');
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
  let ipfsHash, ipfsKey;

  try {
    const fileRequest = await FileRequest.findById(id)
      .populate('institute', 'name email')
      .exec();
    
    if (!fileRequest) {
      res.status(404);
      throw new Error('Request not found');
    }

    if (!['approved', 'rejected'].includes(status)) {
      res.status(400);
      throw new Error('Invalid status');
    }

    // Process IPFS upload only for approved requests
    if (status === 'approved') {
      try {
        logger.info('Starting approval process...');
        logger.info('File Request Data:', {
          examName: fileRequest.examName,
          hasEncryptedData: !!fileRequest.encryptedData,
          hasEncryptionKey: !!fileRequest.encryptionKey,
          encryptedDataType: typeof fileRequest.encryptedData
        });
        
        // Step 1: Decrypt the stored data
        let decryptedData;
        try {
          // Check if we have the required data
          if (!fileRequest.encryptedData) {
            throw new Error('No encrypted data found');
          }
          if (!fileRequest.encryptionKey) {
            throw new Error('No encryption key found');
          }

          logger.info('Attempting to decrypt data');
          
          // If encryptedData is stored as a Buffer or Object, convert it
          let encryptedDataString;
          if (Buffer.isBuffer(fileRequest.encryptedData)) {
            encryptedDataString = fileRequest.encryptedData.toString('utf8');
          } else if (typeof fileRequest.encryptedData === 'object') {
            encryptedDataString = JSON.stringify(fileRequest.encryptedData);
          } else {
            encryptedDataString = fileRequest.encryptedData;
          }

          logger.info('Encrypted data string:', encryptedDataString.substring(0, 100) + '...');
          
          // Attempt decryption
          decryptedData = decryptFile(encryptedDataString, fileRequest.encryptionKey);
          
          // Ensure decryptedData is in the correct format
          if (typeof decryptedData === 'string') {
            try {
              decryptedData = JSON.parse(decryptedData);
            } catch (parseError) {
              logger.warn('Decrypted data is not JSON, using as is');
            }
          }
          
          logger.info('Successfully decrypted data');

        } catch (decryptError) {
          logger.error('Decryption error details:', {
            error: decryptError.message,
            stack: decryptError.stack,
            encryptedDataSample: fileRequest.encryptedData ? 
              fileRequest.encryptedData.toString().substring(0, 100) + '...' : 
              'No data'
          });
          throw new Error(`Decryption failed: ${decryptError.message}`);
        }

        // Step 2: Generate new encryption key for IPFS
        ipfsKey = generateEncryptionKey();
        logger.info('Generated new IPFS encryption key');

        // Step 3: Encrypt for IPFS
        logger.info('Encrypting for IPFS...');
        const encryptedForIPFS = encryptForIPFS(decryptedData, ipfsKey);
        logger.info('Successfully encrypted for IPFS');

        // Step 4: Upload to Pinata
        logger.info('Preparing Pinata upload...');
        const pinataData = {
          pinataOptions: { cidVersion: 1 },
          pinataMetadata: {
            name: `exam_${fileRequest.examName}_${Date.now()}`,
            keyvalues: { 
              type: "encrypted_exam",
              examName: fileRequest.examName
            }
          },
          pinataContent: encryptedForIPFS
        };

        logger.info('Uploading to Pinata...');
        const pinataResponse = await axios.post(
          'https://api.pinata.cloud/pinning/pinJSONToIPFS',
          pinataData,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${PINATA_JWT}`
            }
          }
        );

        ipfsHash = pinataResponse.data.IpfsHash;
        fileRequest.ipfsHash = ipfsHash;
        fileRequest.ipfsEncryptionKey = ipfsKey;
        logger.info('Successfully uploaded to IPFS:', ipfsHash);

        // Step 5: Send email notification
        try {
          await sendEmail({
            to: fileRequest.institute.email,
            subject: `Exam Request APPROVED - ${fileRequest.examName}`,
            html: examApprovalTemplate({
              instituteName: fileRequest.institute.name,
              examName: fileRequest.examName,
              status: 'approved',
              ipfsHash,
              ipfsEncryptionKey: ipfsKey,
              totalQuestions: fileRequest.totalQuestions,
              timeLimit: fileRequest.timeLimit,
              adminComment
            })
          });
          logger.info('Approval email sent successfully');
        } catch (emailError) {
          logger.error('Email sending error:', emailError);
        }

      } catch (error) {
        logger.error('IPFS process error:', {
          message: error.message,
          stack: error.stack
        });
        throw new Error(`IPFS process failed: ${error.message}`);
      }
    } else if (status === 'rejected') {
      // Send rejection email
      try {
        await sendEmail({
          to: fileRequest.institute.email,
          subject: `Exam Request REJECTED - ${fileRequest.examName}`,
          html: examApprovalTemplate({
            instituteName: fileRequest.institute.name,
            examName: fileRequest.examName,
            status: 'rejected',
            adminComment
          })
        });
        logger.info('Rejection email sent successfully');
      } catch (emailError) {
        logger.error('Email sending error:', emailError);
      }
    }

    // Update request status
    fileRequest.status = status;
    fileRequest.adminComment = adminComment;
    fileRequest.reviewedAt = Date.now();
    fileRequest.reviewedBy = req.user._id;

    await fileRequest.save();

    res.json({
      message: `Request ${status} successfully`,
      status: fileRequest.status,
      ipfsHash: status === 'approved' ? ipfsHash : undefined,
      ipfsEncryptionKey: status === 'approved' ? ipfsKey : undefined
    });

  } catch (error) {
    logger.error('Status update error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      message: `Failed to process ${status}`,
      error: error.message
    });
  }
});

export {
  getRequests,
  updateRequestStatus,
  getDashboardStats
}; 