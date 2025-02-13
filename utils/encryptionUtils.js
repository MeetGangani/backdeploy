import CryptoJS from 'crypto-js';
import crypto from 'crypto';

// Generate a random encryption key
export const generateEncryptionKey = () => {
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
export const decryptFile = (encryptedData, key) => {
  try {
    // Split IV and encrypted data
    const [ivString, encryptedString] = encryptedData.split(':');
    
    if (!ivString || !encryptedString) {
      throw new Error('Invalid encrypted data format');
    }
    
    // Create decryption options with IV
    const options = {
      iv: CryptoJS.enc.Hex.parse(ivString)
    };
    
    // Decrypt using CryptoJS with IV
    const decrypted = CryptoJS.AES.decrypt(encryptedString, key, options);
    
    // Convert to string and parse JSON
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(`Failed to decrypt file: ${error.message}`);
  }
};

// Encrypt for IPFS
export const encryptForIPFS = (data, key) => {
  try {
    // Convert data to string if it's an object
    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
    
    // Convert the hex key to bytes
    const keyBytes = Buffer.from(key, 'hex');
    
    // Generate IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBytes, iv);
    
    // Encrypt the data
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
export const decryptFromIPFS = (encryptedObject, key) => {
  try {
    // Convert the hex key to bytes
    const keyBytes = Buffer.from(key, 'hex');
    
    // Convert base64 IV back to buffer
    const iv = Buffer.from(encryptedObject.iv, 'base64');
    
    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBytes, iv);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedObject.encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse the decrypted JSON
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
  binaryToJson
};