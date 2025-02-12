import express from 'express';
import { downloadAndDecryptFile } from '../controllers/fileController.js';
import { protect, studentOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Route for downloading and decrypting files
router.get('/download/:ipfsHash', protect, studentOnly, downloadAndDecryptFile);

export default router; 