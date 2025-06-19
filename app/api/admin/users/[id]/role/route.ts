import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminDb } from '@/lib/firebase-admin.server';
import { UserRole } from '@/features/auth/types';

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

    const { role } = await request.json();

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Update user role in Firestore
    const db = getAdminDb();
    const userRef = db.collection('users').doc(id);
    
    await userRef.update({
      role,
      updatedAt: new Date()
    });

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