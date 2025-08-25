import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { 
  getUserNotifications, 
  createNotification, 
  getNotificationStats 
} from '@/features/notifications/services/notification-service';
import { UserRole } from '@/features/auth/types';
import { 
  NotificationType, 
  NotificationPriority,
  CreateNotificationRequest 
} from '@/features/notifications/types';
import { apiRateLimiter } from '@/lib/security/rate-limiter';

/**
 * GET handler for /api/notifications
 * Fetches a list of notifications for the authenticated user
 */
export async function GET(req: NextRequest) {
  console.log('API: /api/notifications - Starting GET request');

  try {
    // SECURITY: Apply rate limiting to prevent abuse
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    
    if (apiRateLimiter.isRateLimited(clientIp)) {
      const resetTime = apiRateLimiter.getResetTime(clientIp)
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
      
      console.warn(`⚠️ Rate limit exceeded for notifications API: ${clientIp}`)
      
      return NextResponse.json(
        { 
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(resetTime).toISOString(),
            'Retry-After': retryAfter.toString()
          }
        }
      )
    }
    
    // Step 1: Authenticate the session
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/notifications - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = (session.user.role as UserRole) || UserRole.SUBSCRIBER;

    console.log('API: /api/notifications - Session checked', {
      userId,
      role: userRole,
    });

    // Step 2: Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const startAfter = searchParams.get('startAfter') || undefined;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const stats = searchParams.get('stats') === 'true';
    const typesParam = searchParams.get('types');
    const types = typesParam ? typesParam.split(',') as NotificationType[] : undefined;

    console.log('API: /api/notifications - Query params:', { 
      limit, 
      startAfter, 
      unreadOnly, 
      stats,
      types 
    });

    // Step 3: Get stats if requested
    if (stats) {
      const notificationStats = await getNotificationStats(userId);
      console.log('API: /api/notifications - Stats retrieved');
      return NextResponse.json(notificationStats, { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Step 4: Fetch notifications via service
    console.log('API: /api/notifications - Fetching notifications from service');
    const result = await getUserNotifications(userId, {
      limit,
      startAfter,
      unreadOnly,
      types
    });

    // Step 5: Log the result
    console.log('API: /api/notifications - Notifications retrieved:', {
      count: result.notifications.length,
      unreadCount: result.unreadCount,
      hasMore: result.hasMore,
    });

    // Step 6: Return the notifications
    return NextResponse.json(result, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    // Step 7: Error handling
    console.error('API: /api/notifications - Error occurred:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json(
          { error: 'Access denied: Forbidden' },
          { status: 403 }
        );
      }
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Unable to fetch notifications: Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for /api/notifications
 * Creates a new notification (admin only for system notifications)
 */
export async function POST(req: NextRequest) {
  console.log('API: /api/notifications - Starting POST request');

  try {
    // Step 1: Authenticate the session
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/notifications - Unauthorized access attempt');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role as UserRole;

    console.log('API: /api/notifications - User authenticated', { userId, role: userRole });

    // Step 2: Check user permissions (for manual notification creation)
    // Only admins can create manual notifications via API
    if (userRole !== UserRole.ADMIN) {
      console.log('API: /api/notifications - Access denied for user', { userId, role: userRole });
      return NextResponse.json({ 
        error: 'Access denied. Only administrators can create notifications manually.' 
      }, { status: 403 });
    }

    // Step 3: Validate and process the incoming data
    const data = await req.json();
    
    if (!data.title || !data.body || !data.type) {
      console.log('API: /api/notifications - Invalid data provided', { data });
      return NextResponse.json({ 
        error: 'Invalid notification data. Title, body, and type are required.' 
      }, { status: 400 });
    }

    // Step 4: Validate notification type
    if (!Object.values(NotificationType).includes(data.type)) {
      return NextResponse.json({ 
        error: 'Invalid notification type.' 
      }, { status: 400 });
    }

    // Step 5: Create the notification
    const notificationRequest: CreateNotificationRequest = {
      userId: data.userId,
      userIds: data.userIds,
      type: data.type,
      priority: data.priority || NotificationPriority.NORMAL,
      title: data.title,
      body: data.body,
      data: data.data || {},
      channels: data.channels,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      actionText: data.actionText,
      actionUrl: data.actionUrl,
      templateId: data.templateId
    };

    console.log('API: /api/notifications - Creating notification', { 
      type: notificationRequest.type,
      targetUsers: notificationRequest.userIds?.length || (notificationRequest.userId ? 1 : 0)
    });

    const notification = await createNotification(notificationRequest);

    // Step 6: Return the created notification
    console.log('API: /api/notifications - Notification created successfully', { 
      notificationId: notification.id 
    });
    return NextResponse.json(notification, { status: 201 });

  } catch (error) {
    // Error handling
    console.error('API: /api/notifications - Error occurred:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        return NextResponse.json({ 
          error: 'Permission denied to create notification' 
        }, { status: 403 });
      }
      if (error.message.includes('No target users specified')) {
        return NextResponse.json({ 
          error: 'No target users specified for notification' 
        }, { status: 400 });
      }
    }

    return NextResponse.json({ 
      error: 'Failed to create notification. Please try again later.' 
    }, { status: 500 });
  }
}

/**
 * Prevent caching for this route
 * This is important in Next.js 15 as the default caching behavior has changed
 */
export const dynamic = 'force-dynamic';

/**
 * Configuration for the API route
 */
export const config = {
  runtime: 'nodejs',
}; 