'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task, TaskStatus, STATUS_LABELS, Project, Profile, Notification } from '@/lib/types'

const supabase = createClient()
import { X, Loader } from 'lucide-react'

interface TaskFormModalProps {
  task?: Task | null
  selectedDate: string
  projects: Project[]
  profiles: Profile[]
  onClose: () => void
  onSave: () => void
  userId: string
  isPrivateDefault?: boolean
}

const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'waiting_next']

export default function TaskFormModal({
  task,
  selectedDate,
  projects,
  profiles,
  onClose,
  onSave,
  userId,
  isPrivateDefault = false,
}: TaskFormModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    date: selectedDate,
    status: 'pending' as TaskStatus,
    content: '',
    project_id: '',
    next_action: '',
    tags: '',
    is_private: isPrivateDefault,
    assigned_users: [] as string[],
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        date: task.date,
        status: task.status,
        content: task.content || '',
        project_id: task.project_id || '',
        next_action: task.next_action || '',
        tags: task.tags ? task.tags.join(', ') : '',
        is_private: task.is_private,
        assigned_users: task.assigned_users || [],
      })
      setSelectedProfiles(new Set(task.assigned_users || []))
    }
  }, [task])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleProfileToggle = (profileId: string) => {
    setSelectedProfiles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(profileId)) {
        newSet.delete(profileId)
      } else {
        newSet.add(profileId)
      }
      return newSet
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!formData.title.trim()) {
        setError('제목은 필수입니다.')
        setLoading(false)
        return
      }

      const tagsArray = formData.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

      const taskData = {
        title: formData.title,
        date: formData.date,
        status: formData.status,
        content: formData.content || null,
        project_id: formData.project_id || null,
        next_action: formData.next_action || null,
        tags: tagsArray,
        is_private: formData.is_private,
        assigned_users: Array.from(selectedProfiles),
      }

      if (task) {
        // Update existing task
        const { error: updateError } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', task.id)

        if (updateError) {
          setError('업무 수정 중 오류가 발생했습니다.')
          setLoading(false)
          return
        }
      } else {
        // Create new task
        const { data: newTask, error: insertError } = await supabase
          .from('tasks')
          .insert({
            ...taskData,
            user_id: userId,
            source: 'manual',
          })
          .select('id')
          .single()

        if (insertError) {
          setError('업무 생성 중 오류가 발생했습니다.')
          setLoading(false)
          return
        }

        // Create shared_tasks entries for assigned users
        if (selectedProfiles.size > 0 && newTask) {
          const sharedTasksData = Array.from(selectedProfiles).map(profileId => ({
            task_id: newTask.id,
            shared_with: profileId,
            shared_by: userId,
          }))

          await supabase.from('shared_tasks').insert(sharedTasksData)

          // Create notifications for assigned users
          const notifications: Notification[] = Array.from(selectedProfiles).map(profileId => ({
            id: crypto.randomUUID(),
            user_id: profileId,
            type: 'task_shared',
            title: '새 업무가 공유되었습니다',
            message: `${formData.title}`,
            data: { task_id: newTask.id },
            is_read: false,
            created_at: new Date().toISOString(),
          }))

          await supabase.from('notifications').insert(notifications)
        }
      }

      onSave()
    } catch (err) {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    if (!confirm('이 업무를 삭제하시겠습니까?')) return

    setLoading(true)
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', task.id)

      if (error) {
        setError('업무 삭제 중 오류가 발생했습니다.')
        setLoading(false)
        return
      }

      onSave()
    } catch (err) {
      setError('오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {task ? '업무 편집' : '새 업무'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="닫기"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Title Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              제목 *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="업무 제목을 입력하세요"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {/* Date Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              날짜
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {/* Status Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              상태
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              {STATUSES.map(status => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          {/* Content Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              상세 내용
            </label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              placeholder="업무에 대한 상세 내용을 입력하세요"
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Project Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              프로젝트
            </label>
            <select
              name="project_id"
              value={formData.project_id}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">프로젝트 선택...</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Next Action Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              다음 단계
            </label>
            <input
              type="text"
              name="next_action"
              value={formData.next_action}
              onChange={handleInputChange}
              placeholder="다음 단계를 입력하세요"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {/* Tags Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              태그 (쉼표로 구분)
            </label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              placeholder="예: 긴급, 중요, 협력필요"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {/* Assigned Users (사용자 태그) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              사용자 태그 (공유)
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {profiles.map(profile => (
                <label
                  key={profile.id}
                  className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedProfiles.has(profile.id)}
                    onChange={() => handleProfileToggle(profile.id)}
                    className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {profile.name}
                    </p>
                    {profile.position && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {profile.position}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Private Checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="is_private"
              checked={formData.is_private}
              onChange={handleInputChange}
              id="is_private"
              className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500"
            />
            <label htmlFor="is_private" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              비공개
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              취소
            </button>

            {task && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 px-4 py-2.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                삭제
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader className="w-4 h-4 animate-spin" />}
              {task ? '수정' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
