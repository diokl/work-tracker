'use client'

import { useState, useEffect } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd'
import { Plus, ChevronDown, Calendar } from 'lucide-react'
import { useAuth } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import TaskFormModal from '@/components/TaskFormModal'
import type { Task, TaskStatus, Profile } from '@/lib/types'

const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'waiting_next']

const STATUS_CONFIG = {
  pending: { label: '대기', color: '#9CA3AF', borderColor: 'border-gray-300' },
  in_progress: { label: '진행중', color: '#F59E0B', borderColor: 'border-amber-300' },
  completed: { label: '완료', color: '#3B82F6', borderColor: 'border-blue-300' },
  waiting_next: { label: '다음단계대기', color: '#EF4444', borderColor: 'border-red-300' },
}

function getDateRange(rangeType: 'month' | 'week' | 'all') {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  if (rangeType === 'month') {
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0)
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    }
  } else if (rangeType === 'week') {
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const start = new Date(year, month, diff)
    const end = new Date(year, month, diff + 6)
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    }
  }

  return { start: '', end: '' }
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function KanbanSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter Bar Skeleton */}
      <div className="flex gap-3 flex-wrap">
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>

      {/* Columns Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 min-h-96"
          >
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div
                  key={j}
                  className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskCard({
  task,
  index,
  onCardClick,
}: {
  task: Task
  index: number
  onCardClick: (task: Task) => void
}) {
  const displayTags = task.tags?.slice(0, 2) || []

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-3 cursor-grab transition-all ${
            snapshot.isDragging
              ? 'shadow-lg ring-2 ring-primary-400 opacity-100 cursor-grabbing'
              : 'shadow-sm hover:shadow-md'
          }`}
          onClick={() => onCardClick(task)}
        >
          {/* Title */}
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-2">
            {task.title}
          </h3>

          {/* Date and Project */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(task.date)}
            </span>
            {task.project && (
              <span className="inline-block text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded">
                {task.project.name}
              </span>
            )}
          </div>

          {/* Tags */}
          {displayTags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {displayTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}

function KanbanColumn({
  status,
  tasks,
  onAddTask,
  onCardClick,
}: {
  status: TaskStatus
  tasks: Task[]
  onAddTask: (status: TaskStatus) => void
  onCardClick: (task: Task) => void
}) {
  const config = STATUS_CONFIG[status]

  return (
    <Droppable droppableId={status}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 min-h-96 transition-colors ${
            snapshot.isDraggingOver
              ? 'bg-gray-100 dark:bg-gray-700/50'
              : ''
          }`}
        >
          {/* Column Header */}
          <div className={`flex items-center justify-between mb-4 pb-3 border-l-4 pl-3 ${config.borderColor}`}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {config.label}
              </h2>
              <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {tasks.length}
              </span>
            </div>
            <button
              onClick={() => onAddTask(status)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-600 dark:text-gray-400"
              title="새 업무 추가"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Tasks */}
          <div className="space-y-2">
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onCardClick={onCardClick}
              />
            ))}
          </div>

          {/* Placeholder */}
          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm">
              업무를 드래그하세요
            </div>
          )}

          {provided.placeholder}
        </div>
      )}
    </Droppable>
  )
}

export default function KanbanPage() {
  const { user } = useAuth()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'month' | 'week' | 'all'>('month')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showTaskForm, setShowTaskForm] = useState(false)

  // Fetch projects
  useEffect(() => {
    if (!user?.id) return

    const fetchProjects = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name')

      setProjects(data || [])
    }

    fetchProjects()
  }, [user?.id])

  // Fetch approved profiles for sharing
  useEffect(() => {
    if (!user?.id) return

    const fetchProfiles = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .eq('is_approved', true)
        .order('name')

      setProfiles(data || [])
    }

    fetchProfiles()
  }, [user?.id])

  // Fetch tasks
  useEffect(() => {
    if (!user?.id) return

    const fetchTasks = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const range = getDateRange(dateRange)
        let query = supabase
          .from('tasks')
          .select('*, project:projects(id, name)')
          .eq('user_id', user.id)

        if (range.start) {
          query = query
            .gte('date', range.start)
            .lte('date', range.end)
        }

        if (selectedProject !== 'all') {
          query = query.eq('project_id', selectedProject)
        }

        const { data } = await query.order('created_at', { ascending: false })
        setTasks(data || [])
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [user?.id, dateRange, selectedProject])

  // Group tasks by status
  const tasksByStatus = STATUSES.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status)
      return acc
    },
    {} as Record<TaskStatus, Task[]>
  )

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result

    if (!destination) return
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return
    }

    const newStatus = destination.droppableId as TaskStatus
    const task = tasks.find((t) => t.id === draggableId)

    if (!task || task.status === newStatus) return

    // Optimistic update
    setTasks(
      tasks.map((t) =>
        t.id === draggableId ? { ...t, status: newStatus } : t
      )
    )

    // Update in Supabase
    const supabase = createClient()
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', draggableId)

    if (error) {
      // Revert on error
      setTasks(tasks)
      console.error('Failed to update task status:', error)
    }
  }

  const handleAddTask = (_status: TaskStatus) => {
    setSelectedTask(null)
    setShowTaskForm(true)
  }

  const handleCardClick = (task: Task) => {
    setSelectedTask(task)
    setShowTaskForm(true)
  }

  const handleFormClose = () => {
    setShowTaskForm(false)
    setSelectedTask(null)
  }

  const handleTaskSave = async () => {
    // Refetch tasks after save
    if (user?.id) {
      const supabase = createClient()
      const range = getDateRange(dateRange)
      let query = supabase
        .from('tasks')
        .select('*, project:projects(id, name)')
        .eq('user_id', user.id)

      if (range.start) {
        query = query
          .gte('date', range.start)
          .lte('date', range.end)
      }

      if (selectedProject !== 'all') {
        query = query.eq('project_id', selectedProject)
      }

      const { data } = await query.order('created_at', { ascending: false })
      setTasks(data || [])
    }
    handleFormClose()
  }

  if (loading) {
    return <KanbanSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          업무보드
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          업무의 진행 상황을 한눈에 확인하세요
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-3 flex-wrap items-center">
        {/* Date Range Filter */}
        <div className="flex gap-2 items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
          <Calendar size={16} className="ml-3 text-gray-500" />
          {(['month', 'week', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                dateRange === range
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {range === 'month' ? '이번달' : range === 'week' ? '이번주' : '전체'}
            </button>
          ))}
        </div>

        {/* Project Filter */}
        <div className="relative">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 pr-8 text-sm text-gray-900 dark:text-gray-100 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            <option value="all">모든 프로젝트</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500"
          />
        </div>

        {/* Task Count */}
        <div className="text-sm text-gray-600 dark:text-gray-400 ml-auto">
          총 {tasks.length}개
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onAddTask={handleAddTask}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Task Form Modal */}
      {showTaskForm && user && (
        <TaskFormModal
          task={selectedTask}
          selectedDate={new Date().toISOString().split('T')[0] as string}
          projects={projects as any}
          profiles={profiles}
          onClose={handleFormClose}
          onSave={handleTaskSave}
          userId={user.id}
        />
      )}
    </div>
  )
}
