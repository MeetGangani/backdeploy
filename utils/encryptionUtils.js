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

// Add constant for key derivation iterations
const PBKDF2_ITERATIONS = 100000;

// Add key derivation function
const deriveKey = (password, salt) => {
  return crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    32,
    'sha512'
  );
};

// Encrypt file for initial storage
export const encryptFile = (data, secretKey) => {
  try {
    const salt = crypto.randomBytes(16);
    const key = deriveKey(secretKey, salt);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(
      typeof data === 'object' ? JSON.stringify(data) : data,
      'utf8',
      'base64'
    );
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return {
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      encrypted,
      authTag: authTag.toString('base64')
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt file');
  }
};

// Decrypt file from storage
export const decryptFile = (encryptedData, secretKey) => {
  try {
    const { salt, iv, encrypted, authTag } = encryptedData;
    
    const key = deriveKey(secretKey, Buffer.from(salt, 'base64'));
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
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
    const encryptionKey = generateEncryptionKey();
    const encrypted = encryptFile(buffer, encryptionKey);
    return { encrypted, encryptionKey };
  } catch (error) {
    console.error('File processing error:', error);
    throw new Error('Failed to process file');
  }
};