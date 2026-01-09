import nodemailer from 'nodemailer'

// Email configuration
const emailConfig = {
  service: 'gmail', // You can use: 'gmail', 'outlook', 'yahoo', etc.
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASSWORD, // Your email password or app password
  }
}

// Create reusable transporter
const transporter = nodemailer.createTransport(emailConfig)

// Verify connection configuration
transporter.verify((error:any, success:any) => {
  if (error) {
    console.error('Email transporter error:', error)
  } else {
    console.log('✅ Email server is ready to take messages')
  }
})

// Function to send task assignment email
export async function sendTaskAssignmentEmail({
  toEmail,
  taskTitle,
  taskDescription,
  assignerName,
  dueDate,
  priority,
  taskLink,
}: {
  toEmail: string
  taskTitle: string
  taskDescription?: string
  assignerName: string
  dueDate?: string
  priority: string
  taskLink: string
}) {
  try {
    // Format due date
    let dueDateFormatted = 'Not set'
    if (dueDate) {
      try {
        dueDateFormatted = new Date(dueDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      } catch {
        dueDateFormatted = dueDate
      }
    }

    // Priority styling
    const priorityStyles: Record<string, { color: string, text: string }> = {
      high: { color: '#dc2626', text: 'High Priority' },
      medium: { color: '#f59e0b', text: 'Medium Priority' },
      low: { color: '#10b981', text: 'Low Priority' }
    }
    
    const priorityStyle = priorityStyles[priority] || priorityStyles.medium

    // HTML email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Task Assigned</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #374151;
              margin: 0;
              padding: 0;
              background-color: #f9fafb;
            }
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 32px 24px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .content {
              padding: 32px 24px;
            }
            .task-card {
              background: white;
              border-radius: 12px;
              border: 1px solid #e5e7eb;
              padding: 24px;
              margin-bottom: 24px;
            }
            .task-title {
              font-size: 24px;
              font-weight: 700;
              color: #111827;
              margin: 0 0 16px 0;
            }
            .task-description {
              color: #6b7280;
              margin: 16px 0;
              line-height: 1.8;
              white-space: pre-line;
            }
            .details-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 16px;
              margin: 24px 0;
            }
            .detail-item {
              padding: 16px;
              background: #f9fafb;
              border-radius: 8px;
              border-left: 4px solid #e5e7eb;
            }
            .detail-label {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              font-weight: 600;
              margin-bottom: 4px;
            }
            .detail-value {
              font-size: 16px;
              font-weight: 600;
              color: #111827;
            }
            .priority-badge {
              display: inline-flex;
              align-items: center;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              background-color: ${priorityStyle.color}20;
              color: ${priorityStyle.color};
              border: 1px solid ${priorityStyle.color}40;
            }
            .button-container {
              text-align: center;
              margin: 32px 0;
            }
            .view-button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              padding: 14px 32px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
            }
            .footer {
              margin-top: 32px;
              padding-top: 24px;
              border-top: 1px solid #e5e7eb;
              color: #9ca3af;
              font-size: 14px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>🎯 New Task Assigned</h1>
            </div>
            
            <div class="content">
              <div class="task-card">
                <h2 class="task-title">${taskTitle}</h2>
                
                ${taskDescription ? `
                  <div class="task-description">
                    ${taskDescription.replace(/\n/g, '<br>')}
                  </div>
                ` : ''}
                
                <div class="details-grid">
                  <div class="detail-item">
                    <div class="detail-label">Assigned By</div>
                    <div class="detail-value">${assignerName || 'Administrator'}</div>
                  </div>
                  
                  <div class="detail-item">
                    <div class="detail-label">Priority</div>
                    <div class="detail-value">
                      <span class="priority-badge">${priorityStyle.text}</span>
                    </div>
                  </div>
                  
                  <div class="detail-item">
                    <div class="detail-label">Due Date</div>
                    <div class="detail-value">${dueDateFormatted}</div>
                  </div>
                </div>
              </div>
              
              <div class="footer">
                <p>This is an automated notification from your task management system.</p>
                <p>© ${new Date().getFullYear()} Task Management System</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `

    // Text version
    const textContent = `
      NEW TASK ASSIGNED
      =================

      Task: ${taskTitle}
      
      ${taskDescription ? `Description:\n${taskDescription}\n\n` : ''}
      
      Task Details:
      -------------
      Assigned By: ${assignerName || 'Administrator'}
      Priority: ${priorityStyle.text}
      Due Date: ${dueDateFormatted}      
      ---
      
      This is an automated notification from your task management system.
      © ${new Date().getFullYear()} Task Management System
    `

    // Email options
    const mailOptions = {
      from: `"Task Manager" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `🎯 New Task Assigned: ${taskTitle}`,
      html: htmlContent,
      text: textContent,
    }

    // Send email
    const info = await transporter.sendMail(mailOptions)
    console.log(`✅ Email sent to ${toEmail}: ${info.messageId}`)
    
    return {
      success: true,
      messageId: info.messageId,
      message: 'Email sent successfully'
    }
    
  } catch (error) {
    console.error('❌ Error sending email:', error)
    throw new Error('Failed to send email')
  }
}

// Function to test email connection
export async function testEmailConnection() {
  try {
    await transporter.verify()
    return { success: true, message: 'Email server is ready' }
  } catch (error) {
    return { success: false, error: 'Email server connection failed' }
  }

}
