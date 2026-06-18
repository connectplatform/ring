/**
 * Collaboration snapshot API — bootstrap Y.Doc state for offline reconnect.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ publicationId: string }> },
) {
  const { publicationId } = await params;

  if (process.env.NEXT_PUBLIC_COLLAB_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Collaboration disabled' }, { status: 404 });
  }

  const auth = await verifyAuth(_request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Snapshot persistence wired in Zemna Phase 4 (PG yjs_state column)
  return NextResponse.json({
    publicationId,
    snapshot: null,
    message: 'Snapshot store not yet configured',
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ publicationId: string }> },
) {
  const { publicationId } = await params;

  if (process.env.NEXT_PUBLIC_COLLAB_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Collaboration disabled' }, { status: 404 });
  }

  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await request.json().catch(() => ({}));

  return NextResponse.json({
    publicationId,
    saved: false,
    message: 'Snapshot persistence deferred to Zemna Phase 4',
  });
}
