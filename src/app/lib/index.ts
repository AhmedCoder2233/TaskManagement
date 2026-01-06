// types/index.ts
export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'member'
  created_at: string
  updated_at: string | null
}

// Base task type without relations
export interface BaseTask {
  id: string
  title: string
  description: string | null
  assigned_to: string
  created_by: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

// Task with optional relations
export interface Task extends BaseTask {
  assignee?: Partial<Profile>
  creator?: Partial<Profile>
}

// For API responses with relations
export interface TaskWithRelations extends BaseTask {
  assignee: Profile
  creator: Profile
}