import asyncHandler from 'express-async-handler';
import axios from 'axios';
import crypto from 'crypto';
import { decryptFile } from '../utils/encryptionUtils.js';

const downloadAndDecryptFile = asyncHandler(async (req, res) => {
    try {
        const { ipfsHash } = req.params;
        console.log('Received request for IPFS Hash:', ipfsHash);

        // Use a fallback gateway if Pinata fails
        const gateways = [
            `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
            `https://ipfs.io/ipfs/${ipfsHash}`,
            `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
        ];

        let response;
        for (const gateway of gateways) {
            try {
                response = await axios.get(gateway, { 
                    responseType: 'text',
                    headers: {
                        'Accept': '*/*'
                    },
                    timeout: 10000 // 10 second timeout
                });
                if (response.data) break;
            } catch (err) {
                console.log(`Failed to fetch from ${gateway}:`, err.message);
                continue;
            }
        }

        if (!response?.data) {
            throw new Error('Failed to fetch file from all IPFS gateways');
        }
        
        console.log('Data received from IPFS, length:', response.data.length);
        console.log('Data sample:', response.data.substring(0, 100)); // Log first 100 chars
    
        // Decrypt the file
        const decryptedData = decryptFile(response.data, '700dade8f6f34badf41cf4c7468d9b50969c51a13c95a58bfc2f2abef7682e75');
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