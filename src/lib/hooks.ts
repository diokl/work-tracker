'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Task, Project, DaySummary } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

// Module-level singleton - created once, reused everywhere
const supabase = createClient()

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const fetchProfile = async (userId: string) => {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
        if (mounted) setProfile(data)
      } catch (e) {
        console.warn('Failed to fetch profile:', e)
      }
    }

    // 1. Get current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        fetchProfile(currentUser.id).finally(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    // 2. Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null)
        if (session?.user) await fetchProfile(session.user.id)
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
      } else if (event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null)
      }
    })

    // 3. Safety timeout
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('useAuth: safety timeout fired')
        setLoading(false)
      }
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { user, profile, loading, supabase }
}

export function useTasks(userId: string | undefined, date?: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

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
