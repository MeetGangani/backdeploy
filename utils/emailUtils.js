import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send email using nodemailer
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.email - Alternative recipient email field
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Email body text
 * @param {string} options.html - Email body HTML
 */
const sendEmail = async (options) => {
  try {
    // Support both .to and .email fields for recipient
    const recipient = options.to || options.email;
    
    if (!recipient) {
      throw new Error('Recipient email is required');
    }

    const mailOptions = {
      from: {
        name: 'Exam Portal',
        address: process.env.EMAIL_USER
      },
      to: recipient,
      subject: options.subject,
      text: options.text,
      html: options.html
    };

    // Remove undefined fields
    Object.keys(mailOptions).forEach(key => 
      mailOptions[key] === undefined && delete mailOptions[key]
    );

    console.log('Sending email to:', recipient);
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email sending error details:', {
      error: error.message,
      recipient: options.to || options.email,
      subject: options.subject
    });
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Verify transporter connection
transporter.verify(function (error, success) {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready to send emails');
  }
});

export default sendEmail; 