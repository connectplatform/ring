import { NextRequest, NextResponse, connection } from 'next/server'
import { auth } from '@/auth'
import { UserRole } from '@/features/auth/types'
import { ImageConductor } from '@/lib/images/conductor/image-conductor'
import type { GenerateImageContext, ImageProviderId } from '@/lib/images/conductor/types'

type GenerateImageBody = Partial<GenerateImageContext> & {
  prompt?: string
}

function canGenerateImages(role?: UserRole): boolean {
  return role === UserRole.admin || role === UserRole.superadmin
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as { role?: UserRole }).role
  if (!canGenerateImages(role)) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  let body: GenerateImageBody
  try {
    body = (await request.json()) as GenerateImageBody
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 })
  }

  const result = await ImageConductor.generate({
    prompt: body.prompt.trim(),
    provider: body.provider as ImageProviderId | undefined,
    model: body.model,
    aspectRatio: body.aspectRatio,
    resolution: body.resolution,
    n: body.n,
    seed: body.seed,
    purpose: body.purpose,
    refCode: body.refCode,
    actorId: session.user.id,
  })

  if (!result.success) {
    return NextResponse.json(result, { status: 502 })
  }

  return NextResponse.json(result, { status: 201 })
}
