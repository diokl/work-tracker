import type { ReactNode } from 'react'
import MainLayoutComponent from '@/components/MainLayout'

export default function MainLayout({ children }: { children: ReactNode }) {
  return <MainLayoutComponent>{children}</MainLayoutComponent>
}
