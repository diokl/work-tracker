'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import type { KpiDefinition, Profile } from '@/lib/types'

const supabase = createClient()
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  Upload,
  ChevronDown,
  ChevronUp,
  Users,
  User,
  X,
  Loader,
  FileText,
} from 'lucide-react'

// ==================== TEXT PARSER ====================

function parseKpiText(text: string, userId: string, evalYear: number): Partial<KpiDefinition>[] {
  const kpis: Partial<KpiDefinition>[] = []

  const blocks = text.split(/(?=\d+\.\s)/).filter(b => b.trim())

  for (const block of blocks) {
    const lines: string[] = block.split('\n').map(l => l.trim()).filter((l): l is string => l.length > 0)
    if (lines.length === 0) continue

    const firstLine = lines[0] || ''
    const noMatch = firstLine.match(/^(\d+)\.\s*(.+)/)
    if (!noMatch || !noMatch[1] || !noMatch[2]) continue

    const kpiNo = parseInt(noMatch[1])
    const rest = noMatch[2]

    let name = ''
    let weight = 0
    let type = 'numeric'
    let targetValue = ''
    const gradeCriteria: Record<string, string> = {}
    let formulaDescription = ''
    let deadline = ''
    let subItems: string[] | null = null

    const nameMatch = rest.match(/(?:KPI명\s*:\s*)?([^/]+)/)
    if (nameMatch && nameMatch[1]) name = nameMatch[1].replace(/KPI명\s*:\s*/, '').trim()

    const weightMatch = rest.match(/비중\s*:\s*(\d+)\s*%?/)
    if (weightMatch && weightMatch[1]) weight = parseInt(weightMatch[1])

    const typeMatch = rest.match(/유형\s*:\s*(numeric|schedule|score|count)/i)
    if (typeMatch && typeMatch[1]) type = typeMatch[1].toLowerCase()

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i] || ''

      const targetMatch = line.match(/목표(?:값|치)?\s*:\s*(.+)/)
      if (targetMatch && targetMatch[1]) targetValue = targetMatch[1].trim()

      const gradeMatch = line.match(/등급\s*(?:기준)?\s*:\s*(.+)/)
      if (gradeMatch && gradeMatch[1]) {
        const gradeStr = gradeMatch[1]
        const grades = gradeStr.match(/([SABCDE])\s*\(([^)]+)\)/g)
        if (grades) {
          for (const g of grades) {
            const gm = g.match(/([SABCDE])\s*\(([^)]+)\)/)
            if (gm && gm[1] && gm[2]) gradeCriteria[gm[1]] = gm[2].trim()
          }
        }
      }

      const formulaMatch = line.match(/산출식\s*:\s*(.+)/)
      if (formulaMatch && formulaMatch[1]) formulaDescription = formulaMatch[1].trim()

      const deadlineMatch = line.match(/마감(?:일)?\s*:\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/)
      if (deadlineMatch && deadlineMatch[1]) deadline = deadlineMatch[1].replace(/[/.]/g, '-')

      const subMatch = line.match(/세부\s*(?:항목)?\s*:\s*(.+)/)
      if (subMatch && subMatch[1]) {
        subItems = subMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 0)
      }

      if (weight === 0) {
        const wm = line.match(/비중\s*:\s*(\d+)\s*%?/)
        if (wm && wm[1]) weight = parseInt(wm[1])
      }
    }

    if (name) {
      kpis.push({
        user_id: userId,
        kpi_no: kpiNo,
        name,
        weight,
        type: type as KpiDefinition['type'],
        target_value: targetValue || null,
        grade_criteria: Object.keys(gradeCriteria).length > 0 ? gradeCriteria : null,
        formula_description: formulaDescription || null,
        deadline: deadline || null,
        sub_items: subItems,
        eval_year: evalYear,
      })
    }
  }

  return kpis
}

// ==================== KPI FORM MODAL ====================

