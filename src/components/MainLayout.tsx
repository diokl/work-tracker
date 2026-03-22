'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Columns3,
  FolderKanban,
  Lock,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks'
import ThemeToggle from './ThemeToggle'

const navItems = [
  { label: '대시보드', icon: LayoutDashboard, href: '/dashboard' },
  { label: '달력', icon: Calendar, href: '/calendar' },
  { label: '칸반보드', icon: Columns3, href: '/kanban' },
  { label: '프로젝트', icon: FolderKanban, href: '/projects' },
  { label: '개인', icon: Lock, href: '/personal' },
  { label: '설정', icon: Settings, href: '/settings' },
]

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg)]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-[var(--text-secondary)]">로딩중...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = profile?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U'

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-white dark:bg-gray-900 border-r border-[var(--border)] flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
              W
            </div>
            <span className="font-bold text-lg hidden sm:inline">WorkLog</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 transition-colors group"
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={20} className="group-hover:text-primary-600" />
                <span className="hidden sm:inline text-sm font-medium">
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* Admin section - conditional */}
          {profile?.role === 'admin' && (
            <>
              <div className="pt-2 mt-2 border-t border-[var(--border)]" />
              <Link
                href="/admin"
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-accent-600 transition-colors group"
                onClick={() => setSidebarOpen(false)}
              >
                <Shield size={20} className="group-hover:text-accent-600" />
                <span className="hidden sm:inline text-sm font-medium">관리자</span>
              </Link>
            </>
          )}
        </nav>

        {/* User Profile Section */}
        <div className="border-t border-[var(--border)] p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm flex-shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-medium text-[var(--text)] truncate">
                {profile?.name}
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {profile?.position || profile?.part}
              </p>
            </div>
          </div>

          {/* Theme Toggle and Logout */}
          <div className="flex items-center justify-between gap-2">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex-1 px-3 py-2 rounded-lg bg-accent-50 dark:bg-accent-950 text-accent-600 dark:text-accent-400 hover:bg-accent-100 dark:hover:bg-accent-900 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-[var(--border)] px-4 py-3 flex items-center justify-between lg:justify-end">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <div className="hidden lg:block text-sm text-[var(--text-secondary)]">
            {new Date().toLocaleDateString('ko-KR', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
