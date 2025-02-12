import axios from 'axios';
import { generateEncryptionKey, encryptForIPFS } from './encryptionUtils.js';

export const uploadEncryptedToPinata = async (jsonData) => {
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
        'Authorization': `Bearer ${process.env.PINATA_JWT}`
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