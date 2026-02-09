import { NextRequest, NextResponse, connection} from 'next/server';
import { auth } from '@/auth';
import { getNotificationService, isNotificationServiceAvailable } from '@/features/notifications/services/notification-service-loader';
import { UserRole } from '@/features/auth/types';
import { DetailedNotificationPreferences } from '@/features/notifications/types';

/**
 * GET handler for /api/notifications/preferences
 * Fetches notification preferences for the authenticated user
 */
export async function GET(req: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  console.log('API: /api/notifications/preferences - Starting GET request');

  try {
    // Step 1: Authenticate the session
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/notifications/preferences - Unauthorized access attempt');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role as UserRole;

    console.log('API: /api/notifications/preferences - User authenticated', { 
      userId, 
      role: userRole 
    });

    // Step 2: Check if notification service is available
    if (!isNotificationServiceAvailable()) {
      const defaultPreferences: Partial<DetailedNotificationPreferences> = {
        enabled: false,
        channels: { inApp: false, email: false, sms: false, push: false },
        language: 'en',
        updatedAt: new Date()
      };
      return NextResponse.json(defaultPreferences, { status: 200 });
    }

    // Step 3: Get user preferences
    console.log('API: /api/notifications/preferences - Fetching preferences', { userId });

    const notificationService = getNotificationService();
    const preferences = await notificationService.getUserNotificationPreferences(userId);

    // Step 3: Return preferences (or default if none exist)
    if (!preferences) {
      // Return default preferences if none exist
      const defaultPreferences: Partial<DetailedNotificationPreferences> = {
        enabled: true,
        channels: {
          inApp: true,
          email: true,
          sms: false,
          push: false
        },
        language: 'en',
        updatedAt: new Date()
      };
      
      console.log('API: /api/notifications/preferences - No preferences found, returning defaults');
      return NextResponse.json(defaultPreferences, { status: 200 });
    }

    console.log('API: /api/notifications/preferences - Preferences retrieved successfully');
    return NextResponse.json(preferences, { status: 200 });

  } catch (error) {
    // Error handling
    console.error('API: /api/notifications/preferences - Error occurred:', error);
    
    return NextResponse.json({ 
      error: 'Failed to fetch notification preferences. Please try again later.' 
    }, { status: 500 });
  }
}

/**
 * PUT handler for /api/notifications/preferences
 * Updates notification preferences for the authenticated user
 */
export async function PUT(req: NextRequest) {
  await connection() // Next.js 16: opt out of prerendering

  console.log('API: /api/notifications/preferences - Starting PUT request');

  try {
    // Step 1: Authenticate the session
    const session = await auth();
    if (!session || !session.user) {
      console.log('API: /api/notifications/preferences - Unauthorized access attempt');
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role as UserRole;

    console.log('API: /api/notifications/preferences - User authenticated', { 
      userId, 
      role: userRole 
    });

    // Step 2: Parse and validate the incoming data
    const data = await req.json();
    
    if (!data || typeof data !== 'object') {
      console.log('API: /api/notifications/preferences - Invalid data provided', { data });
      return NextResponse.json({ 
        error: 'Invalid preferences data provided.' 
      }, { status: 400 });
    }

    // Step 3: Check if notification service is available
    if (!isNotificationServiceAvailable()) {
      return NextResponse.json({ 
        success: true,
        message: 'Notifications not available in PostgreSQL-only mode' 
      }, { status: 200 });
    }

    // Step 4: Update user preferences
    console.log('API: /api/notifications/preferences - Updating preferences', { 
      userId,
      preferences: data 
    });

    const notificationService = getNotificationService();
    await notificationService.updateUserNotificationPreferences(userId, data);

    // Step 4: Return success response
    console.log('API: /api/notifications/preferences - Preferences updated successfully');
    return NextResponse.json({ 
      success: true,
      message: 'Notification preferences updated successfully'
    }, { status: 200 });

  } catch (error) {
    // Error handling
    console.error('API: /api/notifications/preferences - Error occurred:', error);
    
    return NextResponse.json({ 
      error: 'Failed to update notification preferences. Please try again later.' 
    }, { status: 500 });
  }
}

/**
 * Prevent caching for this route
 */

