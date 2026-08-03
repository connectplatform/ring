import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { auth } from '@/auth'
import { resolveWikiActor } from '@/features/wiki/resolve-wiki-actor'
import * as WikiService from '@/features/wiki/wiki-service'
import type { UpdateWikiPageInput } from '@/features/wiki/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { id } = await context.params
  try {
    const actor = await resolveWikiActor({
      userId: session.user.id,
      role: session.user.role,
    })
    const page = await WikiService.getPage(actor, id)
    if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const backlinks = await WikiService.getBacklinks(actor, id)
    return NextResponse.json({ success: true, page, backlinks })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: message }, { status: 403 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { id } = await context.params
  try {
    const body = (await request.json()) as UpdateWikiPageInput
    const actor = await resolveWikiActor({
      userId: session.user.id,
      role: session.user.role,
    })
    const page = await WikiService.updatePage(actor, id, body)
    return NextResponse.json({ success: true, page })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message.includes('denied') || message.includes('only') ? 403 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const { id } = await context.params
  const confirm = request.nextUrl.searchParams.get('confirm') === 'true'
  if (!confirm) {
    return NextResponse.json({ error: 'confirm=true required' }, { status: 400 })
  }
  try {
    const actor = await resolveWikiActor({
      userId: session.user.id,
      role: session.user.role,
    })
    await WikiService.deletePage(actor, id)
    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ success: false, error: message }, { status: 403 })
  }
}
