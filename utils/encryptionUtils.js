import CryptoJS from 'crypto-js';
import crypto from 'crypto';

// Generate a random encryption key
const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Convert JSON to binary buffer
const jsonToBinary = (jsonData) => {
  return Buffer.from(JSON.stringify(jsonData));
};

// Convert binary to JSON
const binaryToJson = (buffer) => {
  return JSON.parse(buffer.toString());
};

// Encrypt file for initial storage
const encryptFile = (data, secretKey) => {
  try {
    // Convert data to string if it's an object
    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
    
    // Generate IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey, 'hex'), iv);
    
    // Encrypt the data
    let encrypted = cipher.update(dataString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Combine IV and encrypted data
    const result = `${iv.toString('base64')}:${encrypted}`;
    
    // Return base64 encoded string for consistent storage
    return Buffer.from(result).toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt file');
  }
};

// Decrypt file from storage
const decryptFile = (encryptedData, key) => {
  try {
    console.log('Decrypting data:', {
      dataType: typeof encryptedData,
      hasData: !!encryptedData,
      keyType: typeof key,
      hasKey: !!key,
      dataSample: encryptedData ? encryptedData.substring(0, 100) : 'No data'
    });

    // Validate inputs
    if (!encryptedData || !key) {
      throw new Error('Missing required decryption parameters');
    }

    // First, try to decode base64 if the data is base64 encoded
    let decodedData;
    try {
      // Check if the string is base64 encoded
      if (/^[A-Za-z0-9+/=]+$/.test(encryptedData)) {
        decodedData = Buffer.from(encryptedData, 'base64').toString('utf8');
        console.log('Decoded base64 data:', decodedData.substring(0, 100));
      } else {
        decodedData = encryptedData;
      }
    } catch (decodeError) {
      console.error('Base64 decode error:', decodeError);
      decodedData = encryptedData; // Use original if decode fails
    }

    // Split IV and encrypted data
    const parts = decodedData.split(':');
    if (parts.length !== 2) {
      // Try one more base64 decode if splitting failed
      try {
        const secondDecode = Buffer.from(decodedData, 'base64').toString('utf8');
        parts = secondDecode.split(':');
        if (parts.length !== 2) {
          throw new Error(`Invalid encrypted data format after second decode. Got: "${secondDecode.substring(0, 50)}..."`);
        }
      } catch (error) {
        throw new Error(`Invalid encrypted data format. Expected format: "iv:encryptedData", got: "${decodedData.substring(0, 50)}..."`);
      }
    }

    const [ivString, encryptedContent] = parts;
    
    if (!ivString || !encryptedContent) {
      throw new Error('Invalid encrypted data format: missing IV or content');
    }
    
    // Convert IV and key from string format
    const iv = Buffer.from(ivString, 'base64');
    const keyBuffer = Buffer.from(key, 'hex');
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedContent, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Try to parse the decrypted JSON
    try {
      return JSON.parse(decrypted);
    } catch (parseError) {
      console.log('Decrypted data (not JSON):', decrypted.substring(0, 100));
      // If it's not JSON, return as is
      return decrypted;
    }
  } catch (error) {
    console.error('Decryption error:', {
      message: error.message,
      stack: error.stack,
      inputData: encryptedData ? encryptedData.substring(0, 100) : 'No data'
    });
    throw new Error(`Failed to decrypt file: ${error.message}`);
  }
};

// Encrypt for IPFS
const encryptForIPFS = (data, key) => {
  try {
    // Convert data to string if it's an object
    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
    
    // Generate IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    
    // Encrypt the data
    let encrypted = cipher.update(dataString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return {
      iv: iv.toString('base64'),
      encryptedData: encrypted,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('IPFS encryption error:', error);
    throw new Error('Failed to encrypt for IPFS');
  }
};

// Decrypt from IPFS
const decryptFromIPFS = (encryptedObject, key) => {
  try {
    const iv = Buffer.from(encryptedObject.iv, 'base64');
    const keyBuffer = Buffer.from(key, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    
    let decrypted = decipher.update(encryptedObject.encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('IPFS decryption error:', error);
    throw new Error('Failed to decrypt IPFS data');
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

// Single export statement for all functions
export {
  jsonToBinary,
  binaryToJson,
  generateEncryptionKey,
  encryptFile,
  decryptFile,
  encryptForIPFS,
  decryptFromIPFS
};