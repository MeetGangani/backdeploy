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
    
    // Generate IV (16 bytes)
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey, 'hex'), iv);
    
    // Encrypt the data
    let encrypted = cipher.update(dataString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Combine IV and encrypted data (using hex for IV)
    const result = `${iv.toString('hex')}:${encrypted}`;
    
    // Return base64 encoded final result
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

    // First base64 decode
    let decodedData;
    try {
      decodedData = Buffer.from(encryptedData, 'base64').toString('utf8');
      console.log('First decode:', decodedData.substring(0, 100));
    } catch (error) {
      console.error('First base64 decode failed:', error);
      decodedData = encryptedData;
    }

    // Split the decoded data
    const [ivHex, encryptedContent] = decodedData.split(':');
    
    if (!ivHex || !encryptedContent) {
      throw new Error('Invalid data format after decode');
    }

    // Convert hex IV to buffer (assuming IV is in hex format)
    let iv;
    try {
      // Try hex decode first
      iv = Buffer.from(ivHex, 'hex');
      if (iv.length !== 16) {
        // If not 16 bytes, try base64
        iv = Buffer.from(ivHex, 'base64');
      }
    } catch (error) {
      console.error('IV conversion failed:', error);
      // Last resort: try to pad or truncate to 16 bytes
      iv = Buffer.alloc(16);
      const tempIv = Buffer.from(ivHex);
      tempIv.copy(iv);
    }

    // Ensure IV is exactly 16 bytes
    if (iv.length !== 16) {
      iv = iv.slice(0, 16);
      if (iv.length < 16) {
        const temp = Buffer.alloc(16);
        iv.copy(temp);
        iv = temp;
      }
    }

    console.log('IV buffer length:', iv.length);
    console.log('IV buffer:', iv.toString('hex'));

    // Convert key to proper format
    const keyBuffer = Buffer.from(key, 'hex');
    
    // Create decipher with validated IV
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    
    // Try to decrypt
    let decrypted;
    try {
      decrypted = decipher.update(encryptedContent, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
    } catch (error) {
      console.error('Decipher operation failed:', error);
      // Try alternative base64 decode of encrypted content
      const altEncryptedContent = Buffer.from(encryptedContent, 'base64').toString('base64');
      decrypted = decipher.update(altEncryptedContent, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
    }

    // Try to parse as JSON
    try {
      return JSON.parse(decrypted);
    } catch (error) {
      console.log('Not JSON, returning as string:', decrypted.substring(0, 100));
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