import { NextRequest, NextResponse, connection } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getNotificationService, isNotificationServiceAvailable } from '@/features/notifications/services/notification-service-loader';
import { getUserNotifications, getNotificationStats } from '@/features/notifications/services/notification-service';
import { UserRolesArray, assertKnownUserRole } from '@/features/auth/user-role';
import { userMigrationService } from '@/features/auth/services/user-migration';
import {
  NotificationType,
  NotificationPriority,
  CreateNotificationRequest,
} from '@/features/notifications/types';
import { apiRateLimiter } from '@/lib/security/rate-limiter';

// -----------------------------------------------------------------------------
// Helper: Extract values from TypeScript enums (for Zod validation)
// -----------------------------------------------------------------------------
const notificationTypeValues = Object.values(NotificationType) as [string, ...string[]];
const notificationPriorityValues = Object.values(NotificationPriority) as [string, ...string[]];

// -----------------------------------------------------------------------------
// Zod schema: Validates incoming notification creation requests (for POST)
// -----------------------------------------------------------------------------
const createNotificationSchema = z.object({
  // Mandatory fields per business requirements
  title: z.string().min(1, 'title is required'),
  body: z.string().min(1, 'body is required'),
  type: z.enum(notificationTypeValues),

  // Optional fields matching CreateNotificationRequest interface
  userId: z.string().optional(),
  userIds: z.array(z.string()).optional(),
  priority: z.enum(notificationPriorityValues).default(NotificationPriority.NORMAL),
  data: z.record(z.string(), z.unknown()).optional(),
  channels: z.array(z.string()).optional(),
  scheduledFor: z.union([z.string(), z.date()]).optional(),
  expiresAt: z.union([z.string(), z.date()]).optional(),
  actionText: z.string().optional(),
  actionUrl: z.string().optional(),
  templateId: z.string().optional(),
  // Add passthrough for extra fields (if required for forwards-compat)
}).passthrough();

/**
 * GET /api/notifications handler
 * Returns notifications for the authenticated user, or stats if queried with ?stats=true
 */
