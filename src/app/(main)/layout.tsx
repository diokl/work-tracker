import type { ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth-context'
import MainLayoutComponent from '@/components/MainLayout'

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <MainLayoutComponent>{children}</MainLayoutComponent>
    </AuthProvider>
  )
}
