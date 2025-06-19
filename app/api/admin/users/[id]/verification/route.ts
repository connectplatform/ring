import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAdminDb } from '@/lib/firebase-admin.server';

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

    // Update user verification status in Firestore
    const db = getAdminDb();
    const userRef = db.collection('users').doc(id);
    
    await userRef.update({
      isVerified,
      updatedAt: new Date()
    });

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