export async function GET(req: NextRequest) {
  // Next.js 16: Opt out of prerendering/static caching for this route
  await connection();

  console.log('API: /api/notifications - Starting GET request');

  try {
    // ----- [1] Rate limit the client by IP -----
    // TODO: Use new Next.js middleware 'rateLimit()' if/when native support lands (see Next.js RFC)
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    if (apiRateLimiter.isRateLimited(clientIp)) {
      // If client exceeded rate limit, respond with 429 and rate limit headers
      const resetTime = apiRateLimiter.getResetTime(clientIp);
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

      console.warn(`⚠️ Rate limit exceeded for notifications API: ${clientIp}`);

      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(resetTime).toISOString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    // ----- [2] Authenticate session -----
    // TODO: When Next.js App Router native authentication (e.g. Auth.js serverActions) becomes available, refactor to use native.
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/notifications - Unauthorized access attempt');
      // User must be authenticated to fetch notifications
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    // Ensure user role is known and fallback gracefully to 'subscriber'
    const userRole = assertKnownUserRole(session.user.role as UserRolesArray) || UserRolesArray.subscriber;

    // ----- [3] Ensure User Document Exists -----
    // Defensive check: if user doc does not exist, create/migrate it, but continue even if migration fails (graceful degradation)
    try {
      const userExists = await userMigrationService.userDocumentExists(userId);
      if (!userExists) {
        console.warn('API: /api/notifications - User document missing, initializing', { userId });
        await userMigrationService.ensureUserDocument(session.user as any);
        console.log('API: /api/notifications - User document created successfully', { userId });
      }
    } catch (migrationError) {
      // STUB: In production, consider notifying SRE about migration errors
      console.error('API: /api/notifications - Failed to check/create user document:', migrationError);
      // Continue anyway; API will handle missing user doc gracefully
    }

    // ----- [4] Parse and validate query parameters -----
    const searchParams = req.nextUrl.searchParams;
    // Query param: How many notifications to return (with hard default min/max enforced server-side elsewhere)
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const startAfter = searchParams.get('startAfter') || undefined; // For pagination
    const unreadOnly = searchParams.get('unreadOnly') === 'true'; // Filter by unread status
    const stats = searchParams.get('stats') === 'true'; // If stats=true, return notification stats instead of notifications
    const typesParam = searchParams.get('types'); // Optional filter for notification types (comma-separated string)
    const types = typesParam ? (typesParam.split(',') as NotificationType[]) : undefined;

    console.log('API: /api/notifications - Query params:', {
      limit,
      startAfter,
      unreadOnly,
      stats,
      types,
    });

    // ----- [5] Check Notification Service Availability -----
    // If notifications not supported in this deployment mode (e.g., running with only PostgreSQL), return early.
    if (!isNotificationServiceAvailable()) {
      return NextResponse.json(
        {
          notifications: [],
          unreadCount: 0,
          hasMore: false,
          message: 'Notifications not available in PostgreSQL-only mode',
        },
        { status: 200 }
      );
    }

    const notificationService = getNotificationService();

    // ----- [6] If stats requested, return notification stats instead of notifications -----
    if (stats) {
      // Defensive: double-check notificationService available
      if (!notificationService) {
        return NextResponse.json(
          {
            unreadCount: 0,
            totalCount: 0,
            message: 'Notifications not available in PostgreSQL-only mode',
          },
          { status: 200 }
        );
      }
      // Delegate stats fetch to service
      const notificationStats = await getNotificationStats(userId);
      console.log('API: /api/notifications - Stats retrieved');
      return NextResponse.json(notificationStats, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    }

    // ----- [7] Fetch notifications for user -----
    console.log('API: /api/notifications - Fetching notifications from service');
    const result = await getUserNotifications(userId, {
      limit,
      startAfter,
      unreadOnly,
      types,
    });

    // Log notification retrieval for auditing/troubleshooting
    console.log('API: /api/notifications - Notifications retrieved:', {
      count: result.notifications.length,
      unreadCount: result.unreadCount,
      hasMore: result.hasMore,
    });

    // ----- [8] Respond with notifications -----
    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    // ----- [Error Handling] -----
    console.error('API: /api/notifications - Error occurred:', error);

    // Handle permission-denied errors (e.g., Firestore/Database rules)
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json(
          { error: 'Access denied: Forbidden' },
          { status: 403 }
        );
      }
    }

    // Generic fallback for all other errors
    return NextResponse.json(
      { error: 'Unable to fetch notifications: Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications handler
 * Allows admins to create a new notification (manual/system message)
 */
export async function POST(req: NextRequest) {
  // Next.js 16: Opt out of prerendering (ensures request isn't cached)
  await connection();

  console.log('API: /api/notifications - Starting POST request');

  try {
    // ----- [1] Authenticate session -----
    // TODO: Refactor to Next.js App Router's serverAction or useServerAction() authentication when GA
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/notifications - Unauthorized access attempt');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = assertKnownUserRole(session.user.role as UserRolesArray);

    console.log('API: /api/notifications - User authenticated', {
      userId,
      role: userRole,
    });

    // ----- [2] Ensure admin/superadmin role -----
    // Only administrators may send manual notifications via this API
    if (userRole !== UserRolesArray.admin && userRole !== UserRolesArray.superadmin) {
      console.log('API: /api/notifications - Access denied for user', {
        userId,
        role: userRole,
      });
      return NextResponse.json(
        {
          error:
            'Access denied. Only administrators can create notifications manually.',
        },
        { status: 403 }
      );
    }

    // ----- [3] Validate body payload with schema -----
    // TODO: Consider moving validation logic into edge middleware if native in future Next.js
    const raw = await req.json();
    const parsed = createNotificationSchema.safeParse(raw);

    if (!parsed.success) {
      console.log('API: /api/notifications - Invalid data provided', {
        error: parsed.error.issues[0]?.message,
      });
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            'Invalid notification data. Title, body, and type are required.',
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ----- [4] Shape request for notification service layer -----
    // Ensures correct types and handles legacy compatibility as needed
    const notificationRequest: CreateNotificationRequest = {
      userId: data.userId,
      userIds: data.userIds,
      type: data.type as NotificationType,
      priority: data.priority as NotificationPriority,
      title: data.title,
      body: data.body,
      data: data.data || {},
      channels: data.channels as any,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      actionText: data.actionText,
      actionUrl: data.actionUrl,
      templateId: data.templateId,
    };

    console.log('API: /api/notifications - Creating notification', {
      type: notificationRequest.type,
      targetUsers:
        notificationRequest.userIds?.length ||
        (notificationRequest.userId ? 1 : 0),
    });

    // ----- [5] Ensure notification service available -----
    if (!isNotificationServiceAvailable()) {
      return NextResponse.json(
        {
          error: 'Notifications not available in PostgreSQL-only mode',
        },
        { status: 503 }
      );
    }

    // TODO: Wrap notification creation call in serverAction (React 19) when supported, to enable built-in transitions/optimistic updates.

    // Actually create the notification (delegated to implementation-specific service)
    // TODO: Make this service call transactional/atomic if possible (using native Next.js Server Actions transactions when stable)
    const notificationService = getNotificationService();
    const notification = await notificationService.createNotification(notificationRequest);

    // ----- [6] Return created notification -----
    console.log('API: /api/notifications - Notification created successfully', {
      notificationId: notification.id,
    });
    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    // ----- [Error Handling] -----
    console.error('API: /api/notifications - Error occurred:', error);

    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json(
          { error: 'Permission denied to create notification' },
          { status: 403 }
        );
      }
      if (error.message.includes('No target users specified')) {
        return NextResponse.json(
          { error: 'No target users specified for notification' },
          { status: 400 }
        );
      }
    }

    // All other (unexpected) errors
    return NextResponse.json(
      { error: 'Failed to create notification. Please try again later.' },
      { status: 500 }
    );
  }
}

/**
 * Prevent Caching for /api/notifications (route-level)
 * This is important because Next.js 15+ static caching by default;
 * notifications are by nature dynamic/user-specific and *must not* be cached.
 */
// TODO: When supported, use Next.js 16 export const dynamic = 'force-dynamic' (or 'auto') in app routes for non-cacheable APIs.
