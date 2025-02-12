import CryptoJS from 'crypto-js';
import crypto from 'crypto';

// Generate a random encryption key
export const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Convert JSON to binary buffer
export const jsonToBinary = (jsonData) => {
  return Buffer.from(JSON.stringify(jsonData));
};

// Convert binary to JSON
export const binaryToJson = (buffer) => {
  return JSON.parse(buffer.toString());
};

// Encrypt file for initial storage
export const encryptFile = (data, secretKey) => {
  try {
    // Convert data to string if it's an object
    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
    
    // Generate IV
    const iv = CryptoJS.lib.WordArray.random(16);
    
    // Encrypt using CryptoJS with IV
    const encrypted = CryptoJS.AES.encrypt(dataString, secretKey, {
      iv: iv
    });
    
    // Return IV and encrypted data concatenated
    return iv.toString() + ':' + encrypted.toString();
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt file');
  }
};

// Decrypt file from storage
export const decryptFile = (encryptedData, secretKey) => {
  try {
    const [iv, data] = encryptedData.split(':');
    
    const decrypted = CryptoJS.AES.decrypt(data, secretKey, {
      iv: CryptoJS.enc.Hex.parse(iv)
    });
    
    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt file');
  }
};

// Encrypt for IPFS
export const encryptForIPFS = (data, key) => {
  try {
    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
    const keyBytes = Buffer.from(key, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBytes, iv);
    
    let encryptedData = cipher.update(dataString, 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    
    return {
      iv: iv.toString('base64'),
      encryptedData: encryptedData
    };
  } catch (error) {
    console.error('IPFS encryption error:', error);
    throw new Error('Failed to encrypt for IPFS');
  }
};

// Decrypt data from IPFS
export const decryptFromIPFS = async (encryptedData, key) => {
  try {
    if (!encryptedData || !key) {
      console.error('Missing data:', { encryptedData: !!encryptedData, key: !!key });
      throw new Error('Missing encrypted data or key');
    }

    const keyBytes = Buffer.from(key, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBytes, iv);
    
    let decrypted = decipher.update(encryptedData.encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('IPFS decryption error:', error);
    throw new Error(`Failed to decrypt IPFS data: ${error.message}`);
  }
};

// Process file function
export const processFile = (buffer) => {
  try {
    // Parse JSON content
    const jsonContent = JSON.parse(buffer.toString());
    
    // Generate encryption key
    const encryptionKey = generateEncryptionKey();
    
    // Encrypt the JSON data
    const encrypted = encryptFile(jsonContent, encryptionKey);
    
    return { encrypted, encryptionKey };
  } catch (error) {
    console.error('File processing error:', error);
    throw new Error('Failed to process file');
  }
};