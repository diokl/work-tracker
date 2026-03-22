'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Meeting, ActionItem } from '@/lib/types'

const supabase = createClient()
import {
  Mic,
  Square,
  Plus,
  Trash2,
  FileText,
  Clock,
  Users,
  Globe,
  Loader,
  X,
  Languages,
  Sparkles,
  Download,
} from 'lucide-react'

// ==================== STT HOOK ====================
// Restored to original working implementation (commit e4e3442).
// Only change: use isListeningRef (not isListening state) in onend
// to avoid stale closure when checking whether to auto-restart.

interface SttResult {
  transcript: string
  isFinal: boolean
}

function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const isListeningRef = useRef(false)
  const onResultRef = useRef<((result: SttResult) => void) | null>(null)
  const onErrorRef = useRef<((error: string) => void) | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      setIsSupported(!!SR)
    }
  }, [])

  const startListening = useCallback((language: string, onResult: (result: SttResult) => void, onError: (error: string) => void) => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      onError('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해주세요.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language

    onResultRef.current = onResult
    onErrorRef.current = onError

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (onResultRef.current) {
          onResultRef.current({
            transcript: result[0].transcript,
            isFinal: result.isFinal,
          })
        }
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return
      if (onErrorRef.current) {
        onErrorRef.current(`음성 인식 오류: ${event.error}`)
      }
    }

    recognition.onend = () => {
      // Auto-restart if still listening (use ref to avoid stale closure)
      if (recognitionRef.current && isListeningRef.current) {
        try {
          recognition.start()
        } catch {
          // ignore restart errors
        }
      }
    }

    recognitionRef.current = recognition
    isListeningRef.current = true
    recognition.start()
    setIsListening(true)
  }, [])

  const stopListening = useCallback(() => {
    isListeningRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  return { isListening, isSupported, startListening, stopListening }
}

// ==================== RECORDING MODAL ====================

function RecordingModal({
  onClose,
  onSave,
  userId,
}: {
  onClose: () => void
  onSave: () => void
  userId: string
}) {
  const { isListening: sttActive, isSupported, startListening, stopListening } = useSpeechRecognition()

  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState('ko')
  const [participants, setParticipants] = useState('')
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [saving, setSaving] = useState(false)
  const [summarizing, setSummarizing] = useState(false)

  const startTimeRef = useRef<Date | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptRef = useRef('')

  // Sync recording state if STT stops unexpectedly (e.g., due to error)
  useEffect(() => {
    if (isRecording && !sttActive) {
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording, sttActive])

  const langOptions = [
    { value: 'ko', label: '한국어' },
    { value: 'en-US', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'zh-CN', label: '中文' },
    { value: 'hi-IN', label: 'हिन्दी' },
  ]

  const handleStartRecording = () => {
    if (!title.trim()) {
      setError('회의 제목을 입력해주세요.')
      return
    }
    setError('')
    startTimeRef.current = new Date()
    setIsRecording(true)

    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000))
      }
    }, 1000)

    startListening(
      language,
      (result) => {
        if (result.isFinal) {
          transcriptRef.current += result.transcript + ' '
          setTranscript(transcriptRef.current)
          setInterimText('')
        } else {
          setInterimText(result.transcript)
        }
      },
      (err) => setError(err)
    )
  }

  const handleStopRecording = () => {
    stopListening()
    setIsRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const handleSave = async (withSummary: boolean) => {
    if (!transcript.trim() && !transcriptRef.current.trim()) {
      setError('녹음된 내용이 없습니다.')
      return
    }

    const finalTranscript = transcriptRef.current || transcript

    if (withSummary) {
      setSummarizing(true)
    } else {
      setSaving(true)
    }

    try {
      const participantList = participants
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0)

      const meetingData: any = {
        user_id: userId,
        title: title.trim(),
        date: new Date().toISOString().split('T')[0],
        start_time: startTimeRef.current?.toISOString() || new Date().toISOString(),
        end_time: new Date().toISOString(),
        duration_seconds: elapsed,
        language,
        participants: participantList,
        raw_transcript: finalTranscript,
        status: withSummary ? 'summarizing' : 'completed',
      }

      const { data: meeting, error: insertError } = await supabase
        .from('meetings')
        .insert(meetingData)
        .select()
        .single()

      if (insertError) throw insertError

      if (withSummary && meeting) {
        // Call the summarize API
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const res = await fetch('/api/meetings/summarize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token || ''}`,
            },
            body: JSON.stringify({
              meetingId: meeting.id,
              transcript: finalTranscript,
              language,
              title: title.trim(),
              participants: participantList,
            }),
          })

          if (!res.ok) {
            // If summary fails, still save the meeting
            await supabase
              .from('meetings')
              .update({ status: 'completed' })
              .eq('id', meeting.id)
          }
        } catch {
          // If summary API fails, just mark as completed
          await supabase
            .from('meetings')
            .update({ status: 'completed' })
            .eq('id', meeting.id)
        }
      }

      onSave()
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.')
      setSaving(false)
      setSummarizing(false)
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      stopListening()
    }
  }, [stopListening])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isRecording ? '🔴 녹음 중' : '새 회의록'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Settings (before recording) */}
          {!isRecording && elapsed === 0 && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">회의 제목 *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 주간 팀 미팅"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">언어</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {langOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">참석자 (쉼표 구분)</label>
                <input
                  type="text"
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  placeholder="예: 김팀장, 이대리, 박사원"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              {!isSupported && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-700 dark:text-yellow-400">
                  이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 사용해주세요.
                </div>
              )}

              <button
                onClick={handleStartRecording}
                disabled={!isSupported}
                className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-all"
              >
                <Mic size={20} />
                녹음 시작
              </button>
            </div>
          )}

          {/* Recording Controls */}
          {(isRecording || elapsed > 0) && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                    {formatTime(elapsed)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <button
                      onClick={handleStopRecording}
                      className="flex items-center gap-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 px-4 py-2 rounded-lg font-medium"
                    >
                      <Square size={16} />
                      녹음 중지
                    </button>
                  ) : (
                    <button
                      onClick={handleStartRecording}
                      className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg font-medium"
                    >
                      <Mic size={16} />
                      다시 녹음
                    </button>
                  )}
                </div>
              </div>

              {/* Transcript Area */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  실시간 텍스트 변환
                </label>
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 min-h-[200px] max-h-[300px] overflow-y-auto">
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                    {transcript}
                    {interimText && (
                      <span className="text-gray-400 dark:text-gray-500">{interimText}</span>
                    )}
                  </p>
                  {!transcript && !interimText && isRecording && (
                    <p className="text-gray-400 dark:text-gray-500 italic">말씀해 주세요... 음성이 텍스트로 변환됩니다.</p>
                  )}
                </div>
              </div>

              {/* Manual transcript edit */}
              {!isRecording && transcript && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    텍스트 수정 (필요 시)
                  </label>
                  <textarea
                    value={transcript}
                    onChange={(e) => { setTranscript(e.target.value); transcriptRef.current = e.target.value }}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  />
                </div>
              )}

              {/* Save Buttons */}
              {!isRecording && transcript && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSave(false)}
                    disabled={saving || summarizing}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium"
                  >
                    {saving ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
                    원본 저장
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving || summarizing}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium"
                  >
                    {summarizing ? <Loader size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    AI 정리 + 저장
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== MEETING DETAIL MODAL ====================

function MeetingDetailModal({
  meeting,
  onClose,
  onUpdate,
}: {
  meeting: Meeting
  onClose: () => void
  onUpdate: () => void
}) {
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'actions'>('summary')
  const [summarizing, setSummarizing] = useState(false)
  const [error, setError] = useState('')

  const handleSummarize = async () => {
    setSummarizing(true)
    setError('')
    try {
          const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/meetings/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          meetingId: meeting.id,
          transcript: meeting.raw_transcript,
          language: meeting.language,
          title: meeting.title,
          participants: meeting.participants,
        }),
      })

      if (!res.ok) throw new Error('요약 생성에 실패했습니다.')
      onUpdate()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSummarizing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('이 회의록을 삭제하시겠습니까?')) return
    await supabase.from('meetings').delete().eq('id', meeting.id)
    onUpdate()
    onClose()
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}분 ${s}초`
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{meeting.title}</h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Clock size={14} /> {meeting.date}</span>
                <span className="flex items-center gap-1"><Clock size={14} /> {formatDuration(meeting.duration_seconds)}</span>
                {meeting.participants?.length > 0 && (
                  <span className="flex items-center gap-1"><Users size={14} /> {meeting.participants.join(', ')}</span>
                )}
                <span className="flex items-center gap-1"><Globe size={14} /> {meeting.language}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                <Trash2 size={18} />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X size={20} />
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
            {[
              { key: 'summary', label: 'AI 요약', icon: Sparkles },
              { key: 'transcript', label: '원본 텍스트', icon: FileText },
              { key: 'actions', label: '업무 배분', icon: Users },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-red-500 text-red-600 dark:text-red-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'summary' && (
            <div>
              {meeting.summary ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-2">요약</h3>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{meeting.summary}</p>
                  </div>
                  {meeting.key_points && meeting.key_points.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">주요 논의사항</h3>
                      <ul className="space-y-1">
                        {meeting.key_points.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                            <span className="text-red-500 mt-1">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {meeting.translation && Object.keys(meeting.translation).length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                        <Languages size={16} /> 번역
                      </h3>
                      {Object.entries(meeting.translation).map(([lang, text]) => (
                        <div key={lang} className="mt-2">
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">{lang}</span>
                          <p className="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">{text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Sparkles size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">아직 AI 요약이 생성되지 않았습니다.</p>
                  <button
                    onClick={handleSummarize}
                    disabled={summarizing || !meeting.raw_transcript}
                    className="flex items-center gap-2 mx-auto bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg font-medium"
                  >
                    {summarizing ? <Loader size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    AI 요약 생성하기
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 min-h-[200px]">
              {meeting.raw_transcript ? (
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{meeting.raw_transcript}</p>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic">텍스트가 없습니다.</p>
              )}
            </div>
          )}

          {activeTab === 'actions' && (
            <div>
              {meeting.action_items && meeting.action_items.length > 0 ? (
                <div className="space-y-3">
                  {meeting.action_items.map((item: ActionItem, i: number) => (
                    <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 flex items-start gap-3">
                      <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-red-600 dark:text-red-400">{i + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{item.task}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span>담당: {item.assignee}</span>
                          {item.deadline && <span>마감: {item.deadline}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {meeting.summary ? '배분된 업무가 없습니다.' : 'AI 요약을 먼저 생성해주세요.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== MEETING CARD ====================

function MeetingCard({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  const statusLabels: Record<string, string> = {
    recording: '녹음 중',
    transcribing: '변환 중',
    summarizing: '요약 중',
    completed: '완료',
    error: '오류',
  }

  const statusColors: Record<string, string> = {
    recording: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    transcribing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    summarizing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return ''
    const m = Math.floor(seconds / 60)
    return `${m}분`
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">{meeting.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[meeting.status] || ''}`}>
          {statusLabels[meeting.status] || meeting.status}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><Clock size={13} /> {meeting.date}</span>
        {meeting.duration_seconds && (
          <span>{formatDuration(meeting.duration_seconds)}</span>
        )}
        {meeting.participants?.length > 0 && (
          <span className="flex items-center gap-1"><Users size={13} /> {meeting.participants.length}명</span>
        )}
        {meeting.summary && <span className="flex items-center gap-1"><Sparkles size={13} /> 요약 있음</span>}
      </div>
      {meeting.summary && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{meeting.summary}</p>
      )}
    </button>
  )
}

