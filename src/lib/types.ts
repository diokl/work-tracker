export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'waiting_next'
export type UserRole = 'admin' | 'member'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ProjectStatus = 'active' | 'archived'
export type KpiType = 'numeric' | 'schedule' | 'score' | 'count'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: '대기',
  in_progress: '진행중',
  completed: '완료',
  waiting_next: '다음단계대기',
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  completed: '#3B82F6',
  in_progress: '#F59E0B',
  waiting_next: '#EF4444',
  pending: '#9CA3AF',
}

export interface Profile {
  id: string
  name: string
  position: string | null
  department: string | null
  part: string | null
  eval_year: number | null
  avatar_color: string
  role: UserRole
  is_approved: boolean
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  title: string
  content: string | null
  date: string
  status: TaskStatus
  project_id: string | null
  kpi_id: string | null
  next_action: string | null
  source: string
  tags: string[]
  ai_summary: string | null
  is_private: boolean
  assigned_users: string[]
  created_at: string
  updated_at: string
  // joined
  project?: Project
  profile?: Profile
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  kpi_id: string | null
  workflow: any
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface KpiDefinition {
  id: string
  user_id: string
  kpi_no: number
  name: string
  weight: number
  type: KpiType
  target_value: string | null
  grade_criteria: any
  formula_description: string | null
  deadline: string | null
  sub_items: any
  eval_year: number | null
  created_at: string
  updated_at: string
}

export interface KpiValue {
  id: string
  user_id: string
  kpi_def_id: string
  value: number
  task_id: string | null
  input_date: string
  note: string | null
  created_at: string
}

export interface ApprovalRequest {
  id: string
  user_id: string
  email: string
  name: string
  department: string | null
  status: ApprovalStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string | null
  data: any
  is_read: boolean
  created_at: string
}

export interface SharedTask {
  id: string
  task_id: string
  shared_with: string
  shared_by: string
  created_at: string
}

export interface DaySummary {
  date: string
  total: number
  completed: number
  in_progress: number
  waiting_next: number
  pending: number
}
