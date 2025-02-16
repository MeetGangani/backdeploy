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
export const examApprovalTemplate = ({ instituteName, examName, status, feedback, ipfsHash, encryptionKey }) => {
  const statusColor = status === 'approved' ? '#22c55e' : '#ef4444';
  const statusText = status.toUpperCase();

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937;">Exam Request Update</h2>
      <p>Dear ${instituteName},</p>
      
      <p>Your exam request for <strong>${examName}</strong> has been <span style="color: ${statusColor};">${statusText}</span>.</p>
      
      ${feedback ? `
        <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
          <strong>Admin Feedback:</strong><br>
          ${feedback}
        </div>
      ` : ''}

      ${status === 'approved' ? `
        <div style="margin: 20px 0; padding: 15px; background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 8px;">
          <h3 style="color: #047857; margin-top: 0;">Important: Exam Access Details</h3>
          <p style="margin-bottom: 10px;"><strong>IPFS Hash:</strong> ${ipfsHash}</p>
          <p style="margin-bottom: 10px;"><strong>Encryption Key:</strong> ${encryptionKey}</p>
          <p style="color: #047857; font-size: 0.9em; margin-top: 15px;">
            ⚠️ Please save these details securely. They are required to access the exam.
          </p>
        </div>
      ` : `
        <div style="margin: 20px 0; padding: 15px; background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px;">
          <p style="color: #991b1b; margin: 0;">
            You may submit a new request after addressing the feedback provided.
          </p>
        </div>
      `}

      <p style="margin-top: 20px;">
        If you have any questions, please don't hesitate to contact us.
      </p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; font-size: 0.9em;">
          Best regards,<br>
          NexusEdu Team
        </p>
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
        background-color: #F3F4F6;
        padding: 20px;
      }

      .card {
        background: white;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }

      .header {
        background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #D946EF 100%);
        color: white;
        padding: 40px 30px;
        text-align: center;
      }

      .content {
        padding: 30px;
      }

      .score-card {
        text-align: center;
        padding: 30px;
        background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
        color: white;
        border-radius: 12px;
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
        gap: 15px;
        margin: 20px 0;
      }

      .stat-item {
        background: #F9FAFB;
        padding: 15px;
        border-radius: 8px;
        text-align: center;
      }

      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: #6366F1;
      }

      .stat-label {
        font-size: 14px;
        color: #6B7280;
        margin-top: 5px;
      }

      .footer {
        text-align: center;
        padding: 30px;
        background: #F9FAFB;
        border-top: 1px solid #E5E7EB;
        color: #6B7280;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="card">
        <div class="header">
          <h1>Exam Results Available</h1>
          <p>${resultData.examName}</p>
        </div>
        
        <div class="content">
          <div class="score-card">
            <p>Your Score</p>
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
          <p>© ${new Date().getFullYear()} NexusEdu. All rights reserved.</p>
          <p>Secure Examination System</p>
        </div>
      </div>
    </div>
  </body>
</html>
`;

export const welcomeEmailTemplate = ({ name, userType }) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1f2937;">Welcome to NexusEdu!</h2>
    <p>Dear ${name},</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 8px;">
      <h3 style="color: #047857; margin-top: 0;">Account Created Successfully</h3>
      <p>Your account has been created as a <strong>${userType}</strong>.</p>
    </div>

    <p>You can now:</p>
    <ul style="margin: 15px 0;">
      ${userType === 'student' ? `
        <li>Access and take exams</li>
        <li>View your results</li>
        <li>Track your progress</li>
      ` : userType === 'institute' ? `
        <li>Create and manage exams</li>
        <li>Monitor student performance</li>
        <li>Access detailed analytics</li>
      ` : `
        <li>Manage users and permissions</li>
        <li>Monitor system activity</li>
        <li>Access administrative features</li>
      `}
    </ul>

    <p style="margin-top: 20px;">
      If you have any questions, our support team is here to help!
    </p>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 0.9em;">
        Best regards,<br>
        NexusEdu Team
      </p>
    </div>
  </div>
`;

export const loginNotificationTemplate = ({ name, time, location, device }) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1f2937;">New Login Detected</h2>
    <p>Dear ${name},</p>
    
    <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
      <h3 style="color: #1f2937; margin-top: 0;">Login Details</h3>
      <p><strong>Time:</strong> ${time}</p>
      <p><strong>Location:</strong> ${location}</p>
      <p><strong>Device:</strong> ${device}</p>
    </div>

    <p style="color: #6b7280;">
      If this wasn't you, please contact our support team immediately.
    </p>
    
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; font-size: 0.9em;">
        Stay secure,<br>
        NexusEdu Team
      </p>
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
          <li>"correctAnswer" should be the index (0-3) of the correct option</li>
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