'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSupabase } from '@/app/supabase-provider'
import { ArrowLeft, MessageSquare, Paperclip, Send, User, Clock, Calendar, CheckCircle, Edit, Save, X, Trash2, Eye, Download, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function TaskDetail() {
  const params = useParams()
  const router = useRouter()
  const supabase = useSupabase()
  const taskId = params.id as string

  const [task, setTask] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  // Refs for channels
  const taskChannelRef = useRef<any>(null)
  const commentsChannelRef = useRef<any>(null)
  const attachmentsChannelRef = useRef<any>(null)

  useEffect(() => {
    fetchData()
    return () => {
      // Cleanup channels
      if (taskChannelRef.current) {
        supabase.removeChannel(taskChannelRef.current)
      }
      if (commentsChannelRef.current) {
        supabase.removeChannel(commentsChannelRef.current)
      }
      if (attachmentsChannelRef.current) {
        supabase.removeChannel(attachmentsChannelRef.current)
      }
    }
  }, [supabase, taskId])

  useEffect(() => {
    if (taskId && !loading) {
      setupRealtimeSubscriptions()
    }
  }, [taskId, loading])

  const fetchData = async () => {
    try {
      const { data: { user } }: any = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/signin')
        return
      }

      setCurrentUserId(user.id)

      // Get user role
      const { data: profile }: any = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setUserRole(profile?.role || null)

      // Fetch task
      const { data: taskData }: any = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!tasks_assigned_to_fkey(id, full_name, email),
          creator:profiles!tasks_created_by_fkey(id, full_name, email)
        `)
        .eq('id', taskId)
        .single()

      if (taskData) {
        setTask(taskData)
        setEditForm({
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          due_date: taskData.due_date ? taskData.due_date.split('T')[0] : '',
          status: taskData.status
        })
      }

      // Fetch comments
      const { data: commentsData }: any = await supabase
        .from('comments')
        .select(`
          *,
          user:profiles(id, full_name, email)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

      setComments(commentsData || [])

      // Fetch attachments
      const { data: attachmentsData }: any = await supabase
        .from('attachments')
        .select(`
          *,
          user:profiles(id, full_name)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })

      setAttachments(attachmentsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const setupRealtimeSubscriptions = () => {
    console.log('Setting up realtime subscriptions...')
    
    // Task updates channel
    const taskChannel = supabase
      .channel(`task_detail_${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `id=eq.${taskId}`
        },
        async (payload: any) => {
          console.log('📢 Task UPDATE received:', payload)
          
          // Fetch updated task with relations
          const { data: updatedTask }: any = await supabase
            .from('tasks')
            .select(`
              *,
              assignee:profiles!tasks_assigned_to_fkey(id, full_name, email),
              creator:profiles!tasks_created_by_fkey(id, full_name, email)
            `)
            .eq('id', taskId)
            .single()

          if (updatedTask) {
            console.log('Updating task state:', updatedTask)
            setTask(updatedTask)
            setEditForm({
              title: updatedTask.title,
              description: updatedTask.description,
              priority: updatedTask.priority,
              due_date: updatedTask.due_date ? updatedTask.due_date.split('T')[0] : '',
              status: updatedTask.status
            })
          }
        }
      )
      .subscribe((status: any) => {
        console.log('Task channel status:', status)
      })

    taskChannelRef.current = taskChannel

    // Comments channel
    const commentsChannel = supabase
      .channel(`task_comments_${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `task_id=eq.${taskId}`
        },
        async (payload: any) => {
          console.log('📢 Comment INSERT received:', payload)
          
          // Fetch the new comment with user data
          const { data: newComment }: any = await supabase
            .from('comments')
            .select(`
              *,
              user:profiles(id, full_name, email)
            `)
            .eq('id', payload.new.id)
            .single()

          if (newComment) {
            console.log('Adding new comment:', newComment)
            setComments(prev => [...prev, newComment])
          }
        }
      )
      .subscribe((status: any) => {
        console.log('Comments channel status:', status)
      })

    commentsChannelRef.current = commentsChannel

    // Attachments channel
    const attachmentsChannel = supabase
      .channel(`task_attachments_${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attachments',
          filter: `task_id=eq.${taskId}`
        },
        async (payload: any) => {
          console.log('📢 Attachment INSERT received:', payload)
          
          // Fetch the new attachment with user data
          const { data: newAttachment }: any = await supabase
            .from('attachments')
            .select(`
              *,
              user:profiles(id, full_name)
            `)
            .eq('id', payload.new.id)
            .single()

          if (newAttachment) {
            console.log('Adding new attachment:', newAttachment)
            setAttachments(prev => [newAttachment, ...prev])
          }
        }
      )
      .subscribe((status: any) => {
        console.log('Attachments channel status:', status)
      })

    attachmentsChannelRef.current = attachmentsChannel
  }

  // Check if user can edit task
  const canEditTask = () => {
    if (userRole === 'member') {
      // Members can only edit their own assigned tasks
      return false
    }
    else if (userRole === 'production_admin') {
      // Both sales_admin and production_admin can edit all tasks
      return true
    }
    return false
  }

  // Check if user can delete task
  const canDeleteTask = () => {
    // Only production_admin can delete tasks
    return userRole === 'production_admin'
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    try {
      const { data: { user } }: any = await supabase.auth.getUser()
      
      if (!user) return

      console.log('Submitting comment...')
      await supabase
        .from('comments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          content: newComment.trim(),
        })

      setNewComment('')
    } catch (error) {
      console.error('Error submitting comment:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset upload error
    setUploadError(null)

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File size exceeds 50MB limit')
      return
    }

    try {
      setUploading(true)
      const { data: { user } }: any = await supabase.auth.getUser()
      
      if (!user) return

      // Create bucket if not exists
      try {
        await supabase.storage.createBucket('task-attachments', {
          public: true,
          fileSizeLimit: 52428800,
        })
      } catch (bucketError: any) {
        if (!bucketError.message.includes('already exists')) {
          console.error('Bucket creation error:', bucketError)
        }
      }

      // Upload file
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
      const filePath = `${taskId}/${fileName}`

      const { error: uploadError }: any = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        setUploadError(`Upload failed: ${uploadError.message}`)
        return
      }

      // Get public URL
      const { data: { publicUrl } }: any = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath)

      // Save to database
      await supabase
        .from('attachments')
        .insert({
          task_id: taskId,
          user_id: user.id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
        })

      e.target.value = ''
    } catch (error: any) {
      console.error('Upload failed:', error)
      setUploadError(`Upload failed: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const toggleTaskCompletion = async () => {
    if (!task) return

    try {
      const { error }: any = await supabase
        .from('tasks')
        .update({ 
          completed: !task.completed,
          completed_at: !task.completed ? new Date().toISOString() : null,
          status: !task.completed ? 'completed' : 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)

      if (error) {
        console.error('Error updating task:', error)
      }
    } catch (error: any) {
      console.error('Error updating task:', error)
    }
  }

  const handleEditTask = async () => {
    if (!editing) {
      setEditing(true)
      return
    }

    try {
      const updateData: any = {
        title: editForm.title,
        description: editForm.description,
        priority: editForm.priority,
        due_date: editForm.due_date ? `${editForm.due_date}T00:00:00` : null,
        status: editForm.status,
        updated_at: new Date().toISOString()
      }

      const { error }: any = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)

      if (error) {
        console.error('Error updating task:', error)
        return
      }

      setEditing(false)
    } catch (error: any) {
      console.error('Error updating task:', error)
    }
  }

  const cancelEdit = () => {
    setEditing(false)
    setEditForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      status: task.status
    })
  }

  const handleDeleteTask = async () => {
    setDeleting(true)
    try {
      // Delete related comments
      await supabase
        .from('comments')
        .delete()
        .eq('task_id', taskId)

      // Delete related attachments
      await supabase
        .from('attachments')
        .delete()
        .eq('task_id', taskId)

      // Delete task
      const { error }: any = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) {
        console.error('Error deleting task:', error)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Error deleting task:', error)
    } finally {
      setDeleting(false)
    }
  }

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setEditForm((prev: any) => ({
      ...prev,
      [name]: value
    }))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading task details...</p>
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Task not found</h2>
          <p className="text-gray-600 mb-8">The task you're looking for doesn't exist or you don't have permission to view it.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-5 py-2.5 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {/* Edit button for authorized users */}
              {(canEditTask() && !editing) && (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
              )}

              {/* Delete button only for production_admin */}
              {canDeleteTask() && (
                <div className="relative">
                  {showDeleteConfirm ? (
                    <div className="flex flex-col gap-3 bg-red-50 px-4 py-3 rounded-lg border border-red-100 absolute right-0 top-12 w-64 z-10 shadow-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-red-700 mb-1">Delete this task?</p>
                          <p className="text-xs text-red-600 mb-3">This will permanently delete the task and all related comments & attachments.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDeleteTask}
                          disabled={deleting}
                          className="flex-1 px-3 py-1.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={deleting}
                      className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Task
                    </button>
                  )}
                </div>
              )}

              {/* Show message for sales_admin (can edit but not delete) */}
              {userRole === 'sales_admin' && !canDeleteTask() && (
                <div className="text-sm text-gray-500 italic px-3 py-1.5 bg-gray-100 rounded-lg border border-gray-200">
                  No Delete or Edit permission
                </div>
              )}
            </div>
          </div>

          {/* Task Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-start gap-4 mb-4">
                  {editing ? (
                    <input
                      type="text"
                      name="title"
                      value={editForm.title}
                      onChange={handleEditChange}
                      className="text-3xl font-bold text-gray-900 bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent w-full"
                      placeholder="Task title"
                    />
                  ) : (
                    <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
                  )}
                  
                  {/* Mark as complete button - available for assignee and admins */}
                  {(userRole === 'member' && task.assigned_to === currentUserId) || 
                   userRole === 'sales_admin' || 
                   userRole === 'production_admin' ? (
                    <button
                      onClick={toggleTaskCompletion}
                      className="focus:outline-none flex-shrink-0"
                      title={task.completed ? 'Mark as pending' : 'Mark as complete'}
                    >
                      {task.completed ? (
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      ) : (
                        <CheckCircle className="h-8 w-8 text-gray-300 hover:text-gray-400" />
                      )}
                    </button>
                  ) : null}
                </div>
                
                {editing ? (
                  <textarea
                    name="description"
                    value={editForm.description || ''}
                    onChange={handleEditChange}
                    rows={3}
                    className="w-full mb-6 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Task description"
                  />
                ) : (
                  <p className="text-gray-600 mb-6">{task.description || 'No description provided'}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500 mb-1">Assigned To</p>
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center mr-3">
                        <User className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-gray-900">{task.assignee?.full_name || 'Unassigned'}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500 mb-1">Assigned By</p>
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center mr-3">
                        <User className="h-4 w-4" />
                      </div>
                      <p className="font-semibold text-gray-900">{task.creator?.full_name || 'Unassigned'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
                    {editing ? (
                      <select
                        name="status"
                        value={editForm.status}
                        onChange={handleEditChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                        task.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : task.status === 'in_progress'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {(task.status || '').replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500 mb-1">Priority</p>
                    {editing ? (
                      <select
                        name="priority"
                        value={editForm.priority}
                        onChange={handleEditChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                        task.priority === 'high' 
                          ? 'bg-red-100 text-red-800'
                          : task.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {task.priority}
                      </span>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-500 mb-1">Due Date</p>
                    {editing ? (
                      <input
                        type="date"
                        name="due_date"
                        value={editForm.due_date}
                        onChange={handleEditChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      />
                    ) : (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="font-semibold text-gray-900">
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Edit Actions - Show only when editing */}
              {editing && (
                <div className="flex lg:flex-col gap-2">
                  <button
                    onClick={handleEditTask}
                    className="inline-flex items-center justify-center px-4 py-2 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Comments */}
          <div className="lg:col-span-2 space-y-8">
            {/* Comments Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 text-gray-500 mr-3" />
                    <h2 className="text-xl font-semibold text-gray-900">Comments</h2>
                    <span className="ml-3 px-2.5 py-0.5 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
                      {comments.length}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Real-time chat
                  </div>
                </div>
              </div>
              
              {/* Comments List */}
              <div className="p-6">
                {comments.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No comments yet. Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {comments.map((comment: any) => (
                      <div key={comment.id} className="animate-fadeIn">
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center flex-shrink-0">
                            <span className="font-semibold">
                              {comment.user?.full_name?.[0]?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-semibold text-gray-900">
                                {comment.user?.full_name || 'Unknown User'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(comment.created_at).toLocaleString()}
                              </p>
                            </div>
                            <p className="text-gray-700 bg-gray-50 rounded-lg p-4">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comment Input - Available for all logged in users */}
              <div className="px-6 py-5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                <form onSubmit={handleSubmitComment} className="flex gap-3">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type your comment..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Attachments Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Paperclip className="h-5 w-5 text-gray-500 mr-3" />
                    <h2 className="text-xl font-semibold text-gray-900">Attachments</h2>
                    <span className="ml-3 px-2.5 py-0.5 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
                      {attachments.length}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {/* Upload Area - Available for assignee and admins */}
                {(userRole === 'member' && task.assigned_to === currentUserId) || 
                 userRole === 'sales_admin' || 
                 userRole === 'production_admin' ? (
                  <div className="mb-6">
                    <label className="block">
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
                        <Paperclip className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-700 mb-1">
                          Drop files here or click to upload
                        </p>
                        <p className="text-xs text-gray-500">Max file size: 50MB</p>
                        <input
                          type="file"
                          onChange={handleFileUpload}
                          disabled={uploading}
                          className="hidden"
                          id="file-upload"
                        />
                      </div>
                    </label>
                    
                    {uploadError && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-700">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <p className="text-sm font-medium">{uploadError}</p>
                        </div>
                      </div>
                    )}
                    
                    {uploading && (
                      <div className="flex items-center justify-center mt-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black mr-3"></div>
                        <p className="text-sm text-gray-600">Uploading...</p>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Attachments List */}
                {attachments.length === 0 ? (
                  <div className="text-center py-8">
                    <Paperclip className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No attachments yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attachments.map((attachment: any) => (
                      <div key={attachment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors animate-fadeIn">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <Paperclip className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {attachment.file_name}
                            </p>
                            <div className="flex items-center text-xs text-gray-500 mt-1">
                              <span>{formatFileSize(attachment.file_size || 0)}</span>
                              {attachment.user?.full_name && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span>Uploaded by {attachment.user.full_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a
                            href={attachment.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-600 hover:text-black transition-colors"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                          <a
                            href={attachment.file_url}
                            download
                            className="p-2 text-gray-600 hover:text-black transition-colors"
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Task Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Created By</p>
                  <p className="font-semibold text-gray-900">{task.creator?.full_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Created Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(task.created_at).toLocaleDateString()} at {new Date(task.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Last Updated</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(task.updated_at).toLocaleDateString()} at {new Date(task.updated_at).toLocaleTimeString()}
                  </p>
                </div>
                {task.completed_at && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Completed Date</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(task.completed_at).toLocaleDateString()} at {new Date(task.completed_at).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
