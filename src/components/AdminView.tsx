'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ApprovalRequest, Profile } from '@/lib/types'

const supabase = createClient()
import { Shield, Check, X, Loader } from 'lucide-react'

type TabType = 'pending' | 'users' | 'stats'

interface ApprovalStats {
  totalUsers: number
  totalTasks: number
  todayActiveTasks: number
}

export default function AdminView() {
  const [activeTab, setActiveTab] = useState<TabType>('pending')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-gray-900 dark:text-white" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">관리자 대시보드</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">사용자 및 시스템을 관리하세요</p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            승인 대기
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            전체 사용자
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'stats'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            시스템 현황
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'pending' && <PendingApprovalsTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'stats' && <SystemStatsTab />}
        </div>
      </div>
    </div>
  )
}

function PendingApprovalsTab() {

  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchPendingApprovals()
  }, [])

  const fetchPendingApprovals = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    setApprovals(data || [])
    setLoading(false)
  }

  const handleApprove = async (approval: ApprovalRequest) => {
    setActionLoading(prev => ({ ...prev, [approval.id]: true }))
    try {
      const { data: { user } } = await supabase.auth.getUser()
      // Update approval status
      const { error: approvalError } = await supabase
        .from('approval_requests')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', approval.id)

      // Update user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', approval.user_id)

      if (!approvalError && !profileError) {
        fetchPendingApprovals()
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [approval.id]: false }))
    }
  }

  const handleReject = async (approval: ApprovalRequest) => {
    if (!confirm('이 신청을 거부하시겠습니까?')) return
    setActionLoading(prev => ({ ...prev, [approval.id]: true }))
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('approval_requests')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', approval.id)

      if (!error) {
        fetchPendingApprovals()
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [approval.id]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400">로딩중...</p>
        </div>
      </div>
    )
  }

  if (approvals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">승인 대기 중인 신청이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {approvals.map(approval => (
        <div
          key={approval.id}
          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
        >
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">{approval.name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{approval.email}</p>
            {approval.department && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">부서: {approval.department}</p>
            )}
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              신청일: {new Date(approval.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => handleApprove(approval)}
              disabled={actionLoading[approval.id]}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {actionLoading[approval.id] && <Loader className="w-4 h-4 animate-spin" />}
              <Check className="w-4 h-4" />
              <span>승인</span>
            </button>
            <button
              onClick={() => handleReject(approval)}
              disabled={actionLoading[approval.id]}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {actionLoading[approval.id] && <Loader className="w-4 h-4 animate-spin" />}
              <X className="w-4 h-4" />
              <span>거부</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function UsersTab() {

  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  const toggleRole = async (user: Profile) => {
    setActionLoading(prev => ({ ...prev, [user.id]: true }))
    try {
      const newRole = user.role === 'admin' ? 'member' : 'admin'
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user.id)

      if (!error) {
        fetchUsers()
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [user.id]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400">로딩중...</p>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">승인된 사용자가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">이름</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">이메일</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">부서</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">직급</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">역할</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">가입일</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">작업</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr
              key={user.id}
              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <td className="py-3 px-4 text-gray-900 dark:text-white">{user.name}</td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{user.id}</td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{user.department || '-'}</td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{user.position || '-'}</td>
              <td className="py-3 px-4">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    user.role === 'admin'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {user.role === 'admin' ? '관리자' : '멤버'}
                </span>
              </td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs">
                {new Date(user.created_at).toLocaleDateString('ko-KR')}
              </td>
              <td className="py-3 px-4">
                <button
                  onClick={() => toggleRole(user)}
                  disabled={actionLoading[user.id]}
                  className={`text-sm font-medium px-3 py-1 rounded transition-colors disabled:opacity-50 ${
                    user.role === 'admin'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                  }`}
                >
                  {actionLoading[user.id] ? (
                    <Loader className="w-4 h-4 animate-spin inline" />
                  ) : user.role === 'admin' ? (
                    '멤버로 변경'
                  ) : (
                    '관리자 설정'
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SystemStatsTab() {

  const [stats, setStats] = useState<ApprovalStats>({
    totalUsers: 0,
    totalTasks: 0,
    todayActiveTasks: 0,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      // Get total users
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_approved', true)

      // Get total tasks
      const { count: taskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })

      // Get today's active tasks
      const today = new Date().toISOString().split('T')[0]
      const { count: todayCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .neq('status', 'completed')

      setStats({
        totalUsers: userCount || 0,
        totalTasks: taskCount || 0,
        todayActiveTasks: todayCount || 0,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400">로딩중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">전체 사용자</p>
        <p className="text-4xl font-bold text-blue-900 dark:text-blue-100">{stats.totalUsers}</p>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
        <p className="text-sm text-green-700 dark:text-green-300 font-medium mb-2">전체 업무</p>
        <p className="text-4xl font-bold text-green-900 dark:text-green-100">{stats.totalTasks}</p>
      </div>

      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-6 border border-orange-200 dark:border-orange-800">
        <p className="text-sm text-orange-700 dark:text-orange-300 font-medium mb-2">오늘의 진행 중인 업무</p>
        <p className="text-4xl font-bold text-orange-900 dark:text-orange-100">{stats.todayActiveTasks}</p>
      </div>
    </div>
  )
}
