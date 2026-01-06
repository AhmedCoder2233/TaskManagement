'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/app/supabase-provider'
import { CheckCircle, Circle, Clock, AlertCircle, Plus, Trash2, Tag, Shield, User, Edit } from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
    const router = useRouter()
    const supabase = useSupabase()
    const [tasks, setTasks] = useState<any[]>([])
    const [userRole, setUserRole] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

    const taskChannelRef = useRef<any>(null)

    const roleLabelMap: Record<string, string> = {
  member: 'Member',
  production_admin: 'Admin',
  sales_admin: 'Sales Admin',
};

    useEffect(() => {
        fetchUserAndTasks()
        return () => {
            if (taskChannelRef.current) {
                supabase.removeChannel(taskChannelRef.current)
            }
        }
    }, [supabase])

    useEffect(() => {
        if (currentUserId) {
            setupRealtimeSubscription()
        }
    }, [currentUserId])

    const fetchUserAndTasks = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.push('/auth/signin')
                return
            }

            setCurrentUserId(user.id)

            // Fetch user profile with role
            const { data: profile }: any = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            if (profile) {
                setUserRole(profile.role)
            }

            // Fetch tasks based on role
            let query: any = supabase
                .from('tasks')
                .select(`
                    *,
                    assignee:profiles!tasks_assigned_to_fkey(id, full_name, email),
                    creator:profiles!tasks_created_by_fkey(id, full_name, email)
                `)
                .order('created_at', { ascending: false })

            // If user is member, show only assigned tasks
            if (profile?.role === 'member') {
                query = query.eq('assigned_to', user.id)
            }
            // For sales_admin and production_admin, show all tasks

            const { data: tasksData, error }: any = await query

            if (error) {
                console.error('Error fetching tasks:', error)
                return
            }

            setTasks(tasksData || [])
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    const setupRealtimeSubscription = () => {
        const taskChannel = supabase
            .channel('dashboard_tasks')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks'
                },
                async (payload: any) => {
                    console.log('Task realtime update:', payload)

                    if (payload.eventType === 'INSERT') {
                        // Fetch new task with relations
                        const { data: newTask }: any = await supabase
                            .from('tasks')
                            .select(`
                                *,
                                assignee:profiles!tasks_assigned_to_fkey(id, full_name, email),
                                creator:profiles!tasks_created_by_fkey(id, full_name, email)
                            `)
                            .eq('id', payload.new.id)
                            .single()

                        if (newTask) {
                            // Check if user should see this task based on their role
                            const shouldShow = shouldShowTask(newTask)
                            if (shouldShow) {
                                setTasks(prev => [newTask, ...prev])
                            }
                        }
                    }
                    else if (payload.eventType === 'UPDATE') {
                        // Update the specific task
                        setTasks(prev => prev.map(task =>
                            task.id === payload.new.id ? { ...task, ...payload.new } : task
                        ))
                    }
                    else if (payload.eventType === 'DELETE') {
                        setTasks(prev => prev.filter(task => task.id !== payload.old.id))
                    }
                }
            )
            .subscribe((status: any) => {
                console.log('Task channel status:', status)
            })

        taskChannelRef.current = taskChannel
    }

    const shouldShowTask = (task: any) => {
        if (userRole === 'member') {
            return task.assigned_to === currentUserId
        }
        else if (userRole === 'sales_admin' || userRole === 'production_admin') {
            return true // Both can see all tasks
        }
        return false
    }

    const handleTaskClick = (taskId: string) => {
        router.push(`/dashboard/tasks/${taskId}`)
    }

    const handleEditTask = (taskId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        router.push(`/dashboard/tasks/${taskId}/edit`)
    }

    const toggleTaskCompletion = async (taskId: string, completed: boolean, e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            const updateData: any = {
                completed: !completed,
                completed_at: !completed ? new Date().toISOString() : null,
                status: !completed ? 'completed' : 'pending',
                updated_at: new Date().toISOString()
            }

            const { error }: any = await supabase
                .from('tasks')
                .update(updateData)
                .eq('id', taskId)

            if (error) {
                console.error('Error updating task:', error)
            }
        } catch (error) {
            console.error('Error updating task:', error)
        }
    }

    const handleDeleteTask = async (taskId: string) => {
        setDeletingTaskId(taskId)
        try {
            // First delete related comments
            await supabase
                .from('comments')
                .delete()
                .eq('task_id', taskId)

            // Then delete related attachments
            await supabase
                .from('attachments')
                .delete()
                .eq('task_id', taskId)

            // Finally delete the task
            const { error }: any = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId)

            if (error) {
                console.error('Error deleting task:', error)
            }

            // Task will be removed from list via realtime subscription
            setShowDeleteConfirm(null)
        } catch (error) {
            console.error('Error deleting task:', error)
        } finally {
            setDeletingTaskId(null)
        }
    }

    // Check if user can delete task
    const canDeleteTask = () => {
        // Only production_admin can delete tasks
        return userRole === 'production_admin'
    }

    // Check if user can edit task
    const canEditTask = (task: any) => {
        if (userRole === 'member') {
            // Members can only edit their own assigned tasks
            return task.assigned_to === currentUserId
        }
        else if (userRole === 'sales_admin' || userRole === 'production_admin') {
            // Both sales_admin and production_admin can edit all tasks
            return true
        }
        return false
    }

    // Check if user can create tasks
    const canCreateTasks = () => {
        return userRole === 'sales_admin' || userRole === 'production_admin'
    }

    const getRoleDisplayText = () => {
        switch(userRole) {
            case 'member':
                return 'Member - View your assigned tasks only'
            case 'production_admin':
                return 'Admin - View all tasks with full access (Create/Edit/Delete)'
            case 'sales_admin':
                return 'Sales Admin - View all tasks (Create/Edit only - No Delete)'
            default:
                return ''
        }
    }

    const getTaskCountText = () => {
        switch(userRole) {
            case 'member':
                return 'Your Tasks'
            case 'production_admin':
            case 'sales_admin':
                return 'All Tasks'
            default:
                return 'Tasks'
        }
    }
    

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading your tasks...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-gray-900">Task Dashboard</h1>
                         <span
  className={`px-3 py-1 rounded-full text-sm font-semibold ${
    userRole === 'member'
      ? 'bg-gray-100 text-gray-800 border border-gray-300'
      : userRole === 'production_admin'
      ? 'bg-blue-100 text-blue-800 border border-blue-300'
      : userRole === 'sales_admin'
      ? 'bg-green-100 text-green-800 border border-green-300'
      : 'bg-gray-100 text-gray-800 border border-gray-300'
  }`}
