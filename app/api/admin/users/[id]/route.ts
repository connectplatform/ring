import { NextRequest, NextResponse, connection } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { db } from '@/lib/database'

const SENSITIVE_USER_KEYS = [
  'password',
  'passwordHash',
  'hashedPassword',
  'encryptedPassword',
  'salt',
] as const

function stripSensitiveUserFields(record: Record<string, unknown>) {
  const out = { ...record }
  for (const k of SENSITIVE_USER_KEYS) {
    delete out[k]
  }
  return out
}

function canManageUsers(session: Session | null) {
  return (
    !!session?.user &&
    (session.user.role === 'admin' || session.user.role === 'superadmin')
  )
}

/**
 * GET /api/admin/users/[id]
 * Return a single user document for admin UI (no credentials).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection()

  try {
    const session = await auth()
    if (!canManageUsers(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userResult = await db().readDoc<Record<string, unknown>>('users', id)
    if (!userResult.success) {
      if (userResult.metadata?.operation === 'initialize') {
        return NextResponse.json(
          { error: 'Database initialization failed' },
          { status: 500 },
        )
      }
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
    }
    if (!userResult.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const data = stripSensitiveUserFields(userResult.data)

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('GET /api/admin/users/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Remove a user (admin / superadmin). Used by admin user manager.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection()

  try {
    const session = await auth()
    if (!canManageUsers(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (session.user.id === id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 },
      )
    }

    const userResult = await db().readDoc<Record<string, unknown>>('users', id)
    if (!userResult.success) {
      if (userResult.metadata?.operation === 'initialize') {
        return NextResponse.json(
          { error: 'Database initialization failed' },
          { status: 500 },
        )
      }
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
    }
    if (!userResult.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const del = await db().deleteDoc('users', id)
    if (!del.success) {
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    })
  } catch (error) {
    console.error('DELETE /api/admin/users/[id]:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 },
    )
  }
}
