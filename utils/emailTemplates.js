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
            Contact us at <a href="mailto:nexusedu6@gmail.com" style="color: #0F766E; text-decoration: none;">nexusedu6@gmail.com</a>
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

// Helper function for IST time formatting
const formatIndianTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
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
export const examResultTemplate = ({ resultData }) => `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="text-align: center; margin-bottom: 35px;">
      <h1 style="color: #1E293B; font-size: 24px; margin: 0;">Your Exam Results</h1>
      <p style="color: #64748B; margin-top: 8px;">${resultData.examName}</p>
    </div>

    <div style="background: linear-gradient(135deg, #0F766E 0%, #0D9488 100%); padding: 30px; border-radius: 12px; text-align: center; color: white; margin-bottom: 30px;">
      <p style="font-size: 16px; margin: 0 0 10px;">Hello ${resultData.studentName},</p>
      <div style="font-size: 48px; font-weight: 700;">${resultData.score.toFixed(1)}%</div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px;">
      <div style="background: #F8FAFC; padding: 24px; border-radius: 12px; text-align: center;">
        <div style="font-size: 32px; font-weight: 600; color: #0F766E; margin-bottom: 8px;">
          ${resultData.correctAnswers}
        </div>
        <div style="color: #64748B; font-size: 14px;">Correct Answers</div>
      </div>
      <div style="background: #F8FAFC; padding: 24px; border-radius: 12px; text-align: center;">
        <div style="font-size: 32px; font-weight: 600; color: #0F766E; margin-bottom: 8px;">
          ${resultData.totalQuestions}
        </div>
        <div style="color: #64748B; font-size: 14px;">Total Questions</div>
      </div>
    </div>

    <div style="margin-bottom: 30px; text-align: center; color: #64748B;">
      <p>Exam completed on (IST): ${formatIndianTime(resultData.submittedAt)}</p>
    </div>

    <a href="${resultData.dashboardUrl}" 
       style="display: block; background: #0F766E; color: white; text-align: center; padding: 16px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-bottom: 30px;">
      View Detailed Analysis
    </a>

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #E2E8F0;">
      <p style="color: #64748B; margin: 0; font-size: 14px;">
        © ${new Date().getFullYear()} NexusEdu<br>
        <span style="color: #94A3B8;">Secure Examination System</span>
      </p>
    </div>
  </div>
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

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #E2E8F0;">
      <p style="color: #64748B; margin: 0; font-size: 14px;">
        Account created on: ${formatIndianTime(new Date())}<br>
        © ${new Date().getFullYear()} NexusEdu
      </p>
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
          <p style="margin: 0; color: #334155; font-weight: 600;">Time (IST)</p>
          <p style="margin: 5px 0 0; color: #475569;">${time}</p>
        </div>

        <div style="margin-bottom: 15px;">
          <p style="margin: 0; color: #334155; font-weight: 600;">Location</p>
          <p style="margin: 5px 0 0; color: #475569;">
            ${location.city !== 'Unknown City' ? `${location.city}, ` : ''}
            ${location.state !== 'Unknown State' ? `${location.state}, ` : ''}
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
          Contact us at <a href="mailto:nexusedu6@gmail.com" style="color: #0F766E; text-decoration: none;">nexusedu6@gmail.com</a>
        </p>
      </div>
    </div>
  </div>
`;

