import { NextResponse, connection } from 'next/server'
import { db } from '@/lib/database'
import { shouldSkipDatabaseConnect } from '@/lib/build-cache/phase-detector'

export async function GET() {
  await connection()

  if (shouldSkipDatabaseConnect()) {
    return NextResponse.json({
      success: true,
      skipped: true,
      message: 'Database connect skipped during build/static generation (RING_BUILD_SKIP_DB or build phase)',
      readResult: null,
    })
  }

  try {
    const readResult = await db().readDoc('users', 'test-user-id')

    return NextResponse.json({
      success: true,
      message: 'Database service initialized successfully',
      readResult: {
        success: readResult.success,
        found: Boolean(readResult.data),
        error: readResult.error?.message,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
