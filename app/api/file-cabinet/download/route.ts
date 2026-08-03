import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getNode } from '@/features/file-cabinet/service'
import { fetchCabinetUpstream } from '@/features/file-cabinet/download-upstream'
import type { CabinetImageVariant } from '@/features/file-cabinet/media-urls'

const ALLOWED_VARIANTS = new Set<CabinetImageVariant>([
  'thumb',
  'sync_thumb',
  'original_webp',
  'card',
  'blur',
])

/**
 * ACL-gated same-origin download (LegioX ringbase-download-proxy-pattern).
 * Query: nodeId=… [&inline=1] [&variant=thumb|sync_thumb|original_webp|card|blur]
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const nodeId = searchParams.get('nodeId')
  const inline = searchParams.get('inline') === '1'
  const variantRaw = searchParams.get('variant')
  const variant =
    variantRaw && ALLOWED_VARIANTS.has(variantRaw as CabinetImageVariant)
      ? (variantRaw as CabinetImageVariant)
      : undefined
  if (!nodeId) {
    return NextResponse.json({ error: 'nodeId required' }, { status: 400 })
  }

  try {
    const node = await getNode(session.user.id, nodeId)
    if (!node || node.kind !== 'file' || !node.storageUrl) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { response, filename, contentType } = await fetchCabinetUpstream(node, {
      variant,
    })
    const body = response.body
    if (!body) {
      return NextResponse.json({ error: 'Empty upstream' }, { status: 502 })
    }

    const disposition = inline
      ? `inline; filename="${filename.replace(/"/g, '')}"`
      : `attachment; filename="${filename.replace(/"/g, '')}"`

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Cache-Control': variant ? 'private, max-age=300' : 'private, no-store',
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Download failed'
    const status =
      message.includes('denied') || message.includes('Access')
        ? 403
        : (e as { status?: number })?.status === 404
          ? 404
          : 502
    return NextResponse.json({ error: message }, { status })
  }
}