export const instituteGuidelinesTemplate = ({ name }) => `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="text-align: center; margin-bottom: 35px;">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style="margin: 0 auto 20px;">
        <circle cx="32" cy="32" r="32" fill="#0F766E" fill-opacity="0.1"/>
        <path d="M24 32H40M24 24H40M24 40H32" stroke="#0F766E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h1 style="color: #1E293B; font-size: 24px; margin: 0;">Question Paper Guidelines</h1>
      <p style="color: #64748B; margin-top: 8px;">Welcome to NexusEdu, ${name}</p>
    </div>

    <div style="margin-bottom: 30px;">
      <div style="background: #F0FDF4; border-left: 4px solid #0F766E; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <h3 style="color: #0F766E; margin: 0 0 12px; font-size: 18px;">File Requirements</h3>
        <ul style="color: #334155; margin: 0; padding-left: 20px; line-height: 1.6;">
          <li>JSON format only</li>
          <li>Maximum file size: 10MB</li>
          <li>Maximum 100 questions per exam</li>
        </ul>
      </div>

      <div style="background: #F8FAFC; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
        <h3 style="color: #1E293B; margin: 0 0 16px; font-size: 18px;">JSON Structure Example</h3>
        <div style="background: #F1F5F9; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 14px; color: #334155; overflow-x: auto;">
{
  "questions": [
    {
      "question": "What is the capital of France?",
      "options": [
        "London",
        "Paris",
        "Berlin",
        "Madrid"
      ],
      "correctAnswer": 2
    }
  ]
}
        </div>
      </div>

      <div style="background: #FFFBEB; border-left: 4px solid #D97706; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <h3 style="color: #D97706; margin: 0 0 12px; font-size: 18px;">Important Notes</h3>
        <ul style="color: #334155; margin: 0; padding-left: 20px; line-height: 1.6;">
          <li>Each question must have exactly 4 options</li>
          <li>correctAnswer should be between 1-4</li>
          <li>All fields are required</li>
          <li>Ensure unique question content</li>
        </ul>
      </div>

      <div style="background: #F0FDF4; padding: 24px; border-radius: 12px;">
        <h3 style="color: #0F766E; margin: 0 0 16px; font-size: 18px;">Next Steps</h3>
        <ol style="color: #334155; margin: 0; padding-left: 20px; line-height: 1.6;">
          <li>Prepare your question paper according to the format</li>
          <li>Login to your institute dashboard</li>
          <li>Click on "Create New Exam"</li>
          <li>Upload your JSON file</li>
          <li>Wait for admin approval</li>
        </ol>
      </div>
    </div>

    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #E2E8F0;">
      <p style="color: #64748B; margin: 0; font-size: 14px;">
        Generated on: ${formatIndianTime(new Date())}<br>
        Need assistance? Contact our support team at<br>
        <a href="mailto:support@nexusedu.com" style="color: #0F766E; text-decoration: none;">support@nexusedu.com</a>
      </p>
    </div>
  </div>
`;

export const newUserCredentialsTemplate = ({ name, email, password, userType }) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2>Welcome to NexusEdu!</h2>
    <p>Hello ${name},</p>
    <p>An administrator has created a new ${userType} account for you on NexusEdu.</p>
    <p>Account created on: ${formatIndianTime(new Date())}</p>
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

/**
 * Generates HTML email template for OTP verification
 * @param {Object} data - The OTP data
 * @param {string} data.otp - The OTP code
 * @param {string} data.email - User's email address
 * @returns {string} HTML email template
 */
export const otpEmailTemplate = ({ otp, email }) => `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="text-align: center; margin-bottom: 35px;">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style="margin: 0 auto 20px;">
        <circle cx="32" cy="32" r="32" fill="#0F766E" fill-opacity="0.1"/>
        <path d="M32 20V32L40 36" stroke="#0F766E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h1 style="color: #1E293B; font-size: 24px; margin: 0;">Email Verification</h1>
      <p style="color: #64748B; margin-top: 8px;">Complete your NexusEdu registration</p>
    </div>

    <div style="color: #334155; line-height: 1.6;">
      <p style="font-size: 16px;">Hello,</p>
      <p style="font-size: 16px;">Please use the verification code below to verify your email address:</p>
      <p style="color: #0F766E; font-weight: 500;">${email}</p>

      <div style="margin: 32px 0; text-align: center;">
        <div style="background: #F0FDF4; padding: 24px; border-radius: 12px; border: 2px solid #0F766E;">
          <div style="font-family: monospace; letter-spacing: 8px; font-size: 36px; font-weight: 600; color: #0F766E;">
            ${otp}
          </div>
        </div>
      </div>

      <div style="margin: 32px 0; padding: 20px; background-color: #FFFBEB; border-left: 4px solid #D97706; border-radius: 8px;">
        <h3 style="color: #D97706; margin: 0 0 12px; font-size: 16px;">Important Notes:</h3>
        <ul style="color: #92400E; margin: 0; padding-left: 20px; line-height: 1.6;">
          <li>This code will expire in 10 minutes</li>
          <li>For security, do not share this code with anyone</li>
          <li>Enter the code exactly as shown above</li>
        </ul>
      </div>

      <div style="background: #F8FAFC; padding: 20px; border-radius: 8px; margin-top: 24px;">
        <p style="color: #64748B; margin: 0; font-size: 14px;">
          If you didn't request this code, you can safely ignore this email. Someone might have typed your email address by mistake.
        </p>
      </div>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E2E8F0;">
        <p style="color: #64748B; margin: 0; font-size: 14px;">
          Best regards,<br>
          <strong style="color: #334155;">NexusEdu Team</strong>
        </p>
      </div>
    </div>

    <div style="text-align: center; margin-top: 40px;">
      <p style="color: #94A3B8; margin: 0; font-size: 12px;">
        © ${new Date().getFullYear()} NexusEdu. All rights reserved.<br>
        <span style="color: #CBD5E1;">Secure Examination System</span>
      </p>
    </div>
  </div>
`;