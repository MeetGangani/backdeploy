import asyncHandler from 'express-async-handler';
import axios from 'axios';
import crypto from 'crypto';
import { decryptFile } from '../utils/encryptionUtils.js';

const downloadAndDecryptFile = asyncHandler(async (req, res) => {
    try {
        const { ipfsHash } = req.params;
        console.log('Received request for IPFS Hash:', ipfsHash);

        // Known encryption key for the file
        const encryptionKey = '700dade8f6f34badf41cf4c7468d9b50969c51a13c95a58bfc2f2abef7682e75';
        
        const fileUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        console.log('Fetching from:', fileUrl);
    
        // Fetch the encrypted file from IPFS
        const response = await axios.get(fileUrl, { 
            responseType: 'text',
            headers: {
                'Accept': '*/*'
            }
        });
        
        if (!response.data) {
            throw new Error('No data received from IPFS');
        }
        
        console.log('Data received from IPFS, length:', response.data.length);
        console.log('Data sample:', response.data.substring(0, 100)); // Log first 100 chars
    
        // Decrypt the file
        const decryptedData = decryptFile(response.data, encryptionKey);
        if (!decryptedData) {
            throw new Error('Decryption resulted in empty data');
        }
        console.log('Decryption successful, length:', decryptedData.length);

        // Convert the decrypted data to a Buffer
        const pdfBuffer = Buffer.from(decryptedData, 'binary');
        console.log('PDF buffer created, size:', pdfBuffer.length);

        if (pdfBuffer.length === 0) {
            throw new Error('PDF buffer is empty');
        }
    
        // Send file to the frontend
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', 'inline; filename="decrypted.pdf"');
        res.send(pdfBuffer);
    
    } catch (error) {
        console.error('Error details:', error);
        res.status(500).json({ 
            message: 'Failed to process file',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

export { downloadAndDecryptFile };