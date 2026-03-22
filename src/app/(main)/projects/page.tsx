import { createClient } from '@/lib/supabase/server'
import ProjectsView from '@/components/ProjectsView'
import { redirect } from 'next/navigation'

export default async function ProjectsPage() {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    redirect('/login')
  }

  return <ProjectsView userId={user.id} />
}