// ==================== MAIN PAGE ====================

export default function MeetingsPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [showRecording, setShowRecording] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)

  const fetchMeetings = async (uid: string) => {
    try {
          const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Meetings fetch error:', error.message)
      }
      setMeetings(data || [])
    } catch (err) {
      console.warn('Failed to fetch meetings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id || null
      setUserId(uid)
      if (uid) {
        fetchMeetings(uid)
      } else {
        setLoading(false)
      }
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-300 dark:border-gray-700 border-t-red-500 rounded-full animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">회의록 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">회의록</h1>
          <p className="text-gray-600 dark:text-gray-400">
            회의를 녹음하고 AI로 정리하세요
          </p>
        </div>
        <button
          onClick={() => setShowRecording(true)}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Mic size={18} />
          새 회의록
        </button>
      </div>

      {/* Meeting List */}
      {meetings.length === 0 ? (
        <div className="text-center py-16">
          <Mic size={64} className="mx-auto text-gray-200 dark:text-gray-700 mb-6" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">아직 회의록이 없습니다</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            새 회의록 버튼을 눌러 회의를 녹음해보세요.
          </p>
          <button
            onClick={() => setShowRecording(true)}
            className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium"
          >
            <Plus size={18} />
            첫 회의록 만들기
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {meetings.map(meeting => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onClick={() => setSelectedMeeting(meeting)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showRecording && userId && (
        <RecordingModal
          onClose={() => setShowRecording(false)}
          onSave={() => { setShowRecording(false); if (userId) fetchMeetings(userId) }}
          userId={userId}
        />
      )}

      {selectedMeeting && (
        <MeetingDetailModal
          meeting={selectedMeeting}
          onClose={() => setSelectedMeeting(null)}
          onUpdate={() => { setSelectedMeeting(null); if (userId) fetchMeetings(userId) }}
        />
      )}
    </div>
  )
}
