'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks'
import { Users, Search } from 'lucide-react'
import type { Profile } from '@/lib/types'

export default function MembersView() {
  const { supabase, loading: authLoading } = useAuth()
  const [members, setMembers] = useState<Profile[]>([])
  const [filteredMembers, setFilteredMembers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchMembers = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('is_approved', true)
          .order('name')

        if (!error && data) {
          setMembers(data)
          setFilteredMembers(data)
        }
      } catch (err) {
        console.error('Failed to fetch members:', err)
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) {
      fetchMembers()
    }
  }, [authLoading, supabase])

  useEffect(() => {
    const filtered = members.filter(member =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    setFilteredMembers(filtered)
  }, [searchQuery, members])

  const getAvatarColor = (color: string | null) => {
    return color || '#FF6B6B'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
  }

  const getRoleBadge = (role: string | null) => {
    if (role === 'admin') {
      return {
        label: '관리자',
        bg: 'bg-accent-100 dark:bg-accent-900/30',
        text: 'text-accent-700 dark:text-accent-300'
      }
    }
    return {
      label: '멤버',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400">로딩중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Users className="w-8 h-8 text-gray-900 dark:text-white" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">팀원</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">전체 팀 멤버를 확인하세요</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="팀원 이름으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Members Grid */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery ? '검색 결과가 없습니다' : '팀원이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => {
            const badgeInfo = getRoleBadge(member.role)
            const avatarColor = getAvatarColor(member.avatar_color)

            return (
              <div
                key={member.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-lg dark:hover:shadow-gray-900/30 transition-shadow"
              >
                {/* Avatar */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {getInitials(member.name)}
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${badgeInfo.bg} ${badgeInfo.text}`}
                  >
                    {badgeInfo.label}
                  </span>
                </div>

                {/* Info */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {member.name}
                    </h3>
                    {member.position && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                        {member.position}
                      </p>
                    )}
                  </div>

                  {/* Department and Part */}
                  <div className="space-y-1">
                    {member.department && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium">부서:</span> {member.department}
                      </p>
                    )}
                    {member.part && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="font-medium">팀:</span> {member.part}
                      </p>
                    )}
                  </div>

                  {/* Joined Date */}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      가입일: {formatDate(member.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Count */}
      <div className="text-sm text-gray-600 dark:text-gray-400 text-center pt-4">
        총 {filteredMembers.length}명의 팀원
      </div>
    </div>
  )
}
