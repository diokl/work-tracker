import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Verify user auth via Supabase
async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(authHeader.split(' ')[1])
  return user
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    const language = (formData.get('language') as string) || 'ko'

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    const HF_API_KEY = process.env.HUGGINGFACE_API_KEY
    if (!HF_API_KEY) {
      return NextResponse.json({ error: 'Hugging Face API key not configured' }, { status: 500 })
    }

    // Convert File to ArrayBuffer for HF API
    const audioBuffer = await audioFile.arrayBuffer()

    // Call Hugging Face Inference API with Whisper
    const hfResponse = await fetch(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': audioFile.type || 'audio/webm',
        },
        body: audioBuffer,
      }
    )

    if (!hfResponse.ok) {
      const errorText = await hfResponse.text()
      console.error('HF API error:', hfResponse.status, errorText)

      // Model loading — tell client to retry
      if (hfResponse.status === 503) {
        return NextResponse.json(
          { error: '모델 로딩 중입니다. 잠시 후 다시 시도해주세요.', retry: true },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: `Whisper API 오류: ${hfResponse.status}` },
        { status: 502 }
      )
    }

    const result = await hfResponse.json()
    // HF Whisper returns { text: "transcribed text" }
    const transcribedText = result.text || ''

    return NextResponse.json({ text: transcribedText })
  } catch (err: any) {
    console.error('Transcribe API error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
