import { createClient } from '@/lib/supabase/server'
import PersonalView from '@/components/PersonalView'
import { redirect } from 'next/navigation'

export default async function PersonalPage() {
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

  return <PersonalView userId={user.id} />
}
