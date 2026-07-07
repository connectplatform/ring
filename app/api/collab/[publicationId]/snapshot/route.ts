/**
 * Collaboration snapshot API — bootstrap Y.Doc state for offline reconnect.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/edge-jwt';

// GET handler returns the current snapshot state for a publication (not yet implemented)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ publicationId: string }> },
) {
  // Resolve route params, extracting publicationId (params is a Promise)
  const { publicationId } = await params;

  // Check if collaboration feature is enabled via environment variable
  if (process.env.NEXT_PUBLIC_COLLAB_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Collaboration disabled' }, { status: 404 });
  }

  // Verify user authentication via edge-jwt token in request
  const auth = await verifyAuth(_request);
  if (!auth) {
    // Respond with 401 Unauthorized if auth fails
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // At this phase, snapshot data is not persisted or returned.
  // TODO: Implement actual snapshot read from persistence (Postgres yjs_state).
  return NextResponse.json({
    publicationId,
    snapshot: null, // Placeholder until persistence is set up
    message: 'Snapshot store not yet configured',
  });
}

// PUT handler intended to persist a new snapshot for a given publication (not yet implemented)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ publicationId: string }> },
) {
  // Resolve route params
  const { publicationId } = await params;

  // Check if collaboration feature is enabled
  if (process.env.NEXT_PUBLIC_COLLAB_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Collaboration disabled' }, { status: 404 });
  }

  // Authenticate the request
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Attempt to parse the request body as JSON, swallow errors by returning empty object
  // The parsed JSON is ignored since snapshot persistence is not yet implemented
  // TODO: Parse and validate posted snapshot data when persistence is implemented.
  await request.json().catch(() => ({}));

  // Respond noting that snapshot save is not implemented
  // TODO: Persist snapshot to database when feature is available.
  return NextResponse.json({
    publicationId,
    saved: false,
    message: 'Snapshot persistence deferred to future phase',
  });
}

// TODO: When Next.js enables route handler type inferral for params, adjust function signatures.
// TODO: Consider using next/server Route Handler conventions for better type safety and auto-inferred params.