'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task, TaskStatus, STATUS_LABELS, Project, Profile } from '@/lib/types'

const supabase = createClient()
import { X, Loader, Sparkles } from 'lucide-react'

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
    start_date: selectedDate,
    end_date: '',
    status: 'pending' as TaskStatus,
    content: '',
    project_id: '',
    next_action: '',
    tags: '',
    is_private: isPrivateDefault,
    assigned_users: [] as string[],
  })

  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        date: task.date,
        start_date: task.start_date || task.date,
        end_date: task.end_date || '',
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

  const handleAiEnhance = async () => {
    setAiLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      // Get auth session from Supabase
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setError('인증 토큰을 가져올 수 없습니다.')
        setAiLoading(false)
        return
      }

      // Call the AI enhance endpoint
      const response = await fetch('/api/ai/enhance-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          projects: projects.map(p => ({ id: p.id, name: p.name })),
          existingTasks: [],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(`AI 정리 실패: ${errorData.error || '알 수 없는 오류'}`)
        setAiLoading(false)
        return
      }

      const result = await response.json()

      // Update form with AI suggestions
      setFormData(prev => ({
        ...prev,
        content: result.enhanced_content || prev.content,
        next_action: result.suggested_next_action || prev.next_action,
        project_id: result.suggested_project_id || prev.project_id,
        tags: result.suggested_tags?.length > 0
          ? result.suggested_tags.join(', ')
          : prev.tags,
      }))

      setSuccessMessage('AI 정리 완료')
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'AI 정리 중 오류가 발생했습니다.'
      console.error('AI enhance error:', err)
      setError(errorMessage)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Create a timeout promise that rejects after 10 seconds
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('작업 시간 초과 (10초)')), 10000)
    )

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
        date: formData.start_date,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
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
        const updateResult = await Promise.race([
          supabase.from('tasks').update(taskData).eq('id', task.id),
          timeoutPromise,
        ]) as any

        if (updateResult?.error) {
          console.error('Task update error:', updateResult.error)
          setError('업무 수정 중 오류가 발생했습니다.')
          setLoading(false)
          return
        }
      } else {
        // Create new task
        const insertResult = await Promise.race([
          supabase
            .from('tasks')
            .insert({
              ...taskData,
              user_id: userId,
              source: 'manual',
            })
            .select('id')
            .single(),
          timeoutPromise,
        ]) as any

        if (insertResult?.error) {
          console.error('Task insert error:', insertResult.error)
          setError('업무 생성 중 오류가 발생했습니다.')
          setLoading(false)
          return
        }

        const newTask = insertResult?.data

        // Create shared_tasks entries for assigned users
        if (selectedProfiles.size > 0 && newTask) {
          const sharedTasksData = Array.from(selectedProfiles).map(profileId => ({
            task_id: newTask.id,
            shared_with: profileId,
            shared_by: userId,
          }))

          const sharedResult = await Promise.race([
            supabase.from('shared_tasks').insert(sharedTasksData),
            timeoutPromise,
          ]) as any

          if (sharedResult?.error) {
            console.error('Shared tasks insert error:', sharedResult.error)
            // Don't fail the whole operation if shared_tasks fails
          }

          // NOTE: Notification creation removed due to RLS policy constraints.
          // When inserting notifications for OTHER users (not auth.uid()),
          // the RLS policy fails. This should be handled server-side via
          // a trigger or API endpoint instead.
        }
      }

      onSave()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '오류가 발생했습니다.'
      console.error('TaskFormModal submission error:', err)
      setError(errorMessage)
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
        console.error('Task delete error:', error)
        setError('업무 삭제 중 오류가 발생했습니다.')
        setLoading(false)
        return
      }

      onSave()
    } catch (err) {
      console.error('TaskFormModal delete error:', err)
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

          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
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

          {/* Date Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                시작일자 *
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                종료 예상일자
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                상세 내용
              </label>
              <button
                type="button"
                onClick={handleAiEnhance}
                disabled={aiLoading || !formData.title.trim() || formData.content.length < 5}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white disabled:from-gray-400 disabled:to-gray-500 transition-all"
              >
                {aiLoading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                AI 정리
              </button>
            </div>
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
