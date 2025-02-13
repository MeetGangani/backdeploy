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
    
    // Ensure the key is the correct length (32 bytes = 256 bits)
    const keyBytes = Buffer.from(secretKey, 'hex');
    if (keyBytes.length !== 32) {
      throw new Error('Invalid key length');
    }

    // Create a WordArray from the key bytes
    const key = CryptoJS.lib.WordArray.create(keyBytes);
    
    // Generate a random IV
    const iv = CryptoJS.lib.WordArray.random(16);
    
    // Encrypt using CryptoJS
    const encrypted = CryptoJS.AES.encrypt(dataString, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Combine IV and encrypted data
    const combined = iv.toString(CryptoJS.enc.Base64) + ':' + encrypted.toString();
    
    return combined;
  } catch (error) {
    console.error('Encryption error details:', {
      error: error.message,
      stack: error.stack,
      keyLength: secretKey?.length,
      dataType: typeof data
    });
    throw new Error('Failed to encrypt file');
  }
};

// Decrypt file from storage
const decryptFile = (encryptedData, key) => {
  try {
    console.log('Attempting to decrypt with:', {
      keyLength: key.length,
      encryptedDataSample: encryptedData.substring(0, 100)
    });

    // Split IV and encrypted data
    const [ivString, encryptedString] = encryptedData.split(':');
    if (!ivString || !encryptedString) {
      throw new Error('Invalid encrypted data format');
    }

    // Convert key to WordArray
    const keyBytes = Buffer.from(key, 'hex');
    const keyWordArray = CryptoJS.lib.WordArray.create(keyBytes);

    // Convert IV from Base64
    const iv = CryptoJS.enc.Base64.parse(ivString);
    
    // Decrypt using CryptoJS
    const decrypted = CryptoJS.AES.decrypt(encryptedString, keyWordArray, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Convert to string
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) {
      throw new Error('Decryption resulted in empty string');
    }
    
    // Parse JSON
    try {
      return JSON.parse(decryptedString);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return decryptedString;
    }
  } catch (error) {
    console.error('Decryption error:', {
      message: error.message,
      stack: error.stack,
      inputSample: encryptedData.substring(0, 100)
    });
    throw new Error(`Failed to decrypt file: ${error.message}`);
  }
};

// Encrypt for IPFS (using different method)
const encryptForIPFS = (data, key) => {
  try {
    const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
    const keyBuffer = Buffer.from(key, 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
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
    const keyBuffer = Buffer.from(key, 'hex');
    const iv = Buffer.from(encryptedObject.iv, 'base64');
    
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