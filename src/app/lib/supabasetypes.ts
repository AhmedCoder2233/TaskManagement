// types/supabase.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'member'
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'member'
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'member'
          created_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
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
        Insert: {
          id?: string
          title: string
          description?: string | null
          assigned_to: string
          created_by: string
          status?: 'pending' | 'in_progress' | 'completed'
          priority?: 'low' | 'medium' | 'high'
          due_date?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          assigned_to?: string
          created_by?: string
          status?: 'pending' | 'in_progress' | 'completed'
          priority?: 'low' | 'medium' | 'high'
          due_date?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      attachments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          file_name: string
          file_url: string
          file_type: string | null
          file_size: number | null
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          file_name: string
          file_url: string
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          file_name?: string
          file_url?: string
          file_type?: string | null
          file_size?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}