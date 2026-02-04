import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService';

export async function DELETE(
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

    // Prevent admin from deleting themselves
    if (session.user.id === id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    await initializeDatabase();
    const db = getDatabaseService();

    // Check if user exists
    const userResult = await db.read('users', id);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete the user
    const deleteResult = await db.delete('users', id);
    if (!deleteResult.success) {
      throw deleteResult.error || new Error('Failed to delete user');
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 