>
  {roleLabelMap[userRole ?? 'member']}
</span>
                        </div>
                        <p className="text-gray-600">
                            {getRoleDisplayText()}
                        </p>
                    </div>
                    
                    {/* Show create button for sales_admin and production_admin */}
                    {canCreateTasks() && (
                        <Link 
                            href="/dashboard/create" 
                            className="inline-flex items-center px-5 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-all duration-200 shadow-sm hover:shadow"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            Create New Task
                        </Link>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center">
                                <h2 className="text-xl font-semibold text-gray-900">
                                   {getTaskCountText()}
                                </h2>
                                <span className="ml-3 px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
                                    {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                                </span>
                            </div>
                            <div className="text-sm text-gray-500">
                                Real-time updates enabled
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-200">
                        {tasks.length === 0 ? (
                            <div className="px-6 py-16 text-center">
                                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="h-8 w-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
                                <p className="text-gray-600 max-w-md mx-auto mb-6">
                                    {userRole === 'member'
                                        ? 'You have no tasks assigned yet.'
                                        : userRole === 'production_admin' || userRole === 'sales_admin'
                                        ? 'No tasks found in the system.'
                                        : 'No tasks found.'}
                                </p>
                                {canCreateTasks() && (
                                    <Link
                                        href="/dashboard/create"
                                        className="inline-flex items-center px-5 py-2.5 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create your first task
                                    </Link>
                                )}
                            </div>
                        ) : (
                            tasks.map((task: any) => (
                                <div
                                    key={task.id}
                                    className="px-6 py-5 hover:bg-gray-50 cursor-pointer transition-colors group"
                                    onClick={() => handleTaskClick(task.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start space-x-4 flex-1 min-w-0">
                                            <button
                                                onClick={(e) => toggleTaskCompletion(task.id, task.completed, e)}
                                                className="focus:outline-none flex-shrink-0 mt-1"
                                                title={task.completed ? 'Mark as pending' : 'Mark as complete'}
                                            >
                                                {task.completed ? (
                                                    <CheckCircle className="h-6 w-6 text-green-600" />
                                                ) : (
                                                    <Circle className="h-6 w-6 text-gray-300 hover:text-gray-400" />
                                                )}
                                            </button>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="text-base font-semibold text-gray-900 truncate">{task.title}</h3>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                        task.priority === 'high' 
                                                            ? 'bg-red-100 text-red-800'
                                                            : task.priority === 'medium'
                                                            ? 'bg-yellow-100 text-yellow-800'
                                                            : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                        {task.priority}
                                                    </span>
                                                </div>

                                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                                    {task.description || 'No description provided'}
                                                </p>

                                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                                    <div className="flex items-center">
                                                        <UserCircle className="h-4 w-4 mr-1.5 text-gray-400" />
                                                        <span className="font-medium">Assignee:</span>
                                                        <span className="ml-1.5">{task.assignee?.full_name || 'Unassigned'}</span>
                                                    </div>

                                                    <div className="flex items-center">
                                                        <span className="font-medium">Created by:</span>
                                                        <span className="ml-1.5">{task.creator?.full_name || 'Unknown'}</span>
                                                    </div>

                                                    {task.due_date && (
                                                        <div className="flex items-center">
                                                            <Clock className="h-4 w-4 mr-1.5 text-gray-400" />
                                                            <span className="font-medium">Due:</span>
                                                            <span className="ml-1.5">{new Date(task.due_date).toLocaleDateString()}</span>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center">
                                                        <Calendar className="h-4 w-4 mr-1.5 text-gray-400" />
                                                        <span>{new Date(task.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 ml-4">
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                                                    task.status === 'completed' 
                                                        ? 'bg-green-100 text-green-800'
                                                        : task.status === 'in_progress'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {task.status?.replace('_', ' ') || task.status}
                                                </span>

                                                <div className="flex items-center gap-2">
                                                 

                                                    {/* Delete button only for production_admin */}
                                                    {canDeleteTask() && (
                                                        <div className="relative">
                                                            {showDeleteConfirm === task.id ? (
                                                                <div className="flex flex-col gap-2 bg-red-50 px-4 py-3 rounded-lg border border-red-100">
                                                                    <p className="text-sm text-red-700 font-medium">
                                                                        Delete this task permanently?
                                                                    </p>
                                                                    <div className="flex items-center gap-3">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                handleDeleteTask(task.id)
                                                                            }}
                                                                            disabled={deletingTaskId === task.id}
                                                                            className="text-xs px-3 py-1.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            {deletingTaskId === task.id ? (
                                                                                <span className="flex items-center">
                                                                                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                                    </svg>
                                                                                    Deleting...
                                                                                </span>
                                                                            ) : 'Yes, Delete'}
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setShowDeleteConfirm(null)
                                                                            }}
                                                                            className="text-xs px-3 py-1.5 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                    <p className="text-xs text-red-600 mt-1">
                                                                        This action cannot be undone.
                                                                    </p>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setShowDeleteConfirm(task.id)
                                                                    }}
                                                                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                                                    title="Delete task"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Show message for sales_admin that they can't delete */}
                                                    {userRole === 'sales_admin' && (
                                                        <div className="text-xs text-gray-500 italic px-2 py-1 bg-gray-100 rounded">
                                                            You can only assign tasks
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {task.priority === 'high' && (
                                                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Helper component for user icon
const UserCircle = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
    </svg>
)

// Helper component for calendar icon
const Calendar = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
    </svg>
)