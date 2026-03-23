import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const keys = [
      {
        name: 'ANTHROPIC_API_KEY',
        label: 'Anthropic (Claude)',
        has_key: !!process.env.ANTHROPIC_API_KEY,
        masked: process.env.ANTHROPIC_API_KEY
          ? process.env.ANTHROPIC_API_KEY.slice(0, 7) + '...' + process.env.ANTHROPIC_API_KEY.slice(-4)
          : null,
        source: 'env' as const,
      },
    ]

    return NextResponse.json({ keys })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
