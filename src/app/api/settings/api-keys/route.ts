import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const anthropicKey = process.env['ANTHROPIC_API_KEY']

    const keys = [
      {
        name: 'ANTHROPIC_API_KEY',
        label: 'Anthropic (Claude)',
        has_key: !!anthropicKey,
        masked: anthropicKey
          ? anthropicKey.slice(0, 7) + '...' + anthropicKey.slice(-4)
          : null,
        source: 'env' as const,
      },
    ]

    return NextResponse.json({ keys })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
