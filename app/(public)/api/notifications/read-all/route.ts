import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getNotificationService, isNotificationServiceAvailable } from '@/features/notifications/services/notification-service-loader';
import { UserRole } from '@/features/auth/types';

/**
 * POST handler for /api/notifications/read-all
 * Marks all notifications as read for the authenticated user
 */
export async function POST(req: NextRequest) {
  console.log('API: /api/notifications/read-all - Starting POST request');

  try {
    // Step 1: Authenticate the session
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/notifications/read-all - Unauthorized access attempt');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role as UserRole;

    console.log('API: /api/notifications/read-all - User authenticated', { 
      userId, 
      role: userRole 
    });

    // Step 2: Check if notification service is available
    if (!isNotificationServiceAvailable()) {
      return NextResponse.json({ 
        success: true,
        message: 'Notifications not available in PostgreSQL-only mode',
        markedCount: 0
      }, { status: 200 });
    }

    // Step 3: Mark all notifications as read
    console.log('API: /api/notifications/read-all - Marking all notifications as read', { userId });

    const notificationService = getNotificationService();
    const markedCount = await notificationService.markAllNotificationsAsRead(userId);

    // Step 3: Return success response
    console.log('API: /api/notifications/read-all - All notifications marked as read successfully', { 
      markedCount 
    });
    return NextResponse.json({ 
      success: true,
      message: `${markedCount} notifications marked as read`,
      markedCount
    }, { status: 200 });

  } catch (error) {
    // Error handling
    console.error('API: /api/notifications/read-all - Error occurred:', error);
    
    return NextResponse.json({ 
      error: 'Failed to mark all notifications as read. Please try again later.' 
    }, { status: 500 });
  }
}

/**
 * Prevent caching for this route
 */
export const dynamic = 'force-dynamic';

/**
 * Configuration for the API route
 */
export const config = {
  runtime: 'nodejs',
}; 