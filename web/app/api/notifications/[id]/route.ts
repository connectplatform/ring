import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import { resolvePersistedUserRole } from '@/features/auth/user-role';
// FIX: direct import — loader's require() lost named exports under the
// custom-server runtime (see [id]/read note).
import { deleteNotification } from '@/features/notifications/services/notification-service';
import { isNotificationServiceAvailable } from '@/features/notifications/services/notification-service-loader';

/**
 * DELETE handler for /api/notifications/[id]
 * Deletes a single notification owned by the authenticated user.
 *
 * Client contract: notification-center.tsx already calls
 * `apiClient.delete('/api/notifications/${id}')` — this route fulfills it.
 * The service publishes a tunnel `delete` event so open feeds patch live
 * (applyInboxToFeed removes the row without a refetch).
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Dynamic route (Next.js 16 prerendering opt-out)
  await connection();

  const { id: notificationId } = await context.params;

  try {
    // (1) Session authentication
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // (2) Identifiers + role normalization
    const userId = session.user.id;
    const userRole = resolvePersistedUserRole(session.user.role);

    // (3) Validate notification id
    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    // (4) Feature availability (psql-only deployments)
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

    // (5) Business logic — service enforces ownership and publishes the tunnel event
    await deleteNotification(notificationId, userId);

    return NextResponse.json(
      {
        success: true,
        message: 'Notification deleted',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('API: /api/notifications/[id] - DELETE error:', error);

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
        error: 'Failed to delete notification. Please try again later.',
      },
      { status: 500 }
    );
  }
}
