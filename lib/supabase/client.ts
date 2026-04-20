import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

// Singleton pattern to prevent multiple client instances
// which can cause token refresh conflicts and random logouts
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (browserClient) {
    return browserClient
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  browserClient = createBrowserClient<Database>(
    url,
    key,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    }
  )

  return browserClient
}