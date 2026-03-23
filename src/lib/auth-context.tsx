'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import type { User, SupabaseClient } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  supabase: SupabaseClient
}

// Module-level singleton — the ONLY browser Supabase client in the app
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
  const mountedRef = useRef(true)
  // Track whether initial session has been resolved to avoid double-processing
  const initializedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    initializedRef.current = false

    const fetchProfile = async (userId: string) => {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
        if (mountedRef.current) setProfile(data)
      } catch (e) {
        console.warn('Failed to fetch profile:', e)
      }
    }

    // 1. Get current session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return
      initializedRef.current = true
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        fetchProfile(currentUser.id).finally(() => {
          if (mountedRef.current) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    }).catch(() => {
      if (mountedRef.current) {
        initializedRef.current = true
        setLoading(false)
      }
    })

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return

      // Skip INITIAL_SESSION if we already handled it via getSession
      if (event === 'INITIAL_SESSION') {
        if (!initializedRef.current) {
          initializedRef.current = true
          const currentUser = session?.user ?? null
          setUser(currentUser)
          if (currentUser) {
            await fetchProfile(currentUser.id)
          }
          if (mountedRef.current) setLoading(false)
        }
        return
      }

      if (event === 'SIGNED_IN') {
        const newUser = session?.user ?? null
        setUser(newUser)
        if (newUser) await fetchProfile(newUser.id)
        if (mountedRef.current) setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        if (mountedRef.current) setLoading(false)
      } else if (event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null)
      }
    })

    // 3. Safety timeout — never stay loading forever
    const timeout = setTimeout(() => {
      if (mountedRef.current) {
        setLoading(false)
      }
    }, 5000)

    return () => {
      mountedRef.current = false
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
