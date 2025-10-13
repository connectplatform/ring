import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabaseService, initializeDatabase } from '@/lib/database';
import { UserRole } from '@/features/auth/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    // Check authentication and admin/superadmin role
    if (!session?.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { role } = await request.json();

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
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

    // Update user role
    const updatedUserData = {
      ...userData,
      role,
      updated_at: new Date()
    };

    const updateResult = await dbService.update('users', id, updatedUserData);
    if (!updateResult.success) {
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'User role updated successfully' 
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 