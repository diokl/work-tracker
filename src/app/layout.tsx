import type { Metadata } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/Toast'

export const metadata: Metadata = {
  title: 'WorkLog - 업무내용 추적 시스템',
  description: '삼양식품 업무내용 추적 및 관리 시스템',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans bg-[var(--bg)] text-[var(--text)] transition-colors">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
