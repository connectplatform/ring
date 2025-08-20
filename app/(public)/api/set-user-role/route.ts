import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { setUserRole } from '@/features/auth/services/user-management';

export async function POST(req: NextRequest) {
  try {
    // CRITICAL: Authenticate the user first
    const session = await auth();
    
    if (!session?.user?.id) {
      console.log('API: /api/set-user-role - Unauthorized access attempt');
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // CRITICAL: Only admins can change user roles
    if (session.user.role !== 'admin') {
      console.log(`API: /api/set-user-role - Access denied for user ${session.user.id} with role ${session.user.role}`);
      return NextResponse.json({ 
        message: 'Forbidden: Only administrators can change user roles' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { uid, role } = body;

    if (!uid || !role) {
      return NextResponse.json({ message: 'Missing uid or role' }, { status: 400 });
    }

    // Validate role value
    const validRoles = ['visitor', 'subscriber', 'member', 'confidential', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ 
        message: 'Invalid role. Valid roles are: ' + validRoles.join(', ') 
      }, { status: 400 });
    }

    // Prevent self-demotion from admin (unless there are other admins)
    if (session.user.id === uid && session.user.role === 'admin' && role !== 'admin') {
      console.log(`API: /api/set-user-role - Admin ${session.user.id} attempted self-demotion`);
      return NextResponse.json({ 
        message: 'Warning: Admin self-demotion prevented. Please contact another administrator.' 
      }, { status: 400 });
    }

    console.log(`API: /api/set-user-role - Admin ${session.user.id} changing role for user ${uid} to ${role}`);
    
    await setUserRole(uid, role);
    
    return NextResponse.json({ 
      message: 'Role set successfully',
      updatedBy: session.user.id,
      targetUser: uid,
      newRole: role
    }, { status: 200 });
    
  } catch (error) {
    console.error('API: /api/set-user-role - Error setting role:', error);
    return NextResponse.json({ 
      message: 'Error setting role', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}