import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createLogger } from './logger.js';

dotenv.config();
const logger = createLogger('emailUtils');

// Create a transporter using SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    },
    maxConnections: 5,
    maxMessages: 10,
    pool: true
  });
};

const transporter = createTransporter();

/**
 * Send email with retry logic
 * @param {Object} options - Email options
 * @param {number} retries - Number of retries (default: 3)
 */
const sendEmail = async (options, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const recipient = options.to || options.email;
      
      if (!recipient) {
        throw new Error('Recipient email is required');
      }

      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || 'Exam Portal',
          address: process.env.EMAIL_USER
        },
        to: recipient,
        subject: options.subject,
        text: options.text,
        html: options.html,
        headers: {
          'X-Environment': process.env.NODE_ENV,
          'X-Priority': 'High'
        }
      };

      // Remove undefined fields
      Object.keys(mailOptions).forEach(key => 
        mailOptions[key] === undefined && delete mailOptions[key]
      );

      logger.info(`Attempt ${attempt}: Sending email to ${recipient}`);
      const info = await transporter.sendMail(mailOptions);
      logger.info('Email sent successfully:', info.messageId);
      return info;

    } catch (error) {
      logger.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        logger.error('All retry attempts failed');
        throw new Error(`Failed to send email after ${retries} attempts: ${error.message}`);
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

// Monitor transporter health
const monitorTransporter = () => {
  setInterval(async () => {
    try {
      await transporter.verify();
      logger.info('SMTP connection is healthy');
    } catch (error) {
      logger.error('SMTP connection error:', error);
      transporter.close();
      transporter = createTransporter();
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
};

// Start monitoring in production
if (process.env.NODE_ENV === 'production') {
  monitorTransporter();
}

export default sendEmail; 