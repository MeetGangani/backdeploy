import cloudinary from '../config/cloudinaryConfig.js';
import { Readable } from 'stream';

export const uploadToCloudinary = async (buffer) => {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'exam_images',
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        }
      );

      // Convert buffer to stream and pipe to cloudinary
      const stream = Readable.from(buffer);
      stream.pipe(uploadStream);
    });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload image to Cloudinary');
  }
}; 