function KpiFormModal({
  kpi,
  userId,
  evalYear,
  onClose,
  onSave,
}: {
  kpi?: KpiDefinition | null
  userId: string
  evalYear: number
  onClose: () => void
  onSave: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    kpi_no: kpi?.kpi_no || 1,
    name: kpi?.name || '',
    weight: kpi?.weight || 0,
    type: kpi?.type || 'numeric',
    target_value: kpi?.target_value || '',
    grade_s: kpi?.grade_criteria?.S || '',
    grade_a: kpi?.grade_criteria?.A || '',
    grade_b: kpi?.grade_criteria?.B || '',
    grade_c: kpi?.grade_criteria?.C || '',
    formula_description: kpi?.formula_description || '',
    deadline: kpi?.deadline || '',
    sub_items: kpi?.sub_items ? (Array.isArray(kpi.sub_items) ? kpi.sub_items.join(', ') : '') : '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('KPI 이름은 필수입니다.'); return }
    setLoading(true)
    setError('')

    const gradeCriteria: any = {}
    if (form.grade_s) gradeCriteria.S = form.grade_s
    if (form.grade_a) gradeCriteria.A = form.grade_a
    if (form.grade_b) gradeCriteria.B = form.grade_b
    if (form.grade_c) gradeCriteria.C = form.grade_c

    const data = {
      user_id: userId,
      kpi_no: form.kpi_no,
      name: form.name.trim(),
      weight: form.weight,
      type: form.type,
      target_value: form.target_value || null,
      grade_criteria: Object.keys(gradeCriteria).length > 0 ? gradeCriteria : null,
      formula_description: form.formula_description || null,
      deadline: form.deadline || null,
      sub_items: form.sub_items ? form.sub_items.split(',').map(s => s.trim()).filter(s => s) : null,
      eval_year: evalYear,
    }

    try {
      if (kpi) {
        const { error: updateErr } = await supabase
          .from('kpi_definitions')
          .update(data)
          .eq('id', kpi.id)
        if (updateErr) { setError('수정 실패: ' + updateErr.message); setLoading(false); return }
      } else {
        const { error: insertErr } = await supabase
          .from('kpi_definitions')
          .insert(data)
        if (insertErr) { setError('등록 실패: ' + insertErr.message); setLoading(false); return }
      }
      onSave()
    } catch {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {kpi ? 'KPI 수정' : '새 KPI 등록'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">KPI 번호 *</label>
              <input type="number" min="1" value={form.kpi_no}
                onChange={e => setForm(f => ({ ...f, kpi_no: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">비중 (%)</label>
              <input type="number" min="0" max="100" value={form.weight}
                onChange={e => setForm(f => ({ ...f, weight: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">KPI 이름 *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="예: 원료 구매 단가 절감률"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">유형</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as KpiDefinition['type'] }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent">
                <option value="numeric">수치형 (numeric)</option>
                <option value="schedule">일정형 (schedule)</option>
                <option value="score">점수형 (score)</option>
                <option value="count">건수형 (count)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">목표값</label>
              <input type="text" value={form.target_value}
                onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))}
                placeholder="예: 5% 절감"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
          </div>

          {/* Grade Criteria */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">등급 기준</label>
            <div className="grid grid-cols-4 gap-2">
              {['S', 'A', 'B', 'C'].map(grade => (
                <div key={grade}>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{grade}등급</label>
                  <input type="text"
                    value={(form as any)[`grade_${grade.toLowerCase()}`]}
                    onChange={e => setForm(f => ({ ...f, [`grade_${grade.toLowerCase()}`]: e.target.value }))}
                    placeholder={`${grade} 기준`}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">산출식</label>
            <input type="text" value={form.formula_description}
              onChange={e => setForm(f => ({ ...f, formula_description: e.target.value }))}
              placeholder="예: (전년 단가 - 금년 단가) / 전년 단가 × 100"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">마감일</label>
              <input type="date" value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">세부항목 (쉼표 구분)</label>
              <input type="text" value={form.sub_items}
                onChange={e => setForm(f => ({ ...f, sub_items: e.target.value }))}
                placeholder="예: 팜유, 대두유, 코코넛유"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent" />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              취소
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
              {loading && <Loader className="w-4 h-4 animate-spin" />}
              {kpi ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==================== TEXT UPLOAD MODAL ====================

function KpiTextUploadModal({
  userId,
  evalYear,
  onClose,
  onSave,
}: {
  userId: string
  evalYear: number
  onClose: () => void
  onSave: () => void
}) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<Partial<KpiDefinition>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'input' | 'preview'>('input')

  const handleParse = () => {
    if (!text.trim()) { setError('텍스트를 입력하세요.'); return }
    const result = parseKpiText(text, userId, evalYear)
    if (result.length === 0) {
      setError('KPI를 파싱할 수 없습니다. 형식을 확인하세요.\n예시:\n1. KPI명 / 비중: 20% / 유형: numeric\n   목표값: 5% 절감\n   등급기준: S(7%이상), A(5%이상), B(3%이상), C(3%미만)')
      return
    }
    setError('')
    setParsed(result)
    setStep('preview')
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    try {
      // Delete existing KPIs for this year first
      await supabase
        .from('kpi_definitions')
        .delete()
        .eq('user_id', userId)
        .eq('eval_year', evalYear)

      const { error: insertErr } = await supabase
        .from('kpi_definitions')
        .insert(parsed)

      if (insertErr) { setError('저장 실패: ' + insertErr.message); setLoading(false); return }
      onSave()
    } catch {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            KPI 텍스트 일괄 등록
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-line">{error}</p>
            </div>
          )}

          {step === 'input' ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                아래 형식으로 KPI 텍스트를 붙여넣으세요. 기존 {evalYear}년 KPI는 덮어씌워집니다.
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 text-xs text-gray-500 dark:text-gray-400 font-mono">
                1. KPI명 / 비중: 20% / 유형: numeric<br/>
                &nbsp;&nbsp;&nbsp;목표값: 5% 절감<br/>
                &nbsp;&nbsp;&nbsp;등급기준: S(7%이상), A(5%이상), B(3%이상), C(3%미만)<br/>
                &nbsp;&nbsp;&nbsp;산출식: (전년단가 - 금년단가) / 전년단가 × 100<br/>
                &nbsp;&nbsp;&nbsp;마감일: 2025-12-31<br/>
                2. 다음 KPI명 / 비중: 15% / 유형: schedule<br/>
                &nbsp;&nbsp;&nbsp;...
              </div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="KPI 텍스트를 여기에 붙여넣으세요..."
                rows={12}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none font-mono text-sm"
              />
              <div className="flex gap-3 mt-4">
                <button onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  취소
                </button>
                <button onClick={handleParse}
                  className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" />
                  파싱 미리보기
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                총 <span className="font-bold text-red-500">{parsed.length}개</span> KPI가 파싱되었습니다. 확인 후 저장하세요.
              </p>
              <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                {parsed.map((kpi, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-bold">
                        {kpi.kpi_no}
                      </span>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{kpi.name}</h3>
                      <span className="ml-auto text-sm text-gray-500">비중: {kpi.weight}%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <div>유형: {kpi.type}</div>
                      {kpi.target_value && <div>목표: {kpi.target_value}</div>}
                      {kpi.formula_description && <div className="col-span-2">산출식: {kpi.formula_description}</div>}
                      {kpi.grade_criteria && (
                        <div className="col-span-2">
                          등급: {Object.entries(kpi.grade_criteria).map(([k, v]) => `${k}(${v})`).join(', ')}
                        </div>
                      )}
                      {kpi.deadline && <div>마감: {kpi.deadline}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('input')}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  뒤로
                </button>
                <button onClick={handleSave} disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-medium rounded-lg flex items-center justify-center gap-2">
                  {loading && <Loader className="w-4 h-4 animate-spin" />}
                  {evalYear}년 KPI로 저장 ({parsed.length}개)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== KPI CARD ====================

function KpiCard({
  kpi,
  onEdit,
  onDelete,
  isOwner,
}: {
  kpi: KpiDefinition
  onEdit: () => void
  onDelete: () => void
  isOwner: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const typeLabels: Record<string, string> = {
    numeric: '수치형',
    schedule: '일정형',
    score: '점수형',
    count: '건수형',
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-bold flex-shrink-0 mt-0.5">
            {kpi.kpi_no}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{kpi.name}</h3>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                비중 {kpi.weight}%
              </span>
              <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                {typeLabels[kpi.type] || kpi.type}
              </span>
              {kpi.target_value && (
                <span className="text-gray-600 dark:text-gray-400">목표: {kpi.target_value}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isOwner && (
              <>
                <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              </>
            )}
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-gray-800 mt-0">
          <div className="pt-3 space-y-2 text-sm text-gray-600 dark:text-gray-400">
            {kpi.formula_description && (
              <div><span className="font-medium text-gray-700 dark:text-gray-300">산출식:</span> {kpi.formula_description}</div>
            )}
            {kpi.grade_criteria && Object.keys(kpi.grade_criteria).length > 0 && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">등급 기준:</span>
                <div className="flex gap-2 mt-1">
                  {Object.entries(kpi.grade_criteria).map(([grade, criteria]) => (
                    <span key={grade} className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      grade === 'S' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                      grade === 'A' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                      grade === 'B' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {grade}: {criteria as string}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {kpi.deadline && (
              <div><span className="font-medium text-gray-700 dark:text-gray-300">마감일:</span> {kpi.deadline}</div>
            )}
            {kpi.sub_items && Array.isArray(kpi.sub_items) && kpi.sub_items.length > 0 && (
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">세부항목:</span>{' '}
                {kpi.sub_items.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== MAIN KPI PAGE ====================

export default function KpiPage() {
  const { user, profile } = useAuth()

  const [kpis, setKpis] = useState<KpiDefinition[]>([])
  const [teamKpis, setTeamKpis] = useState<Record<string, { profile: Profile; kpis: KpiDefinition[] }>>({})
  const [loading, setLoading] = useState(true)
  const [evalYear, setEvalYear] = useState(new Date().getFullYear())
  const [viewMode, setViewMode] = useState<'my' | 'team'>('my')
  const [showForm, setShowForm] = useState(false)
  const [showTextUpload, setShowTextUpload] = useState(false)
  const [editingKpi, setEditingKpi] = useState<KpiDefinition | null>(null)
  const [, setProfiles] = useState<Profile[]>([])

  const fetchKpis = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Fetch my KPIs
      const { data: myKpis } = await supabase
        .from('kpi_definitions')
        .select('*')
        .eq('user_id', user.id)
        .eq('eval_year', evalYear)
        .order('kpi_no')

      setKpis(myKpis || [])

      // Fetch approved profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', true)
        .order('name')

      setProfiles(profilesData || [])

      // Fetch team KPIs (all approved users' KPIs)
      const { data: allKpis } = await supabase
        .from('kpi_definitions')
        .select('*')
        .eq('eval_year', evalYear)
        .order('kpi_no')

      if (allKpis && profilesData) {
        const grouped: Record<string, { profile: Profile; kpis: KpiDefinition[] }> = {}
        for (const p of profilesData) {
          if (p.id === user.id) continue
          const userKpis = allKpis.filter(k => k.user_id === p.id)
          if (userKpis.length > 0) {
            grouped[p.id] = { profile: p, kpis: userKpis }
          }
        }
        setTeamKpis(grouped)
      }
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, evalYear])

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  const handleDelete = async (kpiId: string) => {
    if (!confirm('이 KPI를 삭제하시겠습니까?')) return
    await supabase.from('kpi_definitions').delete().eq('id', kpiId)
    fetchKpis()
  }

  const handleEdit = (kpi: KpiDefinition) => {
    setEditingKpi(kpi)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingKpi(null)
  }

  const handleFormSave = () => {
    handleFormClose()
    fetchKpis()
  }

  const handleTextUploadSave = () => {
    setShowTextUpload(false)
    fetchKpis()
  }

  const totalWeight = kpis.reduce((sum, k) => sum + k.weight, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-300 dark:border-gray-700 border-t-red-500 rounded-full animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">KPI 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">KPI 관리</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {profile?.name}님의 핵심성과지표를 관리하세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Year Selector */}
          <select value={evalYear} onChange={e => setEvalYear(parseInt(e.target.value))}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100">
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 w-fit">
        <button onClick={() => setViewMode('my')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'my' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}>
          <User size={16} /> 내 KPI
        </button>
        <button onClick={() => setViewMode('team')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            viewMode === 'team' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}>
          <Users size={16} /> 팀원 KPI
        </button>
      </div>

      {viewMode === 'my' ? (
        <>
          {/* My KPI Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">등록된 KPI</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{kpis.length}<span className="text-sm font-normal text-gray-400 ml-1">개</span></p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">총 비중</p>
              <p className={`text-3xl font-bold ${totalWeight === 100 ? 'text-green-600' : 'text-amber-500'}`}>
                {totalWeight}<span className="text-sm font-normal text-gray-400 ml-1">%</span>
              </p>
              {totalWeight !== 100 && (
                <p className="text-xs text-amber-500 mt-1">비중 합계가 100%가 아닙니다</p>
              )}
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">평가연도</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{evalYear}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => { setEditingKpi(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors shadow-sm">
              <Plus size={18} /> KPI 추가
            </button>
            <button onClick={() => setShowTextUpload(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Upload size={18} /> 텍스트 일괄 등록
            </button>
          </div>

          {/* KPI List */}
          {kpis.length > 0 ? (
            <div className="space-y-3">
              {kpis.map(kpi => (
                <KpiCard
                  key={kpi.id}
                  kpi={kpi}
                  onEdit={() => handleEdit(kpi)}
                  onDelete={() => handleDelete(kpi.id)}
                  isOwner={true}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
              <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{evalYear}년 KPI가 없습니다</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                KPI를 추가하거나, 텍스트로 일괄 등록하세요.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => { setEditingKpi(null); setShowForm(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg text-sm">
                  <Plus size={16} /> KPI 추가
                </button>
                <button onClick={() => setShowTextUpload(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Upload size={16} /> 텍스트 등록
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Team KPI View */
        <>
          {Object.keys(teamKpis).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(teamKpis).map(([userId, { profile: memberProfile, kpis: memberKpis }]) => (
                <div key={userId} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: memberProfile.avatar_color || '#818CF8' }}>
                        {memberProfile.name?.[0] || 'U'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{memberProfile.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {memberProfile.position || memberProfile.part || memberProfile.department || ''}
                          {' · '}KPI {memberKpis.length}개
                          {' · '}비중 합계 {memberKpis.reduce((s, k) => s + k.weight, 0)}%
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {memberKpis.map(kpi => (
                      <KpiCard key={kpi.id} kpi={kpi} onEdit={() => {}} onDelete={() => {}} isOwner={false} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">팀원 KPI가 없습니다</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {evalYear}년에 등록된 팀원 KPI가 없습니다.
              </p>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showForm && user && (
        <KpiFormModal
          kpi={editingKpi}
          userId={user.id}
          evalYear={evalYear}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}

      {showTextUpload && user && (
        <KpiTextUploadModal
          userId={user.id}
          evalYear={evalYear}
          onClose={() => setShowTextUpload(false)}
          onSave={handleTextUploadSave}
        />
      )}
    </div>
  )
}
