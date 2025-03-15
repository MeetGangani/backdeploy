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
    return iv.toString('base64') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt file');
  }
};

// Decrypt file from storage
const decryptFile = (encryptedData, key) => {
  try {
    console.log('Starting decryption process...');

    // Split IV and encrypted data
    const [ivString, encryptedString] = encryptedData.split(':');
    if (!ivString || !encryptedString) {
      throw new Error('Invalid encrypted data format');
    }

    // Convert IV and key from strings
    const iv = Buffer.from(ivString, 'base64');
    const keyBuffer = Buffer.from(key, 'hex');

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    
    // Decrypt data
    let decrypted = decipher.update(encryptedString, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse JSON if possible
    try {
      return JSON.parse(decrypted);
    } catch (parseError) {
      console.log('Returning raw decrypted string');
      return decrypted;
    }
  } catch (error) {
    console.error('Decryption error:', {
      message: error.message,
      stack: error.stack
    });
    throw new Error(`Decryption failed: ${error.message}`);
  }
};

// Encrypt for IPFS
const encryptForIPFS = (data, key) => {
  try {
    // Ensure data is properly stringified
    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
    
    // Convert key to buffer
    const keyBuffer = Buffer.from(key, 'hex');
    
    // Generate IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    
    // Encrypt data
    let encrypted = cipher.update(dataString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return {
      iv: iv.toString('base64'),
      encryptedData: encrypted,
      timestamp: Date.now(),
      version: '1.0'
    };
  } catch (error) {
    console.error('IPFS encryption error:', error);
    throw new Error(`Failed to encrypt for IPFS: ${error.message}`);
  }
};

// Decrypt from IPFS
const decryptFromIPFS = (encryptedObject, key) => {
  try {
    console.log('Starting IPFS decryption with key length:', key ? key.length : 0);
    
    if (!key) {
      throw new Error('Encryption key is missing or invalid');
    }
    
    if (!encryptedObject || !encryptedObject.iv || !encryptedObject.encryptedData) {
      console.error('Invalid encrypted object format:', encryptedObject);
      throw new Error('Invalid encrypted object format');
    }
    
    const keyBuffer = Buffer.from(key, 'hex');
    const iv = Buffer.from(encryptedObject.iv, 'base64');
    
    // Validate key and IV
    if (keyBuffer.length !== 32) {
      console.error(`Invalid key length: ${keyBuffer.length}, expected 32`);
      throw new Error(`Invalid key length: ${keyBuffer.length}, expected 32`);
    }
    
    if (iv.length !== 16) {
      console.error(`Invalid IV length: ${iv.length}, expected 16`);
      throw new Error(`Invalid IV length: ${iv.length}, expected 16`);
    }
    
    console.log('Creating decipher with key and IV');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    
    console.log('Decrypting data...');
    let decrypted;
    try {
      decrypted = decipher.update(encryptedObject.encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
    } catch (cipherError) {
      console.error('Cipher operation failed:', cipherError);
      throw cipherError;
    }
    
    console.log('Decryption successful, parsing JSON...');
    try {
      return JSON.parse(decrypted);
    } catch (parseError) {
      console.error('Failed to parse decrypted data as JSON:', parseError);
      console.log('Decrypted data preview:', decrypted.substring(0, 100) + '...');
      throw new Error('Failed to parse decrypted data as JSON');
    }
  } catch (error) {
    console.error('IPFS decryption error:', error);
    throw error;
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