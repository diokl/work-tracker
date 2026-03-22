import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!

interface ActionItem {
  assignee: string
  task: string
  deadline?: string
}

interface SummaryResult {
  summary: string
  key_points: string[]
  action_items: ActionItem[]
  translation?: Record<string, string>
}

// Claude API를 사용한 AI 요약
async function summarizeWithClaude(transcript: string, language: string, title: string): Promise<SummaryResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `당신은 회의록 분석 전문가입니다. 아래 회의 녹취록을 분석하여 JSON 형식으로 결과를 반환해주세요.

회의 제목: ${title}
회의 언어: ${language}

녹취록:
${transcript}

다음 JSON 형식으로 정확히 반환해주세요 (JSON만 반환, 다른 텍스트 없이):
{
  "summary": "회의 전체 요약 (한국어, 3-5문장)",
  "key_points": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "action_items": [
    {"assignee": "담당자명", "task": "할 일 내용", "deadline": "기한(있으면)"}
  ],
  "translation": {
    "en": "English summary of the meeting (2-3 sentences)"
  }
}

참고사항:
- 요약은 반드시 한국어로 작성
- 핵심 포인트는 3-7개
- 액션 아이템은 명확한 담당자와 할 일로 구분
- 담당자가 불명확하면 "미정"으로 표시
- 영어 번역 요약도 포함`
        }
      ]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const content = data.content[0].text

  // JSON 파싱 (코드블록이 포함될 수 있으므로 정리)
  const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(jsonStr)
}

// API 키 없을 때 기본 요약 (규칙 기반)
function summarizeBasic(transcript: string, title: string): SummaryResult {
  const sentences = transcript
    .split(/[.!?。！？\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 5)

  // 간단한 요약: 처음 3문장 + 마지막 2문장
  const summaryParts: string[] = []
  if (sentences.length <= 5) {
    summaryParts.push(...sentences)
  } else {
    summaryParts.push(...sentences.slice(0, 3))
    summaryParts.push(...sentences.slice(-2))
  }

  const summary = summaryParts.join('. ') + '.'

  // 핵심 포인트: 가장 긴 문장들을 핵심 포인트로 사용
  const keyPoints = [...sentences]
    .sort((a, b) => b.length - a.length)
    .slice(0, Math.min(5, sentences.length))
    .map(s => s.length > 100 ? s.substring(0, 100) + '...' : s)

  // "해야", "필요", "예정", "담당" 등이 포함된 문장에서 액션 아이템 추출
  const actionKeywords = ['해야', '필요', '예정', '담당', '확인', '진행', '검토', '보고', '준비', '완료']
  const actionItems: ActionItem[] = sentences
    .filter(s => actionKeywords.some(k => s.includes(k)))
    .slice(0, 5)
    .map(s => ({
      assignee: '미정',
      task: s.length > 80 ? s.substring(0, 80) + '...' : s,
    }))

  return {
    summary: `[자동 요약] ${title} 회의 내용입니다. ${summary}`,
    key_points: keyPoints.length > 0 ? keyPoints : ['회의 내용을 분석할 수 없습니다. AI 요약을 사용하려면 ANTHROPIC_API_KEY를 설정해주세요.'],
    action_items: actionItems.length > 0 ? actionItems : [{ assignee: '미정', task: '회의 후속 조치 확인 필요' }],
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { meetingId, transcript, language, title } = body

    if (!meetingId || !transcript) {
      return NextResponse.json(
        { error: '회의 ID와 녹취록이 필요합니다.' },
        { status: 400 }
      )
    }

    // 인증 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 상태를 summarizing으로 업데이트
    await supabase
      .from('meetings')
      .update({ status: 'summarizing' })
      .eq('id', meetingId)

    let result: SummaryResult

    try {
      if (ANTHROPIC_API_KEY) {
        // Claude API 사용
        result = await summarizeWithClaude(transcript, language || 'ko', title || '회의')
      } else {
        // 기본 규칙 기반 요약
        result = summarizeBasic(transcript, title || '회의')
      }
    } catch (aiError: any) {
      console.error('AI summarization error:', aiError)
      // AI 실패 시 기본 요약으로 fallback
      result = summarizeBasic(transcript, title || '회의')
      result.summary = `[AI 요약 실패 - 기본 요약] ${result.summary}`
    }

    // DB 업데이트
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        summary: result.summary,
        key_points: result.key_points,
        action_items: result.action_items,
        translation: result.translation || {},
        status: 'completed',
      })
      .eq('id', meetingId)

    if (updateError) {
      console.error('DB update error:', updateError)
      return NextResponse.json(
        { error: 'DB 업데이트 실패: ' + updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result,
      ai_powered: !!ANTHROPIC_API_KEY,
    })

  } catch (error: any) {
    console.error('Summarize API error:', error)
    return NextResponse.json(
      { error: error.message || '요약 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
