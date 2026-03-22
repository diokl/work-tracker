'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTasks, useProjects } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { Profile, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'

const supabase = createClient()
import { CheckCircle2, Circle, Clock, AlertCircle, Plus, Calendar } from 'lucide-react'
import TaskFormModal from './TaskFormModal'

interface DashboardViewProps {
  profile: Profile | null
  userId: string
}

export default function DashboardView({ profile, userId }: DashboardViewProps) {
  const { tasks, refetch: refetchTasks } = useTasks(userId)
  const { projects } = useProjects(userId)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [showForm, setShowForm] = useState(false)

  // Fetch approved profiles for sharing
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', userId)
        .eq('is_approved', true)
        .order('name')
      setProfiles(data || [])
    }
    if (userId) fetchProfiles()
  }, [userId])

  // Get today's date
  const today = new Date().toISOString().split('T')[0]
  const todayTasks = tasks.filter((t) => t.date === today)

  // Count tasks by status
  const statusCounts = {
    pending: todayTasks.filter((t) => t.status === 'pending').length,
    in_progress: todayTasks.filter((t) => t.status === 'in_progress').length,
    completed: todayTasks.filter((t) => t.status === 'completed').length,
    waiting_next: todayTasks.filter((t) => t.status === 'waiting_next').length,
  }

  // Get recent tasks (last 5)
  const recentTasks = tasks.slice(0, 5)

  // Get team activity (shared tasks or assigned to this user)
  const sharedTasks = tasks.filter((t) => t.assigned_users?.length > 0)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 size={16} className="text-blue-500" />
      case 'in_progress':
        return <Clock size={16} className="text-amber-500" />
      case 'waiting_next':
        return <AlertCircle size={16} className="text-red-500" />
      default:
        return <Circle size={16} className="text-gray-400" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00')
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-white shadow-md">
        <h1 className="text-3xl font-bold mb-2">
          {profile?.name}님, 오늘도 화이팅!
        </h1>
        <p className="text-primary-100">
          {new Date().toLocaleDateString('ko-KR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Tasks */}
        <div className="rounded-lg border border-[var(--border)] bg-white dark:bg-gray-900 p-5 shadow-sm">
          <p className="text-sm text-[var(--text-secondary)] mb-2">오늘 업무</p>
          <p className="text-3xl font-bold text-[var(--text)]">{todayTasks.length}</p>
          <div className="mt-3 text-xs text-[var(--text-secondary)]">
            총 {tasks.length}개 업무 중
          </div>
        </div>

        {/* In Progress */}
        <div className="rounded-lg border border-[var(--border)] bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--text-secondary)]">진행중</p>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-[var(--text)]">
            {statusCounts.in_progress}
          </p>
          <div className="mt-3 h-1 bg-amber-100 dark:bg-amber-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500"
              style={{
                width: `${
                  todayTasks.length > 0
                    ? (statusCounts.in_progress / todayTasks.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Completed */}
        <div className="rounded-lg border border-[var(--border)] bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--text-secondary)]">완료</p>
            <CheckCircle2 size={16} className="text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-[var(--text)]">
            {statusCounts.completed}
          </p>
          <div className="mt-3 h-1 bg-blue-100 dark:bg-blue-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{
                width: `${
                  todayTasks.length > 0
                    ? (statusCounts.completed / todayTasks.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Waiting Next */}
        <div className="rounded-lg border border-[var(--border)] bg-white dark:bg-gray-900 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[var(--text-secondary)]">다음단계대기</p>
            <AlertCircle size={16} className="text-red-500" />
          </div>
          <p className="text-3xl font-bold text-[var(--text)]">
            {statusCounts.waiting_next}
          </p>
          <div className="mt-3 h-1 bg-red-100 dark:bg-red-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500"
              style={{
                width: `${
                  todayTasks.length > 0
                    ? (statusCounts.waiting_next / todayTasks.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tasks */}
        <div className="lg:col-span-2 rounded-lg border border-[var(--border)] bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--text)]">최근 업무</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {recentTasks.length > 0 ? (
              recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{getStatusIcon(task.status)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text)] truncate">
                        {task.title}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
                        {task.content}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: STATUS_COLORS[task.status] }}>
                          {STATUS_LABELS[task.status]}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {formatDate(task.date)}
                        </span>
                        {task.project && (
                          <span className="text-xs text-primary-600 dark:text-primary-400">
                            {task.project.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-[var(--text-secondary)]">업무가 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* Team Activity & Quick Actions */}
        <div className="space-y-6">
          {/* Team Activity */}
          <div className="rounded-lg border border-[var(--border)] bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-semibold text-[var(--text)]">
                팀 활동
              </h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {sharedTasks.length > 0 ? (
                sharedTasks.slice(0, 4).map((task) => (
                  <div key={task.id} className="px-6 py-3">
                    <p className="text-sm font-medium text-[var(--text)] truncate">
                      {task.title}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {task.profile?.name || '알수없음'}
                    </p>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-[var(--text-secondary)]">
                    팀 활동이 없습니다
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors shadow-sm"
            >
              <Plus size={18} />
              새 업무 등록
            </button>
            <Link
              href="/calendar"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[var(--border)] bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-[var(--text)] font-medium transition-colors"
            >
              <Calendar size={18} />
              달력 보기
            </Link>
          </div>
        </div>
      </div>

      {/* Task Form Modal */}
      {showForm && (
        <TaskFormModal
          selectedDate={new Date().toISOString().split('T')[0] as string}
          projects={projects}
          profiles={profiles}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); refetchTasks(); }}
          userId={userId}
        />
      )}
    </div>
  )
}
