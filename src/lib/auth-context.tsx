'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import type { User, SupabaseClient } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  supabase: SupabaseClient
}

const supabase = createClient()

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  supabase,
})

export function AuthProvider({ children }: { children: ReactNode }) {
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

    // 2. Listen for auth changes
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
      if (mounted) {
        setLoading(false)
      }
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading, supabase }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
