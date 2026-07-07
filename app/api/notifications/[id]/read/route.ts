import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import {
  assertKnownUserRole,
  // isKnownUserRole, // Unused import, TODO: Remove if not used elsewhere
  UserRolesArray,
} from '@/features/auth/user-role';
import {
  getNotificationService,
  isNotificationServiceAvailable,
} from '@/features/notifications/services/notification-service-loader';
// import { logger } from '@/lib/logger'; // Unused import, TODO: Prefer native Next.js logger or edge runtime logging

/**
 * POST handler for /api/notifications/[id]/read
 * Handles marking a specific notification as read.
 *
 * TODO: Refactor logs to use Next.js 16 edge runtime logging API (`console` is allowed,
 * but consider wrapper for structured logs).
 * TODO: Explore usage of the `cache:false` export for route cache control
 * https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions#caching
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Initiate database connection and opt out of prerendering for dynamic route
  await connection();

  // (1) Start request logging, TODO: Use structured logs or tracing id for traceability
  console.log('API: /api/notifications/[id]/read - Starting POST request');

  try {
    // (2) Session authentication: Verify user session from request context
    // TODO: Use server actions authentication helpers when stable
    const session = await auth();

    // (2a) Handle missing/invalid session
    if (!session || !session.user) {
      // Unauthorized attempt to mark notification as read
      console.log('API: /api/notifications/[id]/read - Unauthorized access attempt');
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // (3) Extract identifiers from session and params
    // User id from session
    const userId = session.user.id;

    // Validate and normalize user role
    const userRole = assertKnownUserRole(session.user.role as UserRolesArray);

    // Notification id from API route
    const notificationId = params.id;

    // (4) Authenticated request log context
    console.log('API: /api/notifications/[id]/read - User authenticated', {
      userId,
      role: userRole,
      notificationId,
    });

    // (5) Validate notification id in route params
    if (!notificationId) {
      console.log('API: /api/notifications/[id]/read - No notification ID provided');
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    // (6) Check backend support for notifications
    if (!isNotificationServiceAvailable()) {
      // STUB: This branch is for environments (e.g., psql-only mode) where notifications feature is not yet ready.
      // TODO: Remove when notification service is universally supported
      console.log(
        'API: /api/notifications/[id]/read - Notifications not supported in PostgreSQL-only mode'
      );
      return NextResponse.json(
        {
          success: true,
          message:
            'Notifications not available in PostgreSQL-only mode (feature in development)',
        },
        { status: 200 }
      );
    }

    // (7) Business logic: Mark notification as read if service is available
    console.log('API: /api/notifications/[id]/read - Marking notification as read', {
      notificationId,
      userId,
    });

    // TODO: Migrate to server actions if possible for atomicity and SSR streaming
    const notificationService = getNotificationService();

    // Mark the notification as read for the specific user
    // TODO: Add return value/confirmation for logging and robust client feedback
    await notificationService.markNotificationAsRead(notificationId, userId);

    // (8) Respond to client on success
    console.log(
      'API: /api/notifications/[id]/read - Notification marked as read successfully'
    );
    return NextResponse.json(
      {
        success: true,
        message: 'Notification marked as read',
      },
      { status: 200 }
    );
  } catch (error) {
    // (9) General error handling: log and return appropriate HTTP status
    // TODO: Use error data shape and codes that are more structured for clients
    console.error('API: /api/notifications/[id]/read - Error occurred:', error);

    if (error instanceof Error) {
      // Handling known error messages returned from notificationService
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
    // Handle unexpected or internal errors
    return NextResponse.json(
      {
        error: 'Failed to mark notification as read. Please try again later.',
      },
      { status: 500 }
    );
  }
}

/**
 * Prevent caching for this route.
 * TODO: Explicitly set route export const dynamic = "force-dynamic" for Next.js 16+ 
 * to ensure NO cache is used for this endpoint (SSR, not ISR nor static).
 * See: https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes#dynamic-route-segments
 */
