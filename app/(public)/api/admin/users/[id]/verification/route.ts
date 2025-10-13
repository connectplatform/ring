import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    // Check authentication and admin role
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { isVerified } = await request.json();

    // Validate input
    if (typeof isVerified !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid verification status' },
        { status: 400 }
      );
    }

    // Initialize database service
    const initResult = await initializeDatabase();
    if (!initResult.success) {
      return NextResponse.json(
        { error: 'Database initialization failed' },
        { status: 500 }
      );
    }

    const dbService = getDatabaseService();

    // Read current user data
    const userResult = await dbService.read('users', id);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userResult.data.data || userResult.data;

    // Update user verification status
    const updatedUserData = {
      ...userData,
      is_verified: isVerified,
      updated_at: new Date()
    };

    const updateResult = await dbService.update('users', id, updatedUserData);
    if (!updateResult.success) {
      return NextResponse.json(
        { error: 'Failed to update user verification status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'User verification status updated successfully' 
    });

  } catch (error) {
    console.error('Error updating user verification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 