'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  loading: boolean
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshSession: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/drivers',
  '/regions',
  '/postal-codes',
  '/schedules',
  '/parcels',
  '/routes',
  '/settings',
]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const refreshSession = useCallback(async () => {
    if (!supabase) return
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()
      if (error) {
        console.error('Session refresh error:', error)
        if (PROTECTED_ROUTES.some(route => pathname?.startsWith(route))) {
          router.push('/login')
        }
      } else if (session) {
        setUser(session.user)
      }
    } catch (error) {
      console.error('Unexpected error refreshing session:', error)
    }
  }, [supabase, pathname, router])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth state changed:', event)

        switch (event) {
          case 'SIGNED_IN':
            setUser(session?.user ?? null)
            break

          case 'SIGNED_OUT':
            setUser(null)
            if (PROTECTED_ROUTES.some(route => pathname?.startsWith(route))) {
              router.push('/login')
            }
            break

          case 'TOKEN_REFRESHED':
            setUser(session?.user ?? null)
            break

          case 'USER_UPDATED':
            setUser(session?.user ?? null)
            break

          case 'INITIAL_SESSION':
            setUser(session?.user ?? null)
            setLoading(false)
            break

          default:
            setUser(session?.user ?? null)
        }
      }
    )

    const refreshInterval = setInterval(() => {
      refreshSession()
    }, 4 * 60 * 1000)

    const handleFocus = () => {
      refreshSession()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      subscription.unsubscribe()
      clearInterval(refreshInterval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [supabase, pathname, router, refreshSession])

  return (
    <AuthContext.Provider value={{ user, loading, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}
