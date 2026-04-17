import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

// Singleton pattern to prevent multiple client instances
// which can cause token refresh conflicts and random logouts
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Explicitly enable auto token refresh
        autoRefreshToken: true,
        // Persist session across browser tabs/windows
        persistSession: true,
        // Detect OAuth redirects
        detectSessionInUrl: true,
        // Use PKCE flow for better security
        flowType: 'pkce',
      },
    }
  )

  return browserClient
}