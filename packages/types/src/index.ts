export type TaskPriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'urgent'

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'needs_action'
  | 'needs_verification'
  | 'closed'

export type AccessRole =
  | 'super_admin'
  | 'admin'
  | 'member'

export interface Employee {
  id: string
  name: string
  phone: string
  email: string
  role: AccessRole
  orgLevel: number
  preferredLanguage: 'en' | 'hi' | 'te'
  status: 'active' | 'inactive'
}

export interface Task {
  id: string
  title: string
  description?: string
  priority: TaskPriority
  status: TaskStatus
  dueDate?: string
  createdAt: string
  lastActivityAt: string
}
