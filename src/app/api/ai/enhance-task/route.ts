import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface EnhanceTaskRequest {
  title: string
  content: string
  projects: Array<{ id: string; name: string }>
  existingTasks: Array<{ title: string; next_action: string }>
}

interface EnhanceTaskResponse {
  enhanced_content: string
  suggested_project_id: string | null
  suggested_project_name: string | null
  suggested_next_action: string
  suggested_tags: string[]
}

// Verify user auth via Supabase
async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const supabase = createClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!
  )
  const { data: { user } } = await supabase.auth.getUser(authHeader.split(' ')[1])
  return user
}

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if API key is configured
    const apiKey = process.env['ANTHROPIC_API_KEY']
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Claude API key not configured' },
        { status: 500 }
      )
    }

    // Parse request body
    const body: EnhanceTaskRequest = await req.json()
    const { title, content, projects, existingTasks } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // Build the prompt
    const projectList = projects.length > 0
      ? projects.map(p => `- ${p.name} (ID: ${p.id})`).join('\n')
      : '(프로젝트 없음)'

    const existingTasksList = existingTasks.length > 0
      ? existingTasks.map(t => `- ${t.title} (다음 단계: ${t.next_action || '미지정'})`).join('\n')
      : '(기존 업무 없음)'

    const systemPrompt = `당신은 삼양식품 기초원료구매팀의 업무 관리 AI 어시스턴트입니다.
사용자의 업무 정보를 분석하여 다음을 수행합니다:

1. **상세 내용 정리**: 대충 적은 내용을 명확하고 전문적인 한국 비즈니스 문체로 정리 (200자 이내)
2. **프로젝트 매칭/제안**:
   - 제공된 프로젝트 목록 중 업무 내용과 가장 관련 있는 프로젝트를 찾아서 해당 ID를 반환
   - 적합한 프로젝트가 없으면 suggested_project_id는 null로, suggested_project_name에 새 프로젝트명 제안
   - 프로젝트명은 간결하고 명확하게 (예: "2026 팜유 구매전략", "대두유 단가 관리")
3. **다음 단계 제안**: 실무적으로 바로 실행 가능한 구체적인 다음 액션
4. **태그 제안**: 업무 분류에 도움되는 태그 (최대 5개)

중요: suggested_project_id에는 반드시 프로젝트 목록에 있는 정확한 ID 값만 넣으세요. 목록에 없는 ID를 임의로 만들지 마세요.

응답은 반드시 다음 JSON 형식으로만 반환하세요 (JSON만, 다른 텍스트 없이):
{
  "enhanced_content": "정리된 상세 내용",
  "suggested_project_id": "매칭된 프로젝트 ID 또는 null",
  "suggested_project_name": "새 프로젝트명 또는 null (suggested_project_id가 null일 때만)",
  "suggested_next_action": "다음 단계",
  "suggested_tags": ["태그1", "태그2"]
}`

    const userPrompt = `다음 업무 정보를 정리해주세요:

제목: ${title}

상세 내용:
${content}

현재 프로젝트 목록:
${projectList}

기존 관련 업무:
${existingTasksList}

위 정보를 분석하여 JSON 응답을 제공해주세요.`

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Claude API error:', response.status, error)
      return NextResponse.json(
        { error: `Claude API error: ${response.status}` },
        { status: 502 }
      )
    }

    const result = await response.json()
    const assistantMessage = result.content[0]?.text || ''

    // Parse the JSON response from Claude
    let parsedResponse: EnhanceTaskResponse
    try {
      // Extract JSON from the response (Claude might wrap it with extra text)
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }
      parsedResponse = JSON.parse(jsonMatch[0])
    } catch (err) {
      console.error('Failed to parse Claude response:', assistantMessage, err)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 502 }
      )
    }

    return NextResponse.json(parsedResponse)
  } catch (err: any) {
    console.error('Enhance task API error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
