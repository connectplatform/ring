import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; // Auth.js session handling
import { deleteOpportunity } from '@/services/opportunities/delete-opportunity';
import { getOpportunityById } from '@/services/opportunities/get-opportunity-by-id';
import { updateOpportunity } from '@/services/opportunities/update-opportunity';
import { UserRole } from '@/features/auth/types';
import { Opportunity, OpportunityVisibility } from '@/features/opportunities/types';
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
 * Handle GET: Retrieve a single opportunity by ID.
 * 
 * @param req - The request object
 * @param context - The context object containing the route parameters
 * @returns A response with the opportunity or an error
 */
export async function GET(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  console.log('API: /api/opportunities/[id] - Processing GET request');
  
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

    // Fetch opportunity by ID
    const opportunity = await getOpportunityById(id);
    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    // Confidential access check
    const isConfidential = await hasConfidentialAccess(session.user);
    if (!isConfidential && opportunity.visibility === 'confidential') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log('API: /api/opportunities/[id] - Opportunity retrieved successfully');
    return NextResponse.json(opportunity, { status: 200 });
  } catch (error) {
    console.error('API: /api/opportunities/[id] - Error fetching opportunity:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Handle PUT: Update an existing opportunity by ID.
 * 
 * @param req - The request object
 * @param context - The context object containing the route parameters
 * @returns A response with the updated opportunity or an error
 */
export async function PUT(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  console.log('API: /api/opportunities/[id] - Processing PUT request');
  
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
    const body: Partial<Opportunity> = await req.json();
    const isConfidential = await hasConfidentialAccess(session.user);

    // Confidential role handling
    if (isConfidential && body.visibility === 'confidential') {
      console.log('API: /api/opportunities/[id] - Updating confidential opportunity');
      // Add any additional checks/processing here for confidential opportunities
    }

    // Update the opportunity
    const updateSuccess = await updateOpportunity(id, body);
    if (!updateSuccess) {
      return NextResponse.json({ error: 'Opportunity update failed' }, { status: 400 });
    }

    // Retrieve the updated opportunity
    const updatedOpportunity = await getOpportunityById(id);
    if (!updatedOpportunity) {
      return NextResponse.json({ error: 'Opportunity not found after update' }, { status: 404 });
    }

    console.log('API: /api/opportunities/[id] - Opportunity updated successfully');
    return NextResponse.json(updatedOpportunity, { status: 200 });
  } catch (error) {
    console.error('API: /api/opportunities/[id] - Error updating opportunity:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Handle DELETE: Delete an opportunity by ID.
 * 
 * @param req - The request object
 * @param context - The context object containing the route parameters
 * @returns A response with a success message or an error
 */
export async function DELETE(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
) {
  console.log('API: /api/opportunities/[id] - Processing DELETE request');
  
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
      console.log('API: /api/opportunities/[id] - Deleting confidential opportunity');
      // Add any additional checks/logic for confidential deletion, if necessary
    }

    // Delete the opportunity
    const success = await deleteOpportunity(id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete opportunity' }, { status: 400 });
    }

    console.log('API: /api/opportunities/[id] - Opportunity deleted successfully');
    return NextResponse.json({ message: 'Opportunity deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('API: /api/opportunities/[id] - Error deleting opportunity:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Prevent caching for this route
 */
export const dynamic = 'force-dynamic';