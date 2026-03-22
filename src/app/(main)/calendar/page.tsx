'use client'

import { useState, useCallback } from 'react'
import { useAuth, useTasks, useMonthSummary, useProjects } from '@/lib/hooks'
import CalendarView from '@/components/CalendarView'
import TaskPanel from '@/components/TaskPanel'
import TaskFormModal from '@/components/TaskFormModal'
import { Task, Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'

const supabase = createClient()

export default function CalendarPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)

  const summaries = useMonthSummary(user?.id, year, month)
  const { tasks, refetch: refetchTasks } = useTasks(user?.id, selectedDate || undefined)
  const { projects } = useProjects(user?.id)

  // Fetch other profiles for sharing
  useEffect(() => {
    const fetchProfiles = async () => {
      setProfilesLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id)
        .eq('is_approved', true)
        .order('name')

      setProfiles(data || [])
      setProfilesLoading(false)
    }

    if (user?.id) {
      fetchProfiles()
    }
  }, [user?.id])

  const handleMonthChange = useCallback((newYear: number, newMonth: number) => {
    setYear(newYear)
    setMonth(newMonth)
  }, [])

  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date)
  }, [])

  const handleAddTask = useCallback(() => {
    setEditingTask(null)
    setShowForm(true)
  }, [])

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task)
    setShowForm(true)
  }, [])

  const handleFormClose = () => {
    setShowForm(false)
    setEditingTask(null)
  }

  const handleFormSave = () => {
    handleFormClose()
    refetchTasks()
  }

  const handlePanelClose = () => {
    setSelectedDate(null)
  }

  if (authLoading || profilesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-300 dark:border-gray-700 border-t-red-500 rounded-full animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 dark:text-gray-400">인증 오류가 발생했습니다.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            캘린더
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {profile.name}님의 업무 일정을 관리하세요.
          </p>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <CalendarView
              year={year}
              month={month}
              summaries={summaries}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              onMonthChange={handleMonthChange}
            />
          </div>

          {/* Quick Stats (Desktop Only) */}
          <div className="hidden lg:flex flex-col gap-6">
            {/* Today's Summary */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                오늘의 업무
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    완료됨
                  </span>
                  <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {tasks.filter(t => t.status === 'completed').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    진행중
                  </span>
                  <span className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                    {tasks.filter(t => t.status === 'in_progress').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    대기중
                  </span>
                  <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                    {tasks.filter(t => t.status === 'waiting_next').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    예약됨
                  </span>
                  <span className="text-lg font-semibold text-gray-600 dark:text-gray-400">
                    {tasks.filter(t => t.status === 'pending').length}
                  </span>
                </div>
              </div>
            </div>

            {/* About */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                정보
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                달력에서 날짜를 선택하여 업무를 관리하세요. 업무를 클릭하여 편집하거나 상태를 변경할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Task Panel (Mobile + Desktop) */}
      <TaskPanel
        selectedDate={selectedDate}
        tasks={tasks}
        onClose={handlePanelClose}
        onAddTask={handleAddTask}
        onEditTask={handleEditTask}
        onTasksRefresh={refetchTasks}
      />

      {/* Task Form Modal */}
      {showForm && (
        <TaskFormModal
          task={editingTask}
          selectedDate={(selectedDate || new Date().toISOString().split('T')[0]) as string}
          projects={projects}
          profiles={profiles}
          onClose={handleFormClose}
          onSave={handleFormSave}
          userId={user.id}
        />
      )}
    </div>
  )
}
