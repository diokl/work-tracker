'use client'

import { Task, TaskStatus, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'
import { X, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

interface TaskPanelProps {
  selectedDate: string | null
  tasks: Task[]
  onClose: () => void
  onAddTask: () => void
  onEditTask: (task: Task) => void
  onTasksRefresh: () => void
}

const WEEKDAY_LABELS_KR = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

export default function TaskPanel({
  selectedDate,
  tasks,
  onClose,
  onAddTask,
  onEditTask,
  onTasksRefresh,
}: TaskPanelProps) {
  const supabase = createClient()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  if (!selectedDate) {
    return null
  }

  const date = new Date(`${selectedDate}T00:00:00`)
  const dayOfWeek = WEEKDAY_LABELS_KR[date.getDay()]
  const displayDate = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${dayOfWeek}`

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingId(taskId)
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)

      if (!error) {
        onTasksRefresh()
      }
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white dark:bg-gray-900 shadow-lg border-l border-gray-200 dark:border-gray-800 flex flex-col z-50 animate-in slide-in-from-right">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {displayDate}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {tasks.length}개의 업무
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="닫기"
        >
          <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Add Task Button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={onAddTask}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          새 업무
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              이 날짜의 업무가 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer group"
                onClick={() => onEditTask(task)}
              >
                {/* Status and Title */}
                <div className="flex items-start gap-3 mb-2">
                  <div
                    className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[task.status] }}
                    title={STATUS_LABELS[task.status]}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white break-words group-hover:text-red-500 transition-colors">
                      {task.title}
                    </p>
                  </div>
                </div>

                {/* Project Name */}
                {task.project && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 ml-6">
                    프로젝트: {task.project.name}
                  </p>
                )}

                {/* Tags */}
                {task.tags && task.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3 ml-6">
                    {task.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Status Dropdown */}
                <div className="ml-6">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                    disabled={updatingId === task.id}
                    className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="pending">대기</option>
                    <option value="in_progress">진행중</option>
                    <option value="completed">완료</option>
                    <option value="waiting_next">다음단계대기</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
