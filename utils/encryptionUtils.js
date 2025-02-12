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
export const decryptFromIPFS = async (encryptedData, key) => {
  try {
    if (!encryptedData || !key) {
      console.error('Missing data:', { encryptedData: !!encryptedData, key: !!key });
      throw new Error('Missing encrypted data or key');
    }

    // Log received data for debugging
    console.log('Received encrypted data:', encryptedData);

    // Convert the hex key to bytes
    const keyBytes = Buffer.from(key, 'hex');
    
    // Convert base64 IV back to buffer
    const iv = Buffer.from(encryptedData.iv, 'base64');
    
    // Create decipher with aes-256-cbc (same as encryption)
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBytes, iv);
    
    // Decrypt the data from base64 (same format as encryption)
    let decrypted = decipher.update(encryptedData.encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    // Parse the decrypted JSON
    const parsedData = JSON.parse(decrypted);
    console.log('Successfully decrypted data:', parsedData);

    return parsedData;
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

// Single export statement for all functions
export {
  jsonToBinary,
  binaryToJson
};