import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/database';
import { isPlatformAdmin, isKnownUserRole } from '@/features/auth/user-role';

type UserRow = Record<string, unknown> & { id: string };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Ensure no prerendering for this handler in Next.js 16  
  await connection();

  try {
    // Extract user ID from route parameters (async, as params is a Promise)
    const { id } = await params;

    // Retrieve current session/auth info
    const session = await auth();

    // Ensure the requestor is authenticated and has admin/superadmin privileges
    if (!session?.user || !isPlatformAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse new role from JSON request body
    const { role } = await request.json();

    // Validate that the requested role is recognized by the system
    if (!isKnownUserRole(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Fetch user data from the database to ensure the user exists
    const userResult = await db().readDoc<UserRow>('users', id);
    if (!userResult.success || !userResult.data) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userResult.data;

    // Prepare updated user data with the new role and fresh timestamp
    const updatedUserData = {
      ...userData,
      role,
      updated_at: new Date() // TODO: Consider using a consistent date/time util if used throughout app
    };

    // Commit the data update back to the database
    const updateResult = await db().updateDoc('users', id, updatedUserData);
    if (!updateResult.success) {
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
      );
    }

    // Success response
    return NextResponse.json({
      success: true,
      message: 'User role updated successfully'
    });

  } catch (error) {
    // Log and return a generic error response
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// TODO: `params` is currently typed as a Promise. See if Next.js 16 provides a way to use the Route Handler context pattern directly and avoid needing to resolve a params Promise, improving readability and type-safety.
// TODO: Evaluate Zod or another schema validator for input validation to ensure extendability and type-safety for more complex requests.