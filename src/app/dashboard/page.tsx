'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/app/supabase-provider'
import { CheckCircle, Circle, Clock, AlertCircle, Plus, Trash2, Tag, Shield, User, Edit, ChevronRight, MoreVertical, Filter, Search, Loader2, Calendar, Flame } from 'lucide-react'
import Link from 'next/link'

export default function Dashboard() {
    const router = useRouter()
    const supabase = useSupabase()
    const [tasks, setTasks] = useState<any[]>([])
    const [filteredTasks, setFilteredTasks] = useState<any[]>([])
    const [userRole, setUserRole] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [priorityFilter, setPriorityFilter] = useState('all')
    const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)

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

    useEffect(() => {
        filterTasks()
    }, [tasks, searchQuery, statusFilter, priorityFilter])

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

            if (profile?.role === 'member') {
                query = query.eq('assigned_to', user.id)
            }

            const { data: tasksData, error }: any = await query

            if (error) {
                console.error('Error fetching tasks:', error)
                return
            }

            // Sort tasks: pending first (today's due dates first), completed last
            const sortedTasks = [...(tasksData || [])].sort((a, b) => {
                // First separate completed and pending tasks
                if (a.status === 'completed' && b.status !== 'completed') return 1
                if (a.status !== 'completed' && b.status === 'completed') return -1
                
                // If both are completed, sort by completion date (most recent first)
                if (a.status === 'completed' && b.status === 'completed') {
                    return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
                }
                
                // Now only pending tasks remain
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                
                const aDueDate = a.due_date ? new Date(a.due_date) : null
                const bDueDate = b.due_date ? new Date(b.due_date) : null
                
                // Check if due date is today
                const aIsToday = aDueDate ? 
                    aDueDate.getDate() === today.getDate() &&
                    aDueDate.getMonth() === today.getMonth() &&
                    aDueDate.getFullYear() === today.getFullYear() : false
                    
                const bIsToday = bDueDate ? 
                    bDueDate.getDate() === today.getDate() &&
                    bDueDate.getMonth() === today.getMonth() &&
                    bDueDate.getFullYear() === today.getFullYear() : false
                
                // Today's tasks come first
                if (aIsToday && !bIsToday) return -1
                if (!aIsToday && bIsToday) return 1
                
                // Then sort by due date (earliest first)
                if (aDueDate && bDueDate) {
                    return aDueDate.getTime() - bDueDate.getTime()
                }
                if (aDueDate && !bDueDate) return -1
                if (!aDueDate && bDueDate) return 1
                
                // Finally sort by creation date (newest first)
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            })

            setTasks(sortedTasks || [])
            setFilteredTasks(sortedTasks || [])
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
                            const shouldShow = shouldShowTask(newTask)
                            if (shouldShow) {
                                // Sort tasks after adding new one
                                setTasks(prev => {
                                    const updated = [newTask, ...prev]
                                    return sortTasksByDueDate(updated)
                                })
                            }
                        }
                    }
                    else if (payload.eventType === 'UPDATE') {
                        setTasks(prev => {
                            const updated = prev.map(task =>
                                task.id === payload.new.id ? { ...task, ...payload.new } : task
                            )
                            return sortTasksByDueDate(updated)
                        })
                    }
                    else if (payload.eventType === 'DELETE') {
                        setTasks(prev => {
                            const updated = prev.filter(task => task.id !== payload.old.id)
                            return sortTasksByDueDate(updated)
                        })
                    }
                }
            )
            .subscribe((status: any) => {
                console.log('Task channel status:', status)
            })

        taskChannelRef.current = taskChannel
    }

    const sortTasksByDueDate = (tasksArray: any[]) => {
        return [...tasksArray].sort((a, b) => {
            // First separate completed and pending tasks
            if (a.status === 'completed' && b.status !== 'completed') return 1
            if (a.status !== 'completed' && b.status === 'completed') return -1
            
            // If both are completed, sort by completion date (most recent first)
            if (a.status === 'completed' && b.status === 'completed') {
                return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
            }
            
            // Now only pending tasks remain
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            
            const aDueDate = a.due_date ? new Date(a.due_date) : null
            const bDueDate = b.due_date ? new Date(b.due_date) : null
            
            // Check if due date is today
            const aIsToday = aDueDate ? 
                aDueDate.getDate() === today.getDate() &&
                aDueDate.getMonth() === today.getMonth() &&
                aDueDate.getFullYear() === today.getFullYear() : false
                
            const bIsToday = bDueDate ? 
                bDueDate.getDate() === today.getDate() &&
                bDueDate.getMonth() === today.getMonth() &&
                bDueDate.getFullYear() === today.getFullYear() : false
            
            // Today's tasks come first
            if (aIsToday && !bIsToday) return -1
            if (!aIsToday && bIsToday) return 1
            
            // Then sort by due date (earliest first)
            if (aDueDate && bDueDate) {
                return aDueDate.getTime() - bDueDate.getTime()
            }
            if (aDueDate && !bDueDate) return -1
            if (!aDueDate && bDueDate) return 1
            
            // Finally sort by creation date (newest first)
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
    }

    const shouldShowTask = (task: any) => {
        if (userRole === 'member') {
            return task.assigned_to === currentUserId
        }
        else if (userRole === 'sales_admin' || userRole === 'production_admin') {
            return true
        }
        return false
    }

    const filterTasks = () => {
        let filtered = tasks

        // Apply search filter
        if (searchQuery) {
            filtered = filtered.filter(task =>
                task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.assignee?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }

        // Apply status filter (only pending and completed)
        if (statusFilter !== 'all') {
            filtered = filtered.filter(task => task.status === statusFilter)
        }

        // Apply priority filter
        if (priorityFilter !== 'all') {
            filtered = filtered.filter(task => task.priority === priorityFilter)
        }

        setFilteredTasks(filtered)
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
        setUpdatingTaskId(taskId)
        try {
            const updateData: any = {
                completed: !completed,
                completed_at: !completed ? new Date().toISOString() : null,
                status: !completed ? 'completed' : 'pending',
                updated_at: new Date().toISOString()
            }

            // Update UI immediately
            setTasks(prev => {
                const updated = prev.map(task =>
                    task.id === taskId ? { ...task, ...updateData } : task
                )
                return sortTasksByDueDate(updated)
            })

            const { error }: any = await supabase
                .from('tasks')
                .update(updateData)
                .eq('id', taskId)

            if (error) {
                console.error('Error updating task:', error)
            }
        } catch (error) {
            console.error('Error updating task:', error)
        } finally {
            setUpdatingTaskId(null)
        }
    }

    const handleDeleteTask = async (taskId: string) => {
        setDeletingTaskId(taskId)
        try {
            await supabase
                .from('comments')
                .delete()
                .eq('task_id', taskId)

            await supabase
                .from('attachments')
                .delete()
                .eq('task_id', taskId)

            const { error }: any = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId)

            if (error) {
                console.error('Error deleting task:', error)
            }

            setShowDeleteConfirm(null)
        } catch (error) {
            console.error('Error deleting task:', error)
        } finally {
            setDeletingTaskId(null)
        }
    }

    const canDeleteTask = () => {
        return userRole === 'production_admin'
    }

    const canEditTask = () => {
        if (userRole === 'production_admin') {
            return true
        }
        return false
    }

    const canCreateTasks = () => {
        return userRole === 'sales_admin' || userRole === 'production_admin'
    }

    const getRoleDisplayText = () => {
        switch (userRole) {
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
        switch (userRole) {
            case 'member':
                return 'Your Tasks'
            case 'production_admin':
            case 'sales_admin':
                return 'All Tasks'
            default:
                return 'Tasks'
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high':
                return { bg: 'bg-red-50', text: 'text-red-700', icon: '🔴' }
            case 'medium':
                return { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: '🟡' }
            case 'low':
                return { bg: 'bg-blue-50', text: 'text-blue-700', icon: '🔵' }
            default:
                return { bg: 'bg-gray-50', text: 'text-gray-700', icon: '⚪' }
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return { bg: 'bg-green-50', text: 'text-green-700', icon: '✓' }
            case 'pending':
                return { bg: 'bg-gray-100', text: 'text-gray-700', icon: '⏱️' }
            default:
                return { bg: 'bg-gray-50', text: 'text-gray-700', icon: '' }
        }
    }

    const formatDueDate = (dueDate: string, status: string) => {
        if (!dueDate) return 'No due date'
        
        // For completed tasks, just show the due date
        if (status === 'completed') {
            const due = new Date(dueDate)
            const options: Intl.DateTimeFormatOptions = { 
                month: 'short', 
                day: 'numeric',
                year: due.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
            }
            return `Due ${due.toLocaleDateString('en-US', options)}`
        }
        
        // For pending tasks, show relative dates
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const due = new Date(dueDate)
        due.setHours(0, 0, 0, 0)
        
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        
        if (due.getTime() === today.getTime()) {
            return 'Due today - Hurry up!'
        } else if (due.getTime() === tomorrow.getTime()) {
            return 'Due tomorrow'
        } else if (due.getTime() === yesterday.getTime()) {
            return 'Due yesterday'
        } else if (due < today) {
            const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
            return `Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`
        } else {
            const options: Intl.DateTimeFormatOptions = { 
                month: 'short', 
                day: 'numeric',
                year: due.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
            }
            return `Due ${due.toLocaleDateString('en-US', options)}`
        }
    }

    // Status counts for stats
    const pendingCount = tasks.filter(task => task.status === 'pending').length
    const completedCount = tasks.filter(task => task.status === 'completed').length
    const highPriorityCount = tasks.filter(task => task.priority === 'high').length

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
                        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">Task Dashboard</h1>
                                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r ${
                                    userRole === 'member'
                                        ? 'from-gray-700 to-gray-800'
                                        : userRole === 'production_admin'
                                        ? 'from-blue-500 to-blue-600'
                                        : userRole === 'sales_admin'
                                        ? 'from-emerald-500 to-emerald-600'
                                        : 'from-gray-700 to-gray-800'
                                } text-white shadow-sm`}>
                                    {roleLabelMap[userRole ?? 'member']}
                                </span>
                            </div>
                            <p className="text-gray-600 max-w-2xl">
                                {getRoleDisplayText()}
                            </p>
                        </div>

                        {canCreateTasks() && (
                            <Link
                                href="/dashboard/create"
                                className="group inline-flex items-center px-6 py-3.5 bg-gradient-to-r from-gray-900 to-black text-white font-semibold rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-xl active:scale-[0.98]"
                            >
                                <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                                Create New Task
                            </Link>
                        )}
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Pending Tasks</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">{pendingCount}</p>
                            </div>
                            <div className="h-12 w-12 bg-gray-100 rounded-xl flex items-center justify-center">
                                <Clock className="h-6 w-6 text-gray-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Completed Tasks</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">{completedCount}</p>
                            </div>
                            <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <CheckCircle className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">High Priority</p>
                                <p className="text-3xl font-bold text-gray-900 mt-2">{highPriorityCount}</p>
                            </div>
                            <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center">
                                <AlertCircle className="h-6 w-6 text-red-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search and Filters Section */}
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 shadow-sm border border-gray-200 mb-8">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search Input */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search tasks by title, description, or assignee..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:outline-none transition-all duration-200"
                            />
                        </div>

                        {/* Status Filter (Pending/Completed only) */}
                        <div className="flex gap-3">
                            <div className="relative">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="appearance-none w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:outline-none transition-all duration-200"
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="completed">Completed</option>
                                </select>
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                    <Filter className="h-4 w-4 text-gray-400" />
                                </div>
                            </div>

                            <div className="relative">
                                <select
                                    value={priorityFilter}
                                    onChange={(e) => setPriorityFilter(e.target.value)}
                                    className="appearance-none w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-400 focus:border-transparent focus:outline-none transition-all duration-200"
                                >
                                    <option value="all">All Priority</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                    <Filter className="h-4 w-4 text-gray-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tasks Container */}
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center">
                                <h2 className="text-xl font-semibold text-gray-900">
                                    {getTaskCountText()}
                                </h2>
                                <span className="ml-3 px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-full shadow-sm">
                                    {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
                                </span>
                                {filteredTasks.length !== tasks.length && (
                                    <span className="ml-2 text-sm text-gray-500">
                                        (filtered from {tasks.length})
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                                Real-time updates active
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-200/50">
                        {filteredTasks.length === 0 ? (
                            <div className="px-6 py-16 text-center">
                                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                                    <CheckCircle className="h-10 w-10 text-gray-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-3">No tasks found</h3>
                                <p className="text-gray-600 max-w-md mx-auto mb-8">
                                    {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                                        ? 'No tasks match your current filters. Try adjusting your search criteria.'
                                        : userRole === 'member'
                                            ? 'You have no tasks assigned yet. Tasks will appear here once assigned.'
                                            : 'No tasks found in the system. Create your first task to get started.'}
                                </p>
                                {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all') ? (
                                    <button
                                        onClick={() => {
                                            setSearchQuery('')
                                            setStatusFilter('all')
                                            setPriorityFilter('all')
                                        }}
                                        className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-black transition-colors shadow-sm"
                                    >
                                        Clear Filters
                                    </button>
                                ) : canCreateTasks() && (
                                    <Link
                                        href="/dashboard/create"
                                        className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-black transition-colors shadow-sm hover:shadow"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create First Task
                                    </Link>
                                )}
                            </div>
                        ) : (
                            filteredTasks.map((task: any) => {
                                const priorityColor = getPriorityColor(task.priority)
                                const statusColor = getStatusColor(task.status)
                                const dueText = formatDueDate(task.due_date, task.status)
                                const isTodayDue = task.status === 'pending' && dueText.includes('Due today')
                                const isOverdue = task.status === 'pending' && (dueText.includes('Overdue') || dueText.includes('Due yesterday'))

                                return (
                                    <div
                                        key={task.id}
                                        className={`group px-6 py-5 hover:bg-gray-50 transition-all duration-200 cursor-pointer ${
                                            task.status !== 'completed' && isTodayDue ? 'bg-gradient-to-r from-amber-50/50 to-white border-l-4 border-amber-500' : ''
                                        } ${
                                            task.status !== 'completed' && isOverdue ? 'bg-gradient-to-r from-red-50/50 to-white border-l-4 border-red-500' : ''
                                        }`}
                                        onClick={() => handleTaskClick(task.id)}
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Task Status Indicator */}
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => toggleTaskCompletion(task.id, task.completed, e)}
                                                    className="focus:outline-none flex-shrink-0 relative group/checkbox"
                                                    disabled={updatingTaskId === task.id}
                                                    title={task.completed ? 'Mark as pending' : 'Mark as complete'}
                                                >
                                                    {updatingTaskId === task.id ? (
                                                        <div className="w-7 h-7 flex items-center justify-center">
                                                            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                                                        </div>
                                                    ) : task.completed ? (
                                                        <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center border-2 border-green-500 group-hover/checkbox:bg-green-200 transition-colors">
                                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-full border-2 border-gray-300 group-hover/checkbox:border-gray-500 transition-colors flex items-center justify-center">
                                                            <Circle className="h-4 w-4 text-gray-300 group-hover/checkbox:text-gray-500" />
                                                        </div>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Task Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-black transition-colors truncate">
                                                                {task.title}
                                                            </h3>
                                                            <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${priorityColor.bg} ${priorityColor.text}`}>
                                                                {priorityColor.icon} {task.priority} priority
                                                            </span>
                                                            {task.status !== 'completed' && (isTodayDue || isOverdue) && (
                                                                <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                                                                    isTodayDue ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                                }`}>
                                                                    {isTodayDue ? '🔥 Due Today!' : '⚠️ Overdue!'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-600 line-clamp-2">
                                                            {task.description || 'No description provided'}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${statusColor.bg} ${statusColor.text}`}>
                                                            {statusColor.icon} {task.status === 'completed' ? 'Completed' : 'Pending'}
                                                        </span>
                                                        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                                                    </div>
                                                </div>

                                                {/* Task Meta */}
                                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                                                            <User className="h-3 w-3 text-gray-500" />
                                                        </div>
                                                        <span className="font-medium">Assigned to:</span>
                                                        <span className="text-gray-800">{task.assignee?.full_name || 'Unassigned'}</span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                                                            <User className="h-3 w-3 text-gray-500" />
                                                        </div>
                                                        <span className="font-medium">Created by:</span>
                                                        <span className="text-gray-800">{task.creator?.full_name || 'Unknown'}</span>
                                                    </div>

                                                    {task.due_date && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                                                                <Calendar className="h-3 w-3 text-gray-500" />
                                                            </div>
                                                            <span className="font-medium">Due:</span>
                                                            <span className={`font-semibold ${
                                                                task.status === 'completed' ? 'text-gray-600' :
                                                                isTodayDue ? 'text-amber-600' :
                                                                isOverdue ? 'text-red-600' :
                                                                'text-gray-800'
                                                            }`}>
                                                                {dueText}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center justify-between mt-4">
                                            {canDeleteTask() && (
                                                <div className="relative">
                                                    {showDeleteConfirm === task.id ? (
                                                        <div className="absolute right-0 top-0 z-10 bg-red-50 px-4 py-3 rounded-xl shadow-lg border border-red-100">
                                                            <p className="text-sm text-red-700 font-medium mb-2">
                                                                Delete this task permanently?
                                                            </p>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleDeleteTask(task.id)
                                                                    }}
                                                                    disabled={deletingTaskId === task.id}
                                                                    className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    {deletingTaskId === task.id ? 'Deleting...' : 'Delete'}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setShowDeleteConfirm(null)
                                                                    }}
                                                                    className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setShowDeleteConfirm(task.id)
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete task"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="mt-8 text-center text-sm text-gray-500">
                    <p>
                        Showing {filteredTasks.length} of {tasks.length} tasks • 
                        <span className="inline-flex items-center ml-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1.5"></span>
                            Real-time updates enabled
                        </span>
                    </p>
                </div>
            </div>
        </div>
    )
}
