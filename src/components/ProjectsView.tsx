'use client'

import { useState, useEffect } from 'react'
import { useAuth, useProjects } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { Project, ProjectStatus } from '@/lib/types'

const supabase = createClient()
import { FolderKanban, Plus, ChevronLeft, Archive, Trash2, X, Loader } from 'lucide-react'

const STATUS_BADGE: Record<ProjectStatus, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: '진행중' },
  archived: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', label: '아카이브됨' },
}

interface ProjectDetailProps {
  project: Project
  taskCount: number
  onBack: () => void
  onRefresh: () => void
}

function ProjectDetail({ project, taskCount, onBack, onRefresh }: ProjectDetailProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [linkedTasks, setLinkedTasks] = useState<any[]>([])
  const [completedCount, setCompletedCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchLinkedTasks = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
      setLinkedTasks(data || [])
      setCompletedCount((data || []).filter(t => t.status === 'completed').length)
    }
    fetchLinkedTasks()
  }, [project.id])

  const handleArchive = async () => {
    if (!confirm('이 프로젝트를 아카이브하시겠습니까?')) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'archived' })
        .eq('id', project.id)
      if (!error) {
        onRefresh()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('이 프로젝트를 삭제하시겠습니까? 연결된 업무는 유지됩니다.')) return
    setLoading(true)
    try {
      const { error } = await supabase.from('projects').delete().eq('id', project.id)
      if (!error) {
        onBack()
        onRefresh()
      }
    } finally {
      setLoading(false)
    }
  }

  const progressPercent = taskCount > 0 ? (completedCount / taskCount) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">돌아가기</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            편집
          </button>
          <button
            onClick={handleArchive}
            disabled={loading}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Archive className="w-4 h-4" />
            아카이브
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            삭제
          </button>
        </div>
      </div>

      {/* Project Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{project.name}</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">{project.description}</p>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BADGE[project.status].bg} ${STATUS_BADGE[project.status].text}`}>
            {STATUS_BADGE[project.status].label}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            생성: {new Date(project.created_at).toLocaleDateString('ko-KR')}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">진행 상황</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">완료된 업무</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {completedCount} / {taskCount}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{Math.round(progressPercent)}% 완료</p>
        </div>
      </div>

      {/* Linked Tasks */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">연결된 업무 ({linkedTasks.length})</h2>
        {linkedTasks.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm">이 프로젝트에 연결된 업무가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {linkedTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <span className="text-sm text-gray-900 dark:text-white">{task.title}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  task.status === 'completed'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {task.status === 'completed' ? '완료' : '진행중'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEditModal && (
        <ProjectFormModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false)
            onRefresh()
          }}
        />
      )}
    </div>
  )
}

interface ProjectFormModalProps {
  project?: Project
  onClose: () => void
  onSave: () => void
}

function ProjectFormModal({ project, onClose, onSave }: ProjectFormModalProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as ProjectStatus,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
        status: project.status,
      })
    }
  }, [project])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setError('')

    try {
      if (!formData.name.trim()) {
        setError('프로젝트 이름은 필수입니다.')
        setLoading(false)
        return
      }

      const projectData = {
        name: formData.name,
        description: formData.description || null,
        status: formData.status,
      }

      if (project) {
        const { error: updateError } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', project.id)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('projects')
          .insert({
            ...projectData,
            user_id: user.id,
          })
        if (insertError) throw insertError
      }

      onSave()
    } catch (err) {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {project ? '프로젝트 편집' : '새 프로젝트'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              프로젝트 이름 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="프로젝트 이름을 입력하세요"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="프로젝트에 대한 설명을 입력하세요"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              상태
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">진행중</option>
              <option value="archived">아카이브됨</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader className="w-4 h-4 animate-spin" />}
              {project ? '수정' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ProjectsViewProps {
  userId: string
}

export default function ProjectsView({ userId }: ProjectsViewProps) {
  const { projects, loading, refetch } = useProjects(userId)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!userId) return
    const fetchTaskCounts = async () => {
      try {
        const counts: Record<string, number> = {}
        for (const project of projects) {
          const { count } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', project.id)
          counts[project.id] = count || 0
        }
        setTaskCounts(counts)
      } catch (error) {
        console.error('ProjectsView fetchTaskCounts error:', error)
      }
    }
    fetchTaskCounts()
  }, [projects, userId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400">로딩중...</p>
        </div>
      </div>
    )
  }

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        taskCount={taskCounts[selectedProject.id] || 0}
        onBack={() => setSelectedProject(null)}
        onRefresh={() => {
          refetch()
          setSelectedProject(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">프로젝트</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">프로젝트를 관리하세요</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>새 프로젝트</span>
        </button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FolderKanban className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">등록된 프로젝트가 없습니다.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            첫 프로젝트 생성하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => setSelectedProject(project)}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg dark:hover:shadow-lg/20 transition-all text-left group"
            >
              {/* Icon */}
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FolderKanban className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>

              {/* Title */}
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                {project.name}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                {project.description || '설명 없음'}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[project.status].bg} ${STATUS_BADGE[project.status].text}`}>
                  {STATUS_BADGE[project.status].label}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  업무 {taskCounts[project.id] || 0}개
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreateModal && (
        <ProjectFormModal
          onClose={() => setShowCreateModal(false)}
          onSave={() => {
            setShowCreateModal(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}
