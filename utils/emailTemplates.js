/**
 * Generates HTML email template for exam approval/rejection
 * @param {Object} examData - The exam data
 * @param {string} examData.examName - Name of the exam
 * @param {string} examData.ipfsHash - IPFS hash (for approved exams)
 * @param {string} examData.ipfsEncryptionKey - Encryption key (for approved exams)
 * @param {number} examData.totalQuestions - Total number of questions
 * @param {number} examData.timeLimit - Time limit in minutes
 * @param {string} examData.adminComment - Admin's comment
 * @param {('approved'|'rejected')} status - Status of the exam request
 * @returns {string} HTML email template
 */
export const examApprovalTemplate = ({ instituteName, examName, status, feedback, ipfsHash }) => {
  const statusColor = status === 'approved' ? '#0F766E' : '#991B1B';
  const statusText = status.toUpperCase();

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; margin-bottom: 35px;">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style="margin: 0 auto 20px;">
          ${status === 'approved' 
            ? `<circle cx="32" cy="32" r="32" fill="#0F766E" fill-opacity="0.1"/>
               <path d="M27.5 34.5L31 38L37 32" stroke="#0F766E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
            : `<circle cx="32" cy="32" r="32" fill="#991B1B" fill-opacity="0.1"/>
               <path d="M32 28V36M32 40H32.01" stroke="#991B1B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
          }
        </svg>
        <h1 style="color: #1E293B; font-size: 24px; margin: 0;">Exam Review Complete</h1>
        <p style="color: ${statusColor}; font-weight: 600; margin-top: 8px; font-size: 16px;">${statusText}</p>
      </div>

      <div style="color: #334155; line-height: 1.6;">
        <p style="font-size: 16px;">Dear ${instituteName},</p>
        <p style="font-size: 16px;">Your exam request for <strong>${examName}</strong> has been reviewed and ${status}.</p>
        
        ${feedback ? `
          <div style="margin: 25px 0; padding: 20px; background-color: #F8FAFC; border-left: 4px solid ${statusColor}; border-radius: 4px;">
            <p style="margin: 0; color: #334155; font-weight: 600;">Reviewer Feedback:</p>
            <p style="margin: 10px 0 0; color: #475569;">${feedback}</p>
          </div>
        ` : ''}

        ${status === 'approved' ? `
          <div style="margin: 25px 0; padding: 25px; background-color: #F0FDF4; border: 1px solid #0F766E; border-radius: 8px;">
            <h3 style="color: #0F766E; margin: 0 0 15px; font-size: 18px;">Exam Access Details</h3>
            <div style="background: #FFFFFF; padding: 20px; border-radius: 6px; margin-bottom: 15px;">
              <p style="margin: 0; color: #334155; font-weight: 600;">IPFS Hash</p>
              <p style="margin: 8px 0 0; color: #475569; word-break: break-all; font-family: monospace; font-size: 14px;">${ipfsHash}</p>
            </div>
            <p style="color: #0F766E; font-size: 14px; margin: 15px 0 0; display: flex; align-items: center;">
              <span style="margin-right: 8px;">⚠️</span>
              The encryption key will be provided through a secure channel.
            </p>
          </div>
        ` : `
          <div style="margin: 25px 0; padding: 20px; background-color: #FEF2F2; border: 1px solid #991B1B; border-radius: 8px;">
            <p style="color: #991B1B; margin: 0; font-size: 15px;">
              Please review the feedback above and submit a new request after making the necessary adjustments.
            </p>
          </div>
        `}

        <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #E2E8F0;">
          <p style="color: #64748B; margin: 0; font-size: 15px;">
            Need assistance? Our support team is here to help.<br>
            Contact us at <a href="mailto:support@nexusedu.com" style="color: #0F766E; text-decoration: none;">support@nexusedu.com</a>
          </p>
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <p style="color: #64748B; margin: 0; font-size: 14px;">
            Best regards,<br>
            <strong style="color: #334155; font-size: 16px;">NexusEdu Team</strong>
          </p>
        </div>
      </div>
    </div>
  `;
};

/**
 * Generates HTML email template for exam results
 * @param {Object} resultData - The result data
 * @param {string} resultData.examName - Name of the exam
 * @param {number} resultData.score - Score percentage
 * @param {number} resultData.correctAnswers - Number of correct answers
 * @param {number} resultData.totalQuestions - Total number of questions
 * @param {string} resultData.dashboardUrl - URL to view detailed results
 * @returns {string} HTML email template
 */
export const examResultTemplate = (resultData) => `
<!DOCTYPE html>
<html>
  <head>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Segoe UI', Arial, sans-serif;
        background-color: #F8FAFC;
        padding: 20px;
      }

      .email-container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #FFFFFF;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      .header {
        background: linear-gradient(135deg, #1E293B 0%, #334155 100%);
        color: white;
        padding: 30px;
        border-radius: 8px 8px 0 0;
        text-align: center;
      }

      .content {
        padding: 30px;
      }

      .score-card {
        text-align: center;
        padding: 30px;
        background: linear-gradient(135deg, #0F766E 0%, #0D9488 100%);
        color: white;
        border-radius: 8px;
        margin: 20px 0;
      }

      .score-value {
        font-size: 48px;
        font-weight: 700;
        margin: 10px 0;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
        margin: 30px 0;
      }

      .stat-item {
        background: #F8FAFC;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        border: 1px solid #E2E8F0;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: #0F766E;
      }

      .stat-label {
        font-size: 14px;
        color: #64748B;
        margin-top: 8px;
      }

      .cta-button {
        display: block;
        text-align: center;
        background: #0F766E;
        color: white;
        padding: 16px 32px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 500;
        margin: 30px 0;
      }

      .footer {
        text-align: center;
        padding: 20px 30px;
        background: #F8FAFC;
        border-top: 1px solid #E2E8F0;
        color: #64748B;
        font-size: 14px;
        border-radius: 0 0 8px 8px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <h1 style="font-size: 24px; margin-bottom: 8px;">Exam Results</h1>
        <p style="color: #CBD5E1;">${resultData.examName}</p>
      </div>
      
      <div class="content">
        <div class="score-card">
          <p style="font-size: 16px;">Your Score</p>
          <div class="score-value">${resultData.score.toFixed(1)}%</div>
        </div>

        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${resultData.correctAnswers}</div>
            <div class="stat-label">Correct Answers</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${resultData.totalQuestions}</div>
            <div class="stat-label">Total Questions</div>
          </div>
        </div>

        <a href="${resultData.dashboardUrl}" class="cta-button">
          View Detailed Results
        </a>
      </div>

      <div class="footer">
        <p style="margin-bottom: 5px;">© ${new Date().getFullYear()} NexusEdu</p>
        <p>Secure Examination System</p>
      </div>
    </div>
  </body>
</html>
`;

export const welcomeEmailTemplate = ({ name, userType }) => `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #E5E7EB; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1E293B; font-size: 24px; margin: 0;">Welcome to NexusEdu</h1>
      <p style="color: #64748B; margin-top: 8px;">Your Journey Begins Here</p>
    </div>

    <div style="color: #334155; line-height: 1.6;">
      <p>Dear ${name},</p>
      
      <div style="margin: 20px 0; padding: 20px; background-color: #F0FDF4; border: 1px solid #0F766E; border-radius: 4px;">
        <h3 style="color: #0F766E; margin: 0;">Account Created Successfully</h3>
        <p style="margin-top: 10px;">Your account has been created as a <strong>${userType}</strong>.</p>
      </div>

      <div style="margin: 20px 0; padding: 20px; background-color: #F8FAFC; border-radius: 4px;">
        <h3 style="color: #1E293B; margin: 0 0 15px;">Available Features</h3>
        <ul style="list-style: none; padding: 0;">
          ${userType === 'student' ? `
            <li style="margin-bottom: 10px; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0; color: #0F766E;">✓</span>
              Access and take exams
            </li>
            <li style="margin-bottom: 10px; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0; color: #0F766E;">✓</span>
              View your results
            </li>
            <li style="margin-bottom: 10px; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0; color: #0F766E;">✓</span>
              Track your progress
            </li>
          ` : userType === 'institute' ? `
            <li style="margin-bottom: 10px; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0; color: #0F766E;">✓</span>
              Create and manage exams
            </li>
            <li style="margin-bottom: 10px; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0; color: #0F766E;">✓</span>
              Monitor student performance
            </li>
            <li style="margin-bottom: 10px; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0; color: #0F766E;">✓</span>
              Access detailed analytics
            </li>
          ` : `
            <li style="margin-bottom: 10px; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0; color: #0F766E;">✓</span>
              Manage users and permissions
            </li>
            <li style="margin-bottom: 10px; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0; color: #0F766E;">✓</span>
              Monitor system activity
            </li>
            <li style="margin-bottom: 10px; padding-left: 24px; position: relative;">
              <span style="position: absolute; left: 0; color: #0F766E;">✓</span>
              Access administrative features
            </li>
          `}
        </ul>
      </div>

      <p>Our support team is available if you need any assistance.</p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E2E8F0;">
        <p style="color: #64748B; margin: 0;">
          Best regards,<br>
          <strong style="color: #334155;">NexusEdu Team</strong>
        </p>
      </div>
    </div>
  </div>
`;

export const loginNotificationTemplate = ({ name, time, location, device }) => `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="text-align: center; margin-bottom: 35px;">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style="margin: 0 auto 20px;">
        <circle cx="32" cy="32" r="32" fill="#0F766E" fill-opacity="0.1"/>
        <path d="M32 20V32L40 36" stroke="#0F766E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h1 style="color: #1E293B; font-size: 24px; margin: 0;">New Login Detected</h1>
    </div>

    <div style="color: #334155; line-height: 1.6;">
      <p style="font-size: 16px;">Dear ${name},</p>
      <p style="font-size: 16px;">We detected a new login to your NexusEdu account.</p>

      <div style="margin: 25px 0; padding: 25px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
        <h3 style="color: #0F766E; margin: 0 0 15px; font-size: 18px;">Login Details</h3>
        
        <div style="margin-bottom: 15px;">
          <p style="margin: 0; color: #334155; font-weight: 600;">Time</p>
          <p style="margin: 5px 0 0; color: #475569;">${time}</p>
        </div>

        <div style="margin-bottom: 15px;">
          <p style="margin: 0; color: #334155; font-weight: 600;">Location</p>
          <p style="margin: 5px 0 0; color: #475569;">
            ${location.city}, ${location.region}<br>
            ${location.country}<br>
            <span style="color: #64748B; font-size: 14px;">IP: ${location.ip}</span>
          </p>
        </div>

        <div>
          <p style="margin: 0; color: #334155; font-weight: 600;">Device</p>
          <p style="margin: 5px 0 0; color: #475569;">${device}</p>
        </div>
      </div>

      <div style="margin-top: 25px; padding: 20px; background-color: #FEF2F2; border: 1px solid #991B1B; border-radius: 8px;">
        <p style="color: #991B1B; margin: 0; font-size: 15px;">
          If you didn't log in to your account at this time, please contact our support team immediately.
        </p>
      </div>

      <div style="margin-top: 35px; padding-top: 25px; border-top: 1px solid #E2E8F0;">
        <p style="color: #64748B; margin: 0; font-size: 15px;">
          Need assistance? Our support team is here to help.<br>
          Contact us at <a href="mailto:support@nexusedu.com" style="color: #0F766E; text-decoration: none;">support@nexusedu.com</a>
        </p>
      </div>
    </div>
  </div>
`;

export const instituteGuidelinesTemplate = ({ name }) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1f2937;">Welcome to NexusEdu - Question Paper Guidelines</h2>
    <p>Dear ${name},</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h3 style="color: #1f2937; margin-top: 0;">Question Paper Format Requirements</h3>
      
      <div style="margin-top: 15px;">
        <h4 style="color: #4338ca;">File Format</h4>
        <ul style="color: #475569;">
          <li>Accept JSON format only</li>
          <li>Maximum file size: 10MB</li>
        </ul>
      </div>

      <div style="margin-top: 15px;">
        <h4 style="color: #4338ca;">JSON Structure</h4>
        <pre style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 13px;">
{
  "questions": [
    {
      "question": "What is the capital of France?",
      "options": ["London", "Paris", "Berlin", "Madrid"],
      "correctAnswer": 2
    },
    {
      "question": "Which planet is known as the Red Planet?",
      "options": ["Venus", "Mars", "Jupiter", "Saturn"],
      "correctAnswer": 2
    }
    // ... more questions
  ]
}</pre>
      </div>

      <div style="margin-top: 15px;">
        <h4 style="color: #4338ca;">Important Notes</h4>
        <ul style="color: #475569;">
          <li>Each question must have exactly 4 options</li>
          <li>The "question" field contains the question text</li>
          <li>"options" should be an array of exactly 4 strings</li>
          <li>"correctAnswer" should be the index (1-4) of the correct option</li>
          <li>Maximum 100 questions per exam</li>
          <li>All fields are required for each question</li>
        </ul>
      </div>
    </div>

    <div style="margin-top: 20px; padding: 15px; background-color: #fff7ed; border: 1px solid #f97316; border-radius: 8px;">
      <h4 style="color: #c2410c; margin-top: 0;">⚠️ Important</h4>
      <ul style="color: #475569;">
        <li>Ensure all questions have unique content</li>
        <li>Double-check correctAnswer indices (0-3)</li>
        <li>Verify all options are properly formatted</li>
        <li>Make sure the JSON is properly formatted and valid</li>
      </ul>
    </div>

    <div style="margin-top: 20px; padding: 15px; background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 8px;">
      <h4 style="color: #047857; margin-top: 0;">Next Steps</h4>
      <ol style="color: #475569;">
        <li>Prepare your question paper according to the format above</li>
        <li>Login to your institute dashboard</li>
        <li>Click on "Create New Exam"</li>
        <li>Upload your JSON file</li>
        <li>Wait for admin approval</li>
      </ol>
    </div>

    <p style="margin-top: 20px;">
      If you have any questions about the format or need assistance, please contact our support team.
    </p>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 0.9em;">
        Best regards,<br>
        NexusEdu Team
      </p>
    </div>
  </div>
`;

export const newUserCredentialsTemplate = ({ name, email, password, userType }) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>Welcome to NexusEdu!</h2>
    <p>Hello ${name},</p>
    <p>An administrator has created a new ${userType} account for you on NexusEdu.</p>
    <p>Here are your login credentials:</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
    </div>
    <p>Please login and change your password immediately for security purposes.</p>
    <p>Best regards,<br>NexusEdu Team</p>
  </div>
`;

export const newInstituteCredentialsTemplate = ({ name, email, password, userType }) => {
  const examFormatExample = {
    "questions": [
      {
        "question": "What is the capital of France?",
        "options": ["London", "Paris", "Berlin", "Madrid"],
        "correctAnswer": 2
      },
      {
        "question": "Which planet is known as the Red Planet?",
        "options": ["Venus", "Mars", "Jupiter", "Saturn"],
        "correctAnswer": 2
      }
    ]
  };

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border: 1px solid #E5E7EB; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1E293B; font-size: 24px; margin: 0;">Welcome to NexusEdu</h1>
        <p style="color: #64748B; margin-top: 8px;">Account Credentials</p>
      </div>

      <div style="color: #334155; line-height: 1.6;">
        <p>Dear ${name},</p>
        
        <div style="margin: 20px 0; padding: 20px; background-color: #F0FDF4; border: 1px solid #0F766E; border-radius: 4px;">
          <h3 style="color: #0F766E; margin: 0 0 15px;">Your Login Credentials</h3>
          <div style="background: #FFFFFF; padding: 15px; border-radius: 4px; margin-bottom: 10px;">
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
          </div>
          <div style="background: #FFFFFF; padding: 15px; border-radius: 4px; margin-bottom: 10px;">
            <p style="margin: 0;"><strong>Password:</strong> ${password}</p>
          </div>
          <div style="background: #FFFFFF; padding: 15px; border-radius: 4px;">
            <p style="margin: 0;"><strong>Account Type:</strong> ${userType}</p>
          </div>
        </div>

        <div style="margin: 20px 0;">
          <h3 style="color: #1E293B; margin: 0 0 15px;">Exam Paper Format</h3>
          <pre style="background-color: #F8FAFC; padding: 20px; border-radius: 4px; overflow-x: auto; font-size: 13px; color: #334155; border: 1px solid #E2E8F0;">
${JSON.stringify(examFormatExample, null, 2)}
          </pre>
        </div>

        <div style="margin: 20px 0; padding: 20px; background-color: #FFFBEB; border: 1px solid #D97706; border-radius: 4px;">
          <h4 style="color: #B45309; margin: 0 0 10px;">Important Guidelines:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #92400E;">
            <li style="margin-bottom: 8px;">Questions must be clear and unambiguous</li>
            <li style="margin-bottom: 8px;">Each question must have exactly 4 options</li>
            <li style="margin-bottom: 8px;">correctAnswer should be 1-4 (1 for first option, 4 for last option)</li>
            <li style="margin-bottom: 8px;">Time limit should be in minutes</li>
            <li style="margin-bottom: 8px;">Total marks should match sum of individual question marks</li>
            <li>Passing percentage should be between 1-100</li>
          </ul>
        </div>

        <p style="color: #991B1B; margin: 20px 0; padding: 15px; background-color: #FEF2F2; border-radius: 4px;">
          Please change your password after first login for security purposes.
        </p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E2E8F0;">
          <p style="color: #64748B; margin: 0;">
            Best regards,<br>
            <strong style="color: #334155;">NexusEdu Team</strong>
          </p>
        </div>
      </div>
    </div>
  `;
}; 