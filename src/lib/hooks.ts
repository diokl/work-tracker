'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Task, Project, DaySummary } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(data)
      }
      setLoading(false)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        setProfile(data)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, profile, loading, supabase }
}

export function useTasks(userId: string | undefined, date?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchTasks = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    let query = supabase.from('tasks').select('*, project:projects(id, name)').eq('user_id', userId)
    if (date) query = query.eq('date', date)
    query = query.order('created_at', { ascending: false })
    const { data } = await query
    setTasks(data || [])
    setLoading(false)
  }, [userId, date])

  useEffect(() => { fetchTasks() }, [fetchTasks])
  return { tasks, loading, refetch: fetchTasks }
}

export function useMonthSummary(userId: string | undefined, year: number, month: number) {
  const [summaries, setSummaries] = useState<DaySummary[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`

    supabase
      .from('tasks')
      .select('date, status')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lt('date', endDate)
      .then(({ data }) => {
        if (!data) return
        const map = new Map<string, DaySummary>()
        data.forEach(task => {
          const existing = map.get(task.date) || { date: task.date, total: 0, completed: 0, in_progress: 0, waiting_next: 0, pending: 0 }
          existing.total++
          if (task.status === 'completed') existing.completed++
          else if (task.status === 'in_progress') existing.in_progress++
          else if (task.status === 'waiting_next') existing.waiting_next++
          else existing.pending++
          map.set(task.date, existing)
        })
        setSummaries(Array.from(map.values()))
      })
  }, [userId, year, month])

  return summaries
}

export function useProjects(userId: string | undefined) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchProjects = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchProjects() }, [fetchProjects])
  return { projects, loading, refetch: fetchProjects }
}
