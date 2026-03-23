'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, Project, DaySummary } from '@/lib/types'

// Re-export useAuth from context so all existing imports keep working
export { useAuth } from '@/lib/auth-context'

// Use the module-level singleton (same instance as AuthProvider)
const supabase = createClient()

export function useTasks(userId: string | undefined, date?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

  const fetchTasks = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      let query = supabase.from('tasks').select('*, project:projects(id, name)').eq('user_id', userId)
      if (date) query = query.eq('date', date)
      query = query.order('created_at', { ascending: false })
      const { data } = await query
      setTasks(data || [])
    } catch (e) {
      console.error('fetchTasks error:', e)
    } finally {
      setLoading(false)
    }
  }, [userId, date])

  useEffect(() => { fetchTasks() }, [fetchTasks])
  return { tasks, loading, refetch: fetchTasks }
}

export function useMonthSummary(userId: string | undefined, year: number, month: number) {
  const [summaries, setSummaries] = useState<DaySummary[]>([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const fetchSummaries = async () => {
      try {
        const { data } = await supabase
          .from('tasks')
          .select('date, start_date, end_date, status')
          .eq('user_id', userId)
          .gte('date', startDate)
          .lt('date', endDate)

        if (cancelled || !data) return
        const map = new Map<string, DaySummary>()

        data.forEach((task: any) => {
          const dates = new Set<string>()

          if (task.start_date && task.end_date) {
            const current = new Date(task.start_date)
            const end = new Date(task.end_date)
            while (current <= end) {
              const dateStr = current.toISOString().split('T')[0]!
              dates.add(dateStr)
              current.setDate(current.getDate() + 1)
            }
          } else {
            dates.add(task.date)
          }

          dates.forEach(dateStr => {
            const existing = map.get(dateStr) || { date: dateStr, total: 0, completed: 0, in_progress: 0, waiting_next: 0, pending: 0 }
            existing.total++
            if (task.status === 'completed') existing.completed++
            else if (task.status === 'in_progress') existing.in_progress++
            else if (task.status === 'waiting_next') existing.waiting_next++
            else existing.pending++
            map.set(dateStr, existing)
          })
        })
        setSummaries(Array.from(map.values()))
      } catch (e) {
        console.error('useMonthSummary error:', e)
      }
    }

    fetchSummaries()

    return () => { cancelled = true }
  }, [userId, year, month])

  return summaries
}

export function useProjects(userId: string | undefined) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)

  const fetchProjects = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const { data } = await supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      setProjects(data || [])
    } catch (e) {
      console.error('fetchProjects error:', e)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  return { projects, loading, refetch: fetchProjects }
}
