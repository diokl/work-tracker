'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ApprovalRequest, Profile } from '@/lib/types'

const supabase = createClient()
import { Shield, Check, X, Loader, Key, Search, Save } from 'lucide-react'

type TabType = 'pending' | 'members' | 'apikeys' | 'stats'

interface ApprovalStats {
  totalUsers: number
  totalTasks: number
  todayActiveTasks: number
}

interface ApiKeyInfo {
  name: string
  label: string
  has_key: boolean
  masked: string | null
  source: 'env' | 'db'
}

export default function AdminView() {
  const [activeTab, setActiveTab] = useState<TabType>('pending')

  const tabs: { key: TabType; label: string }[] = [
    { key: 'pending', label: '승인 관리' },
    { key: 'members', label: '팀원 관리' },
    { key: 'apikeys', label: 'API 키 관리' },
    { key: 'stats', label: '시스템 현황' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Shield className="w-8 h-8 text-gray-900 dark:text-white" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">관리자 대시보드</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">사용자, API 키 및 시스템을 관리하세요</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-6">
          {activeTab === 'pending' && <PendingApprovalsTab />}
          {activeTab === 'members' && <MembersTab />}
          {activeTab === 'apikeys' && <ApiKeysTab />}
          {activeTab === 'stats' && <SystemStatsTab />}
        </div>
      </div>
    </div>
  )
}

// ============== 승인 관리 ==============
function PendingApprovalsTab() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  useEffect(() => { fetchPendingApprovals() }, [])

  const fetchPendingApprovals = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      setApprovals(data || [])
    } catch (error) {
      console.error('fetchPendingApprovals error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (approval: ApprovalRequest) => {
    setActionLoading(prev => ({ ...prev, [approval.id]: true }))
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('approval_requests').update({
        status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      }).eq('id', approval.id)
      await supabase.from('profiles').update({ is_approved: true }).eq('id', approval.user_id)
      fetchPendingApprovals()
    } finally {
      setActionLoading(prev => ({ ...prev, [approval.id]: false }))
    }
  }

  const handleReject = async (approval: ApprovalRequest) => {
    if (!confirm('이 신청을 거부하시겠습니까?')) return
    setActionLoading(prev => ({ ...prev, [approval.id]: true }))
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('approval_requests').update({
        status: 'rejected', reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      }).eq('id', approval.id)
      fetchPendingApprovals()
    } finally {
      setActionLoading(prev => ({ ...prev, [approval.id]: false }))
    }
  }

  if (loading) return <LoadingSpinner />

  if (approvals.length === 0) {
    return <div className="text-center py-12"><p className="text-gray-600 dark:text-gray-400">승인 대기 중인 신청이 없습니다.</p></div>
  }

  return (
    <div className="space-y-4">
      {approvals.map(approval => (
        <div key={approval.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">{approval.name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{approval.email}</p>
            {approval.department && <p className="text-xs text-gray-500 mt-1">부서: {approval.department}</p>}
            <p className="text-xs text-gray-500 mt-1">신청일: {new Date(approval.created_at).toLocaleDateString('ko-KR')}</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button onClick={() => handleApprove(approval)} disabled={actionLoading[approval.id]}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {actionLoading[approval.id] && <Loader className="w-4 h-4 animate-spin" />}
              <Check className="w-4 h-4" /><span>승인</span>
            </button>
            <button onClick={() => handleReject(approval)} disabled={actionLoading[approval.id]}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {actionLoading[approval.id] && <Loader className="w-4 h-4 animate-spin" />}
              <X className="w-4 h-4" /><span>거부</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============== 팀원 관리 (모든 가입자) ==============
function MembersTab() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  useEffect(() => { fetchAllUsers() }, [])

  const fetchAllUsers = async () => {
    setLoading(true)
    try {
      // 모든 프로필 가져오기 (승인/미승인 모두)
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('name')
      setUsers(data || [])
    } catch (error) {
      console.error('fetchAllUsers error:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleRole = async (user: Profile) => {
    setActionLoading(prev => ({ ...prev, [user.id]: true }))
    try {
      const newRole = user.role === 'admin' ? 'member' : 'admin'
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
      if (!error) fetchAllUsers()
    } finally {
      setActionLoading(prev => ({ ...prev, [user.id]: false }))
    }
  }

  const toggleApproval = async (user: Profile) => {
    setActionLoading(prev => ({ ...prev, [user.id]: true }))
    try {
      const { error } = await supabase.from('profiles').update({ is_approved: !user.is_approved }).eq('id', user.id)
      if (!error) fetchAllUsers()
    } finally {
      setActionLoading(prev => ({ ...prev, [user.id]: false }))
    }
  }

  const filtered = users.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase()) ||
    u.position?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 부서, 직급으로 검색..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-500"
        />
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">전체 {filtered.length}명 (승인 {filtered.filter(u => u.is_approved).length}명 / 미승인 {filtered.filter(u => !u.is_approved).length}명)</p>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">가입된 사용자가 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white">이름</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white">부서/팀</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white">직급</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white">상태</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white">역할</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white">가입일</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 dark:text-white">작업</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: user.avatar_color || '#818CF8' }}>
                        {user.name?.[0] || '?'}
                      </div>
                      <span className="text-gray-900 dark:text-white font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-gray-600 dark:text-gray-400 text-xs">
                    {user.department || '-'}{user.part ? ` / ${user.part}` : ''}
                  </td>
                  <td className="py-3 px-3 text-gray-600 dark:text-gray-400 text-xs">{user.position || '-'}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      user.is_approved
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    }`}>
                      {user.is_approved ? '승인됨' : '대기'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      user.role === 'admin'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {user.role === 'admin' ? '관리자' : '멤버'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-500 text-xs">
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleRole(user)} disabled={actionLoading[user.id]}
                        className="text-xs font-medium px-2 py-1 rounded bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors">
                        {actionLoading[user.id] ? '...' : user.role === 'admin' ? '→멤버' : '→관리자'}
                      </button>
                      {!user.is_approved && (
                        <button onClick={() => toggleApproval(user)} disabled={actionLoading[user.id]}
                          className="text-xs font-medium px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 disabled:opacity-50 transition-colors">
                          승인
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============== API 키 관리 ==============
function ApiKeysTab() {
  const [envKeys, setEnvKeys] = useState<ApiKeyInfo[]>([])
  const [dbKeys, setDbKeys] = useState<{ key: string; masked: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [showInput, setShowInput] = useState<string | null>(null)
  const [newKeyValue, setNewKeyValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { fetchKeys() }, [])

  const fetchKeys = async () => {
    setLoading(true)
    try {
      // 환경변수 키 확인 (서버 API)
      const envRes = await fetch('/api/settings/api-keys')
      const envJson = await envRes.json()
      setEnvKeys(envJson.keys || [])

      // DB 저장된 키 확인
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('settings')
          .select('key, value')
          .eq('user_id', user.id)
          .like('key', '%API_KEY%')
        if (data) {
          setDbKeys(data.map(d => ({
            key: d.key,
            masked: d.value.slice(0, 7) + '...' + d.value.slice(-4),
          })))
        }
      }
    } catch (error) {
      console.error('fetchKeys error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveKey = async (keyName: string) => {
    if (!newKeyValue.trim()) return
    setSaving(true)
    setMessage('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('settings').upsert({
        user_id: user.id,
        key: keyName,
        value: newKeyValue.trim(),
      })

      if (error) {
        setMessage('저장 실패: ' + error.message)
      } else {
        setMessage(`${keyName} 저장 완료`)
        setShowInput(null)
        setNewKeyValue('')
        fetchKeys()
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (err) {
      setMessage('오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.includes('실패') || message.includes('오류') ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-green-50 dark:bg-green-900/20 text-green-600'}`}>
          {message}
        </div>
      )}

      {/* 환경변수 키 (Vercel) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Key className="w-4 h-4" />
          환경변수 (Vercel)
        </h3>
        <div className="space-y-2">
          {envKeys.map(k => (
            <div key={k.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{k.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{k.name}</p>
              </div>
              <div className="flex items-center gap-2">
                {k.has_key ? (
                  <>
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-semibold">설정됨</span>
                    <code className="text-xs font-mono bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-gray-800 dark:text-gray-200">{k.masked}</code>
                  </>
                ) : (
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded text-xs font-semibold">미설정</span>
                )}
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400">환경변수는 Vercel 대시보드에서 변경합니다.</p>
        </div>
      </div>

      {/* DB 저장 키 (사용자 오버라이드) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Save className="w-4 h-4" />
          사용자 설정 키 (DB 저장)
        </h3>
        <p className="text-xs text-gray-400 mb-3">환경변수를 오버라이드하거나 추가 키를 설정할 수 있습니다.</p>

        {dbKeys.length > 0 && (
          <div className="space-y-2 mb-3">
            {dbKeys.map(k => (
              <div key={k.key} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{k.key}</p>
                  <code className="text-xs font-mono text-gray-600 dark:text-gray-400">{k.masked}</code>
                </div>
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-semibold">DB 저장</span>
              </div>
            ))}
          </div>
        )}

        {showInput ? (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{showInput} 입력</p>
            <input
              type="password"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            />
            <div className="flex gap-2">
              <button onClick={() => handleSaveKey(showInput)} disabled={saving || !newKeyValue.trim()}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                {saving && <Loader className="w-4 h-4 animate-spin" />} 저장
              </button>
              <button onClick={() => { setShowInput(null); setNewKeyValue('') }}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium">
                취소
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowInput('ANTHROPIC_API_KEY')}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors">
            + API 키 추가/변경
          </button>
        )}
      </div>
    </div>
  )
}

// ============== 시스템 현황 ==============
function SystemStatsTab() {
  const [stats, setStats] = useState<ApprovalStats>({ totalUsers: 0, totalTasks: 0, todayActiveTasks: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
      const { count: taskCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true })
      const today = new Date().toISOString().split('T')[0]
      const { count: todayCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('date', today).neq('status', 'completed')
      setStats({ totalUsers: userCount || 0, totalTasks: taskCount || 0, todayActiveTasks: todayCount || 0 })
    } catch (err) {
      console.error('fetchStats error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <LoadingSpinner />

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
        <p className="text-sm text-orange-700 dark:text-orange-300 font-medium mb-2">오늘 진행 중</p>
        <p className="text-4xl font-bold text-orange-900 dark:text-orange-100">{stats.todayActiveTasks}</p>
      </div>
    </div>
  )
}

// ============== 공통 ==============
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
        <p className="text-gray-600 dark:text-gray-400">로딩중...</p>
      </div>
    </div>
  )
}
