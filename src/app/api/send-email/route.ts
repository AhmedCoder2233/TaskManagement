import { NextRequest, NextResponse } from 'next/server'
import { sendTaskAssignmentEmail } from '@/app/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      toEmail,
      taskTitle,
      taskDescription,
      assignerName,
      dueDate,
      priority,
      taskLink,
    } = body

    console.log('📧 Email request for:', toEmail)

    // Validate required fields
    if (!toEmail || !taskTitle) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Email and task title are required'
        },
        { status: 400 }
      )
    }

    // Check if email credentials are set
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('Email credentials not configured')
      return NextResponse.json(
        { 
          success: false,
          error: 'Email service not configured. Please set EMAIL_USER and EMAIL_PASSWORD in environment variables.'
        },
        { status: 500 }
      )
    }

    // Send email using Nodemailer
    const result = await sendTaskAssignmentEmail({
      toEmail,
      taskTitle,
      taskDescription: taskDescription || '',
      assignerName: assignerName || 'Administrator',
      dueDate: dueDate || '',
      priority: priority || 'medium',
      taskLink: taskLink || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    })

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      data: result
    })
    
  } catch (error: any) {
    console.error('Email API error:', error)
    
    // Provide helpful error messages
    let errorMessage = 'Failed to send email'
    
    if (error.message?.includes('Invalid login')) {
      errorMessage = 'Invalid email credentials. Please check EMAIL_USER and EMAIL_PASSWORD.'
    } else if (error.message?.includes('connection refused')) {
      errorMessage = 'Email server connection failed. Check your network.'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}

// Test endpoint
export async function GET(request: NextRequest) {
  try {
    // Check if credentials exist
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return NextResponse.json({
        success: false,
        error: 'Email credentials not set',
        note: 'Add EMAIL_USER and EMAIL_PASSWORD to .env.local'
      })
    }

    // Test connection
    const { sendTaskAssignmentEmail, testEmailConnection } = await import('@/app/lib/email')
    
    const testResult = await testEmailConnection()
    
    return NextResponse.json({
      success: testResult.success,
      message: testResult.success 
        ? '✅ Email server is ready' 
        : '❌ Email server connection failed',
      details: testResult
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}