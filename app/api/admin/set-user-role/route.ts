import { NextRequest, NextResponse, connection } from 'next/server';
import { auth } from '@/auth';
import { isKnownUserRole, isPlatformAdmin } from '@/features/auth/user-role';
import { setUserRole } from '@/features/auth/services/user-management';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  // Opt out of Next.js 16 prerendering for this route.
  // TODO: Verify if connection() can be replaced with new Next.js 16 data fetching primitives in future, if available.
  await connection();

  try {
    // Step 1: Authenticate the request. Only signed-in users should proceed.
    const session = await auth();

    // Step 2: Check authentication. Deny if no user in session.
    if (!session?.user?.id) {
      // Log unauthorized attempts for auditing.
      console.log('API: /api/set-user-role - Unauthorized access attempt');
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Step 3: Authorization - Only platform admins can change user roles.
    if (!isPlatformAdmin(session.user.role)) {
      // Log denied access attempts with user and role.
      console.log(`API: /api/set-user-role - Access denied for user ${session.user.id} with role ${session.user.role}`);
      return NextResponse.json(
        { message: 'Forbidden: Only administrators can change user roles' },
        { status: 403 }
      );
    }

    // Step 4: Parse body and check required fields.
    // TODO: Consider using Next.js 16 request validation middleware or zod for schema validation.
    const body = await req.json();
    const { uid, role } = body;

    // Step 5: Enforce both uid and role present in body.
    if (!uid || !role) {
      return NextResponse.json({ message: 'Missing uid or role' }, { status: 400 });
    }

    // Step 6: Validate the provided role.
    if (!isKnownUserRole(role)) {
      // Explicitly state valid roles for guidance.
      return NextResponse.json(
        { message: 'Invalid role. Valid roles are: visitor, subscriber, member, confidential, admin, superadmin' },
        { status: 400 }
      );
    }

    // Step 7: Prevent admin self-demotion unless another admin can promote.
    // TODO: Consider checking if there are other platform admins in the system before blocking self-demotion.
    if (
      session.user.id === uid &&
      isPlatformAdmin(session.user.role) &&
      !isPlatformAdmin(role)
    ) {
      console.log(`API: /api/set-user-role - Admin ${session.user.id} attempted self-demotion`);
      return NextResponse.json(
        { message: 'Warning: Admin self-demotion prevented. Please contact another administrator.' },
        { status: 400 }
      );
    }

    // Step 8: Proceed to assign role.
    console.log(`API: /api/set-user-role - Admin ${session.user.id} changing role for user ${uid} to ${role}`);
    await setUserRole(uid, role);

    // Step 9: Success response.
    return NextResponse.json(
      {
        message: 'Role set successfully',
        updatedBy: session.user.id,
        targetUser: uid,
        newRole: role
      },
      { status: 200 }
    );
  } catch (error) {
    // Step 10: Catch-all error logging and handling.
    logger.error('API: /api/set-user-role - Error setting role:', error);
    return NextResponse.json(
      {
        message: 'Error setting role',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}