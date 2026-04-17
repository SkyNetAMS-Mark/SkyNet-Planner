import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/admin/sidebar'
import { Header } from '@/components/admin/header'
import { Toaster } from '@/components/ui/sonner'

// Opt out of static prerendering for all admin routes
export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get admin user details
  const { data: adminUser, error } = await supabase
    .from('admin_users')
    .select('full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  // Check if user is an active admin
  if (error || !adminUser) {
    redirect('/login')
  }

  const typedAdminUser = adminUser as { full_name: string; role: string; is_active: boolean }
  
  if (typedAdminUser.is_active === false) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={user} adminUser={typedAdminUser} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  )
}