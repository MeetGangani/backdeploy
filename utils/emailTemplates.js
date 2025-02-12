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
  const statusColor = status === 'approved' ? '#22c55e' : '#ef4444';
  const statusText = status.toUpperCase();

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Exam Request Update</h2>
      <p>Dear ${instituteName},</p>
      <p>Your exam request for <strong>${examName}</strong> has been <span style="color: ${statusColor};">${statusText}</span>.</p>
      ${feedback ? `<p><strong>Feedback:</strong> ${feedback}</p>` : ''}
      ${ipfsHash ? `<p><strong>IPFS Hash:</strong> ${ipfsHash}</p>` : ''}
      <p>Thank you for using our platform.</p>
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
          <p>© ${new Date().getFullYear()} KryptoExam. All rights reserved.</p>
          <p>Secure Examination System</p>
        </div>
      </div>
    </div>
  </body>
</html>
`; 