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

    const systemPrompt = `당신은 한국 기업의 업무 관리 AI 어시스턴트입니다.
사용자의 업무 정보를 분석하여 다음을 수행합니다:
1. 대충 적은 상세 내용을 명확하고 전문적인 한국 비즈니스 스타일로 정리
2. 제공된 프로젝트 목록에서 가장 적합한 프로젝트 제안 (또는 새로운 프로젝트 생성 제안)
3. 업무 맥락을 고려한 다음 단계(next_action) 제안
4. 관련 태그 제안

응답은 반드시 다음 JSON 형식으로만 반환하세요:
{
  "enhanced_content": "정리된 상세 내용 (200자 이내)",
  "suggested_project_id": "일치하는 프로젝트 ID 또는 null",
  "suggested_project_name": "새 프로젝트 생성이 필요한 경우 프로젝트명, 아니면 null",
  "suggested_next_action": "다음 단계 (50자 이내)",
  "suggested_tags": ["태그1", "태그2", "태그3"] (최대 5개)
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
    const response = await fetch('https://api.anthropic.com/v1/messages/create', {
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
