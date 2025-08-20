import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/auth';
import { markNotificationAsRead } from '@/features/notifications/services/notification-service';
import { UserRole } from '@/features/auth/types';

/**
 * POST handler for /api/notifications/[id]/read
 * Marks a specific notification as read
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('API: /api/notifications/[id]/read - Starting POST request');

  try {
    // Step 1: Authenticate the session
    const session = await getServerAuthSession();
    if (!session || !session.user) {
      console.log('API: /api/notifications/[id]/read - Unauthorized access attempt');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role as UserRole;
    const notificationId = params.id;

    console.log('API: /api/notifications/[id]/read - User authenticated', { 
      userId, 
      role: userRole,
      notificationId 
    });

    // Step 2: Validate notification ID
    if (!notificationId) {
      console.log('API: /api/notifications/[id]/read - No notification ID provided');
      return NextResponse.json({ 
        error: 'Notification ID is required' 
      }, { status: 400 });
    }

    // Step 3: Mark notification as read
    console.log('API: /api/notifications/[id]/read - Marking notification as read', { 
      notificationId,
      userId 
    });

    await markNotificationAsRead(notificationId, userId);

    // Step 4: Return success response
    console.log('API: /api/notifications/[id]/read - Notification marked as read successfully');
    return NextResponse.json({ 
      success: true,
      message: 'Notification marked as read'
    }, { status: 200 });

  } catch (error) {
    // Error handling
    console.error('API: /api/notifications/[id]/read - Error occurred:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Notification not found')) {
        return NextResponse.json({ 
          error: 'Notification not found' 
        }, { status: 404 });
      }
      if (error.message.includes('Unauthorized access')) {
        return NextResponse.json({ 
          error: 'Unauthorized access to notification' 
        }, { status: 403 });
      }
    }

    return NextResponse.json({ 
      error: 'Failed to mark notification as read. Please try again later.' 
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