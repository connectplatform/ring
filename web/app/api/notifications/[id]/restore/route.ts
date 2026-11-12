import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import { resolvePersistedUserRole } from '@/features/auth/user-role';
// FIX: direct import — loader's require() lost named exports under the
// custom-server runtime (see [id]/read note).
import { restoreNotification } from '@/features/notifications/services/notification-service';
import { isNotificationServiceAvailable } from '@/features/notifications/services/notification-service-loader';

/**
 * POST handler for /api/notifications/[id]/restore (SD5 undo)
 *
 * Reverts a soft-deleted notification back to its pre-delete status within
 * the client's 30s undo grace window. The service publishes a `restore`
 * tunnel event carrying the full row so open feeds re-insert it live.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connection();

  const { id: notificationId } = await context.params;

  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    resolvePersistedUserRole(session.user.role);

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    if (!isNotificationServiceAvailable()) {
      return NextResponse.json(
        {
          success: true,
          message:
            'Notifications not available in PostgreSQL-only mode (feature in development)',
        },
        { status: 200 }
      );
    }

    await restoreNotification(notificationId, userId);

    return NextResponse.json(
      {
        success: true,
        message: 'Notification restored',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('API: /api/notifications/[id]/restore - POST error:', error);

    if (error instanceof Error) {
      if (error.message.includes('Notification not found')) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        );
      }
      if (error.message.includes('Unauthorized access')) {
        return NextResponse.json(
          { error: 'Unauthorized access to notification' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to restore notification. Please try again later.',
      },
      { status: 500 }
    );
  }
}
