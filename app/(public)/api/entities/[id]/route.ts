import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; // Session handling consistent with list route
import { deleteEntity } from '@/features/entities/services/delete-entity';
import { getEntityById } from '@/features/entities/services/get-entity-by-id';
import { updateEntity } from '@/features/entities/services/update-entity';
import { UserRole } from '@/features/auth/types';
import { RouteHandlerProps } from '@/types/next-page';

/**
 * Checks if a user has confidential access based on their role.
 * @param user - The user session object.
 * @returns {boolean} True if the user has confidential access.
 */
async function hasConfidentialAccess(user: any): Promise<boolean> {
  if (!user) return false;
  return ['admin', 'confidential'].includes(user.role as UserRole);
}

/**
 * Checks if a user has admin privileges.
 * @param user - The user session object.
 * @returns {boolean} True if the user is an admin.
 */
function isAdmin(user: any): boolean {
  if (!user) return false;
  return user.role === 'admin';
}

/**
 * Handle GET: Retrieve a single entity by ID.
 * 
 * @param req - The request object
 * @param context - The context object containing the route parameters
 * @returns A response with the entity or an error
 */
export async function GET(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  console.log('API: /api/entities/[id] - Processing GET request');
  
  // Get the ID from the route params (Next.js 15 style)
  const params = await context.params;
  const { id } = params;
  
  console.log('GET function called with params:', { id });

  try {
    // Authenticate the user
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch entity by ID
    const entity = await getEntityById(id);
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Confidential access check
    const isConfidential = await hasConfidentialAccess(session.user);
    if (!isConfidential && entity.visibility === 'confidential') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('API: /api/entities/[id] - Entity retrieved successfully');
    return NextResponse.json(entity, { status: 200 });
  } catch (error) {
    console.error('API: /api/entities/[id] - Error fetching entity:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Handle PUT: Update an existing entity by ID.
 * 
 * @param req - The request object
 * @param context - The context object containing the route parameters
 * @returns A response with the updated entity or an error
 */
export async function PUT(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  console.log('API: /api/entities/[id] - Processing PUT request');
  
  // Get the ID from the route params (Next.js 15 style)
  const params = await context.params;
  const { id } = params;

  try {
    // Authenticate the user
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract request body
    const body = await req.json();
    const isConfidential = await hasConfidentialAccess(session.user);

    // Confidential role handling
    if (isConfidential && body.visibility === 'confidential') {
      console.log('API: /api/entities/[id] - Updating confidential entity');
      // Add any additional checks/processing here for confidential entities
    }

    // Update the entity
    const updateSuccess = await updateEntity(id, body);
    if (!updateSuccess) {
      return NextResponse.json({ error: 'Entity update failed' }, { status: 400 });
    }

    // Retrieve the updated entity
    const updatedEntity = await getEntityById(id);
    if (!updatedEntity) {
      return NextResponse.json({ error: 'Entity not found after update' }, { status: 404 });
    }

    console.log('API: /api/entities/[id] - Entity updated successfully');
    return NextResponse.json(updatedEntity, { status: 200 });
  } catch (error) {
    console.error('API: /api/entities/[id] - Error updating entity:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Handle DELETE: Delete an entity by ID.
 * 
 * @param req - The request object
 * @param context - The context object containing the route parameters
 * @returns A response with a success message or an error
 */
export async function DELETE(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  console.log('API: /api/entities/[id] - Processing DELETE request');
  
  // Get the ID from the route params (Next.js 15 style)
  const params = await context.params;
  const { id } = params;

  try {
    // Authenticate the user
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Confidential role handling
    const isConfidential = await hasConfidentialAccess(session.user);
    if (isConfidential) {
      console.log('API: /api/entities/[id] - Deleting confidential entity');
      // Add any additional checks/logic for confidential deletion, if necessary
    }

    // Delete the entity
    const success = await deleteEntity(id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete entity' }, { status: 400 });
    }

    console.log('API: /api/entities/[id] - Entity deleted successfully');
    return NextResponse.json({ message: 'Entity deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('API: /api/entities/[id] - Error deleting entity:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}