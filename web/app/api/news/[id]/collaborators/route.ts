/**
 * Scaffold — invite collaborator endpoints (Zemna Phase 4).
 * Returns 501 until invite UI sprint.
 */

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'not_implemented',
      message: 'News collaborator invites are scaffolded; UI sprint pending.',
    },
    { status: 501 },
  )
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'not_implemented',
      message: 'News collaborator list is scaffolded; UI sprint pending.',
    },
    { status: 501 },
  )
}
