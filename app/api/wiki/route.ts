import { NextRequest, NextResponse } from 'next/server'
import { connection } from 'next/server'
import { auth } from '@/auth'
import { isVaultKey } from '@/features/wiki/vault-key'
import { resolveWikiActor } from '@/features/wiki/resolve-wiki-actor'
import * as WikiService from '@/features/wiki/wiki-service'
import type { CreateWikiPageInput } from '@/features/wiki/types'

export async function GET(request: NextRequest) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const vaultKey = request.nextUrl.searchParams.get('vaultKey') || 'tenant'
  const q = request.nextUrl.searchParams.get('q')
  const orderId = vaultKey.startsWith('po:') ? vaultKey.slice(3) : undefined

  if (!isVaultKey(vaultKey)) {
    return NextResponse.json({ error: 'Invalid vaultKey' }, { status: 400 })
  }

  try {
    const actor = await resolveWikiActor({
      userId: session.user.id,
      role: session.user.role,
      orderId,
    })
    await WikiService.ensureTenantSchema(actor)

    if (q) {
      const result = await WikiService.searchPages(actor, q, { vaultKey })
      return NextResponse.json({ success: true, ...result })
    }

    const pages = await WikiService.listPages(actor, vaultKey)
    return NextResponse.json({ success: true, pages })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message.includes('denied') || message.includes('required') ? 403 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  await connection()
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as CreateWikiPageInput
    if (!body?.title || !body?.vaultKey || !isVaultKey(body.vaultKey)) {
      return NextResponse.json({ error: 'title and vaultKey required' }, { status: 400 })
    }
    const orderId = body.vaultKey.startsWith('po:') ? body.vaultKey.slice(3) : undefined
    const actor = await resolveWikiActor({
      userId: session.user.id,
      role: session.user.role,
      orderId,
    })
    const page = await WikiService.createPage(actor, body)
    return NextResponse.json({ success: true, page })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message.includes('denied') || message.includes('only') ? 403 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
