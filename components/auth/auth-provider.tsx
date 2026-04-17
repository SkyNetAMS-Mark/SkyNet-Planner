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

  // Function to refresh the session
  const refreshSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()
      if (error) {
        console.error('Session refresh error:', error)
        // If refresh fails and we're on a protected route, redirect to login
        if (PROTECTED_ROUTES.some(route => pathname?.startsWith(route))) {
          router.push('/login')
        }
      } else if (session) {
        setUser(session.user)
      }
    } catch (error) {
      console.error('Unexpected error refreshing session:', error)
    }
  }, [supabase.auth, pathname, router])

  useEffect(() => {
    // Get initial session
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

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth state changed:', event)

        switch (event) {
          case 'SIGNED_IN':
            setUser(session?.user ?? null)
            break

          case 'SIGNED_OUT':
            setUser(null)
            // Only redirect if we're on a protected route
            if (PROTECTED_ROUTES.some(route => pathname?.startsWith(route))) {
              router.push('/login')
            }
            break

          case 'TOKEN_REFRESHED':
            // Token was refreshed successfully - update user state
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
            // For any other events, update user state
            setUser(session?.user ?? null)
        }
      }
    )

    // Set up periodic session refresh (every 4 minutes)
    // Access tokens typically expire in 1 hour, but refreshing early prevents edge cases
    const refreshInterval = setInterval(() => {
      refreshSession()
    }, 4 * 60 * 1000) // 4 minutes

    // Also refresh when the window regains focus (user returns to tab)
    const handleFocus = () => {
      refreshSession()
    }
    window.addEventListener('focus', handleFocus)

    // Cleanup
    return () => {
      subscription.unsubscribe()
      clearInterval(refreshInterval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [supabase.auth, pathname, router, refreshSession])

  return (
    <AuthContext.Provider value={{ user, loading, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}
