import asyncHandler from 'express-async-handler';
import nodemailer from 'nodemailer';

// @desc    Send contact form message
// @route   POST /api/contact
// @access  Public
const sendContactMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Create a transporter using your email service
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // Your Gmail address
      pass: process.env.EMAIL_PASS  // Your Gmail password or App-specific password
    }
  });

  // Modern and attractive email template
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          .email-container {
            max-width: 650px;
            margin: 0 auto;
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            background-color: #F3F4F6;
            padding: 20px;
          }

          .card {
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }

          .header {
            background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #D946EF 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }

          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20" fill="none"/><circle cx="3" cy="3" r="1" fill="rgba(255,255,255,0.1)"/></svg>');
            opacity: 0.3;
          }

          .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: 700;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .header p {
            font-size: 16px;
            opacity: 0.9;
          }

          .content {
            padding: 30px;
          }

          .info-item {
            margin-bottom: 25px;
            background: #F9FAFB;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #E5E7EB;
          }

          .label {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6366F1;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .value {
            color: #1F2937;
            font-size: 16px;
            line-height: 1.6;
          }

          .message-box {
            background: #F3F4F6;
            padding: 25px;
            border-radius: 12px;
            margin-top: 20px;
            border-left: 4px solid #8B5CF6;
          }

          .message-box .value {
            white-space: pre-line;
          }

          .timestamp {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px dashed #E5E7EB;
            color: #6B7280;
            font-size: 14px;
            text-align: right;
          }

          .footer {
            text-align: center;
            padding: 30px;
            background: #F9FAFB;
            border-top: 1px solid #E5E7EB;
          }

          .footer img {
            height: 40px;
            margin-bottom: 15px;
          }

          .footer p {
            color: #6B7280;
            font-size: 14px;
            margin: 5px 0;
          }

          .social-links {
            margin-top: 20px;
          }

          .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: #6366F1;
            text-decoration: none;
          }

          .highlight {
            color: #6366F1;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="card">
            <div class="header">
              <h1>✨ New Message Received</h1>
              <p>Someone has reached out through KryptoExam</p>
            </div>
            
            <div class="content">
              <div class="info-item">
                <div class="label">From</div>
                <div class="value">
                  <span class="highlight">${name}</span> 
                  <br/>
                  <span style="color: #6B7280;">${email}</span>
                </div>
              </div>
              
              <div class="info-item">
                <div class="label">Subject</div>
                <div class="value highlight">${subject}</div>
              </div>
              
              <div class="message-box">
                <div class="label">Message</div>
                <div class="value">${message.replace(/\n/g, '<br>')}</div>
              </div>
              
              <div class="timestamp">
                📅 Received on: ${new Date().toLocaleString('en-US', {
                  timeZone: 'Asia/Kolkata',
                  dateStyle: 'full',
                  timeStyle: 'long'
                })}
              </div>
            </div>
            
            <div class="footer">
              <img src="https://your-logo-url.png" alt="KryptoExam Logo" />
              <p>Secure Examination System</p>
              <p>© ${new Date().getFullYear()} KryptoExam. All rights reserved.</p>
              <div class="social-links">
                <a href="#">Twitter</a> • 
                <a href="#">LinkedIn</a> • 
                <a href="#">Facebook</a>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  // Email options
  const mailOptions = {
    from: email,
    to: 'kryptoexam@gmail.com', // Your email where you want to receive messages
    subject: `✨ New Contact: ${subject}`,
    html: htmlTemplate,
    // Add a plain text version for email clients that don't support HTML
    text: `
      New Message from KryptoExam Contact Form

      From: ${name} (${email})
      Subject: ${subject}

      Message:
      ${message}

      Received: ${new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata'
      })}

      KryptoExam - Secure Examination System
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Message sent successfully' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500);
    throw new Error('Error sending message. Please try again.');
  }
});

export { sendContactMessage }; 