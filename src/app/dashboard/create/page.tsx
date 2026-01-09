'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/app/supabase-provider'
import { ArrowLeft, Plus, User, AlertCircle, Calendar, Tag, FileText, Mail } from 'lucide-react'
import Link from 'next/link'

export default function CreateTask() {
  const router = useRouter()
  const supabase = useSupabase()
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
  })

  useEffect(() => {
    checkUserAndFetchUsers()
  }, [supabase])

  const checkUserAndFetchUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/signin')
        return
      }

      // Get current user's profile
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setCurrentUser(currentUserProfile)

      if (currentUserProfile?.role === 'member') {
        router.push('/dashboard')
        return
      }

      setUserRole(currentUserProfile?.role)

      // Fetch all users for assignment
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name')

      setUsers(usersData || [])
    } catch (error) {
      console.error('Error:', error)
    }
  }

const sendAssignmentEmail = async (assignedUser: any, taskId: string) => {
  try {
    console.log('📧 Starting email send...')
    console.log('Assigned user:', assignedUser)
    console.log('Task ID:', taskId)
    
    setEmailStatus('sending')
    
    const taskLink = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/dashboard/tasks/${taskId}`
    
    console.log('Task Link:', taskLink)
    console.log('Current User:', currentUser)
    console.log('Form Data:', formData)
    
    const emailData = {
      toEmail: assignedUser.email,
      taskTitle: formData.title,
      taskDescription: formData.description,
      assignerName: currentUser?.full_name || 'Administrator',
      dueDate: formData.due_date || null,
      priority: formData.priority,
      taskLink: taskLink,
    }

    console.log('Email Data being sent:', emailData)

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    })

    console.log('API Response status:', response.status)
    console.log('API Response headers:', response.headers)
    
    const result = await response.json()
    console.log('API Response result:', result)
    
    if (!response.ok) {
      console.error('API Error:', result)
      throw new Error(result.error || `HTTP ${response.status}: Failed to send email`)
    }

    if (result.success) {
      console.log('✅ Email sent successfully!')
      setEmailStatus('sent')
      return true
    } else {
      console.error('API returned failure:', result)
      throw new Error(result.error || 'Failed to send email')
    }
  } catch (error) {
    console.error('❌ Error in sendAssignmentEmail:', error)
    setEmailStatus('failed')
    return false
  }
}
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  console.log('🚀 Form submitted!')
  setLoading(true)
  setEmailStatus('idle')

  try {
    console.log('🔍 Getting current user...')
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.log('No user found, redirecting to signin')
      router.push('/auth/signin')
      return
    }

    // Find assigned user details
    console.log('Looking for assigned user with ID:', formData.assigned_to)
    const assignedUser = users.find(u => u.id === formData.assigned_to)
    console.log('Found assigned user:', assignedUser)
    
    if (!assignedUser) {
      throw new Error('Assigned user not found')
    }

    // Create the task
    console.log('Creating task in database...')
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: formData.title,
        description: formData.description,
        assigned_to: formData.assigned_to,
        created_by: user.id,
        priority: formData.priority,
        due_date: formData.due_date || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (taskError) {
      console.error('Task creation error:', taskError)
      throw taskError
    }

    console.log('✅ Task created successfully:', task)

    // Send email notification
    let emailSuccess = false
    if (assignedUser.email) {
      console.log('📨 Attempting to send email to:', assignedUser.email)
      emailSuccess = await sendAssignmentEmail(assignedUser, task.id)
      console.log('Email send result:', emailSuccess)
    } else {
      console.warn('⚠️ Assigned user has no email:', assignedUser)
    }

    // Wait a bit to show the status
    console.log('Waiting for 2 seconds...')
    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log('Email status after waiting:', emailStatus)
    console.log('Redirecting to dashboard...')

    // Redirect
    router.push('/dashboard')
    router.refresh()

  } catch (error: any) {
    console.error('❌ Error in handleSubmit:', error)
    alert(`Error: ${error.message}`)
    setLoading(false)
  }
}
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Get assigned user email for display
  const getAssignedUserEmail = () => {
    if (!formData.assigned_to) return ''
    const user = users.find(u => u.id === formData.assigned_to)
    return user?.email || ''
  }

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium mb-6 transition-colors group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-gray-900 to-black rounded-xl shadow-sm">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">Create New Task</h1>
              <p className="mt-2 text-gray-600">Assign a new task to a team member</p>
            </div>
          </div>
        </div>

        {/* Email Status Alert */}
        {emailStatus === 'sent' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Mail className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-800">Task created and email sent successfully!</p>
                <p className="text-sm text-green-600">Notification sent to {getAssignedUserEmail()}</p>
              </div>
            </div>
          </div>
        )}

        {emailStatus === 'failed' && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-yellow-800">Task created but email notification failed</p>
                <p className="text-sm text-yellow-600">The task was created successfully, but the email could not be sent.</p>
              </div>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Title */}
              <div className="space-y-3">
                <label htmlFor="title" className="flex items-center text-sm font-semibold text-gray-900">
                  <FileText className="h-4 w-4 mr-2 text-gray-500" />
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-5 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                  placeholder="Enter a clear and descriptive task title"
                />
              </div>

              {/* Description */}
              <div className="space-y-3">
                <label htmlFor="description" className="flex items-center text-sm font-semibold text-gray-900">
                  <FileText className="h-4 w-4 mr-2 text-gray-500" />
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={5}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-5 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 resize-none"
                  placeholder="Provide detailed description, requirements, or instructions for this task..."
                />
              </div>

              {/* Grid for Assignee, Priority, Due Date */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Assign To */}
                <div className="space-y-3">
                  <label htmlFor="assigned_to" className="flex items-center text-sm font-semibold text-gray-900">
                    <User className="h-4 w-4 mr-2 text-gray-500" />
                    Assign To *
                  </label>
                  <div className="relative">
                    <select
                      id="assigned_to"
                      name="assigned_to"
                      required
                      value={formData.assigned_to}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent appearance-none transition-all duration-200"
                    >
                      <option value="">Select team member</option>
                      {users
                        .filter(user => user.role === 'member')
                        .map(user => (
                          <option key={user.id} value={user.id}>
                            {user.full_name} • {user.email}
                          </option>
                        ))
                      }
                    </select>
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  {formData.assigned_to && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Mail className="h-4 w-4" />
                      <span>Email will be sent to {getAssignedUserEmail()}</span>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {users.filter(user => user.role === 'member').length} team members available
                  </p>
                </div>

                {/* Priority */}
                <div className="space-y-3">
                  <label htmlFor="priority" className="flex items-center text-sm font-semibold text-gray-900">
                    <Tag className="h-4 w-4 mr-2 text-gray-500" />
                    Priority
                  </label>
                  <div className="relative">
                    <select
                      id="priority"
                      name="priority"
                      value={formData.priority}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent appearance-none transition-all duration-200"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <AlertCircle className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {formData.priority === 'high' && 'Urgent - Requires immediate attention'}
                    {formData.priority === 'medium' && 'Important - Complete within deadline'}
                    {formData.priority === 'low' && 'Normal - Complete when possible'}
                  </p>
                </div>

                {/* Due Date */}
                <div className="space-y-3">
                  <label htmlFor="due_date" className="flex items-center text-sm font-semibold text-gray-900">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                    Due Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      id="due_date"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleChange}
                      className="w-full px-5 py-3.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <Calendar className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  {formData.due_date && (
                    <p className="text-xs text-gray-500 mt-2">
                      Due on {new Date(formData.due_date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Email Notification Section */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-blue-900">Email Notification</h3>
                    <p className="text-sm text-blue-700">
                      An email notification will be automatically sent to the assigned team member when you create this task.
                      {emailStatus === 'sending' && (
                        <span className="ml-2 inline-flex items-center">
                          <span className="h-2 w-2 bg-blue-500 rounded-full animate-pulse mr-1"></span>
                          Sending email...
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-gray-200">
                <div className="text-sm text-gray-600 order-2 sm:order-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">Note:</span> 
                    <span>All fields marked with * are required</span>
                  </div>
                  {formData.assigned_to && (
                    <div className="flex items-center gap-2 text-blue-600">
                      <Mail className="h-4 w-4" />
                      <span>Email notification will be sent upon creation</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-4 order-1 sm:order-2 w-full sm:w-auto">
                  <Link
                    href="/dashboard"
                    className="flex-1 sm:flex-none px-6 py-3.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow text-center"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={loading || emailStatus === 'sending'}
                    className="flex-1 sm:flex-none px-8 py-3.5 bg-gradient-to-r from-gray-900 to-black text-white font-semibold rounded-xl hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {emailStatus === 'sending' ? 'Sending Email...' : 'Creating Task...'}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <Plus className="h-5 w-5 mr-2" />
                        Create Task
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <AlertCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Tips for creating effective tasks:</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2"></div>
                  <span>Use clear, concise titles that summarize the task</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2"></div>
                  <span>Provide detailed descriptions with specific requirements</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2"></div>
                  <span>Set realistic due dates and prioritize accordingly</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2"></div>
                  <span>Assigned team members will receive email notifications</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2"></div>
                  <span>Check that the assigned user's email is correct before submitting</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
