'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { Task, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import { Lock, Plus, Edit2, Trash2 } from 'lucide-react'
import TaskFormModal from '@/components/TaskFormModal'

interface PersonalTask extends Task {}

interface PersonalViewProps {
  userId: string
}

export default function PersonalView({ userId }: PersonalViewProps) {
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()
  const [tasks, setTasks] = useState<PersonalTask[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [allProjects, setAllProjects] = useState<any[]>([])
  const [allProfiles, setAllProfiles] = useState<any[]>([])

  useEffect(() => {
    if (!userId) return
    fetchTasks()
    fetchProjects()
    fetchProfiles()
  }, [userId])

  const fetchTasks = async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_private', true)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  const fetchProjects = async () => {
    if (!userId) return
    const { data } = await supabase.from('projects').select('*').eq('user_id', userId)
    if (data) setAllProjects(data)
  }

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*')
    if (data) setAllProfiles(data)
  }

  const handleTaskSave = () => {
    setShowCreateModal(false)
    setSelectedTask(null)
    fetchTasks()
  }

  const handleDelete = async (taskId: string) => {
    if (!confirm('이 개인 업무를 삭제하시겠습니까?')) return
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (!error) {
      fetchTasks()
    }
  }

  // Group tasks by date
  const groupedTasks: Record<string, PersonalTask[]> = {}
  tasks.forEach(task => {
    const taskDate = task.date
    if (taskDate) {
      if (!groupedTasks[taskDate]) {
        groupedTasks[taskDate] = []
      }
      groupedTasks[taskDate].push(task)
    }
  })

  const sortedDates = Object.keys(groupedTasks).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400">로딩중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-8 h-8 text-gray-900 dark:text-white" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">개인 업무</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">이 페이지의 업무는 본인만 볼 수 있습니다</p>
        </div>
        <button
          onClick={() => {
            setSelectedTask(null)
            setShowCreateModal(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">새 개인 업무</span>
        </button>
      </div>

      {/* Tasks by Date */}
      {tasks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Lock className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">등록된 개인 업무가 없습니다</p>
          <button
            onClick={() => {
              setSelectedTask(null)
              setShowCreateModal(true)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            첫 개인 업무 등록하기
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map(date => {
            const tasksForDate = groupedTasks[date]
            if (!tasksForDate) return null
            return (
            <div key={date} className="space-y-3">
              {/* Date Header */}
              <div className="flex items-center gap-2 px-4">
                <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  {new Date(date).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    weekday: 'short',
                  })}
                </h2>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
              </div>

              {/* Task Cards */}
              <div className="space-y-3">
                {tasksForDate.map(task => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md dark:hover:shadow-lg/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Task Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate mb-1">
                          {task.title}
                        </h3>
                        {task.content && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                            {task.content}
                          </p>
                        )}

                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {task.tags.map(tag => (
                              <span
                                key={tag}
                                className="inline-block text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Meta Info */}
                        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                          <span
                            className="inline-block px-2 py-1 rounded-full font-medium"
                            style={{
                              backgroundColor: `${STATUS_COLORS[task.status]}20`,
                              color: STATUS_COLORS[task.status],
                            }}
                          >
                            {STATUS_LABELS[task.status]}
                          </span>
                          {task.project && (
                            <span className="text-gray-600 dark:text-gray-400">
                              {task.project.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                          title="편집"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Task Form Modal */}
      {showCreateModal && (
        <TaskFormModal
          task={selectedTask}
          selectedDate={new Date().toISOString().split('T')[0] || ''}
          projects={allProjects}
          profiles={allProfiles}
          onClose={() => {
            setShowCreateModal(false)
            setSelectedTask(null)
          }}
          onSave={handleTaskSave}
          userId={user?.id || 'unknown'}
          isPrivateDefault={true}
        />
      )}

      {selectedTask && (
        <TaskFormModal
          task={selectedTask}
          selectedDate={selectedTask.date}
          projects={allProjects}
          profiles={allProfiles}
          onClose={() => setSelectedTask(null)}
          onSave={handleTaskSave}
          userId={user?.id || 'unknown'}
          isPrivateDefault={true}
        />
      )}
    </div>
  )
}
