import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { generateNewsArticle } from '@/features/news/services/article-generator'

type GenerateNewsBody = {
  source?: 'url' | 'search' | 'text'
  value?: string
  instruction?: string
  locale?: string
  enableAudio?: boolean
  enableImage?: boolean
}

function canGenerateNews(role?: UserRole): boolean {
  return role === UserRole.admin || role === UserRole.superadmin
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as { role?: UserRole }).role
  if (!canGenerateNews(role)) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  let body: GenerateNewsBody
  try {
    body = (await request.json()) as GenerateNewsBody
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const source = body.source
  const value = body.value?.trim()
  if (!source || !value) {
    return NextResponse.json({ success: false, error: 'source and value are required' }, { status: 400 })
  }

  const result = await generateNewsArticle({
    source,
    value,
    instruction: body.instruction,
    locale: body.locale,
    author: {
      id: session.user.id,
      name: session.user.name || 'Admin',
    },
    enableAudio: body.enableAudio,
    enableImage: body.enableImage,
  })

  if (!result.success) {
    return NextResponse.json(result, { status: 502 })
  }

  return NextResponse.json(result, { status: 201 })
}
