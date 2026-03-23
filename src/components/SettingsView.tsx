'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks'
import { useRouter } from 'next/navigation'
import { Settings, Save, LogOut, Loader, Moon, Sun, Key } from 'lucide-react'

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#A9DFBF'
]

export default function SettingsView() {
  const { user, profile, loading: authLoading, supabase } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null)
  const [apiKeySource, setApiKeySource] = useState<'user' | 'env' | null>(null)
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')
  const [savingApiKey, setSavingApiKey] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    position: '',
    department: '',
    part: '',
    avatar_color: '#FF6B6B',
  })

  const maskApiKey = (key: string): string => {
    if (key.startsWith('env:')) {
      return key
    }
    return key.slice(0, 7) + '...' + key.slice(-4)
  }

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        position: profile.position || '',
        department: profile.department || '',
        part: profile.part || '',
        avatar_color: profile.avatar_color || '#FF6B6B',
      })
    }

    // Get theme preference
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'dark' : 'light')
    }
  }, [profile])

  // Fetch API key if user is admin
  useEffect(() => {
    const fetchApiKey = async () => {
      if (profile?.role === 'admin' && user) {
        try {
          const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('user_id', user.id)
            .eq('key', 'ANTHROPIC_API_KEY')
            .single()

          if (!error && data) {
            setApiKeyMasked(maskApiKey(data.value))
            setApiKeySource('user')
          } else {
            // Check if there's an environment variable
            // We can't directly access env vars from client, but we can indicate it
            setApiKeySource(null)
            setApiKeyMasked(null)
          }
        } catch (err) {
          console.error('Failed to fetch API key:', err)
        }
      }
    }

    if (!authLoading && profile && user) {
      fetchApiKey()
    }
  }, [authLoading, profile, user, supabase])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      if (!formData.name.trim()) {
        setError('이름은 필수입니다.')
        setSaving(false)
        return
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          position: formData.position || null,
          department: formData.department || null,
          part: formData.part || null,
          avatar_color: formData.avatar_color,
        })
        .eq('id', user.id)

      if (updateError) {
        setError('설정 저장 중 오류가 발생했습니다.')
        setSaving(false)
        return
      }

      setSuccess('설정이 저장되었습니다.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleThemeToggle = () => {
    if (typeof window !== 'undefined') {
      const html = document.documentElement
      const isDark = html.classList.contains('dark')

      if (isDark) {
        html.classList.remove('dark')
        localStorage.setItem('theme', 'light')
        setTheme('light')
      } else {
        html.classList.add('dark')
        localStorage.setItem('theme', 'dark')
        setTheme('dark')
      }
    }
  }

  const handleSaveApiKey = async () => {
    if (!user || !newApiKey.trim()) {
      setError('API 키를 입력하세요.')
      return
    }

    setSavingApiKey(true)
    setError('')
    setSuccess('')

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          user_id: user.id,
          key: 'ANTHROPIC_API_KEY',
          value: newApiKey.trim(),
        })

      if (error) {
        setError('API 키 저장 중 오류가 발생했습니다.')
        setSavingApiKey(false)
        return
      }

      setApiKeyMasked(maskApiKey(newApiKey))
      setApiKeySource('user')
      setNewApiKey('')
      setShowApiKeyInput(false)
      setSuccess('API 키가 저장되었습니다.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('오류가 발생했습니다.')
      console.error(err)
    } finally {
      setSavingApiKey(false)
    }
  }

  const handleLogout = async () => {
    if (!confirm('로그아웃하시겠습니까?')) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (!error) {
        router.push('/login')
      }
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
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
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Settings className="w-8 h-8 text-gray-900 dark:text-white" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">설정</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">프로필과 환경설정을 관리하세요</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">프로필</h2>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Avatar Color Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              아바타 색상
            </label>
            <div className="flex flex-wrap gap-3">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, avatar_color: color })}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform ${
                    formData.avatar_color === color ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {formData.avatar_color === color && (
                    <span className="text-white font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              이름 *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="이름을 입력하세요"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Position Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              직급
            </label>
            <input
              type="text"
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              placeholder="예: 대리, 과장, 부장"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Department Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              부서
            </label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              placeholder="예: 개발팀, 마케팅팀"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Part Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              팀/조직
            </label>
            <input
              type="text"
              name="part"
              value={formData.part}
              onChange={handleInputChange}
              placeholder="예: A팀, B팀"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader className="w-4 h-4 animate-spin" />}
            <Save className="w-4 h-4" />
            저장
          </button>
        </form>
      </div>

      {/* Theme Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">테마</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">다크 모드</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {theme === 'dark' ? '현재 다크 모드를 사용 중입니다' : '현재 라이트 모드를 사용 중입니다'}
            </p>
          </div>

          <button
            onClick={handleThemeToggle}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4" />
                <span>라이트 모드</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4" />
                <span>다크 모드</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* AI API 키 관리는 관리자 대시보드로 이동됨 */}
      {false && profile?.role === 'admin' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Key className="w-5 h-5" />
            AI API 키 관리
          </h2>

          <div className="space-y-4">
            {/* Current Status */}
            {apiKeyMasked ? (
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    ANTHROPIC_API_KEY
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {apiKeySource === 'env' ? '환경 변수에서 로드됨' : '사용자 설정'}
                  </p>
                </div>
                <code className="text-xs font-mono bg-gray-200 dark:bg-gray-800 px-3 py-1.5 rounded text-gray-900 dark:text-gray-100">
                  {apiKeyMasked}
                </code>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  API 키가 설정되지 않았습니다.
                </p>
              </div>
            )}

            {/* Input Section */}
            {showApiKeyInput ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    새 API 키
                  </label>
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveApiKey}
                    disabled={savingApiKey || !newApiKey.trim()}
                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {savingApiKey && <Loader className="w-4 h-4 animate-spin" />}
                    <Save className="w-4 h-4" />
                    저장
                  </button>
                  <button
                    onClick={() => {
                      setShowApiKeyInput(false)
                      setNewApiKey('')
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                변경
              </button>
            )}
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-6">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-4">위험 영역</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">로그아웃</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              현재 계정에서 로그아웃합니다
            </p>
          </div>

          <button
            onClick={handleLogout}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            <LogOut className="w-4 h-4" />
            <span>로그아웃</span>
          </button>
        </div>
      </div>
    </div>
  )
}
