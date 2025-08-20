import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; // Auth.js session handler
import { deleteOpportunity } from '@/features/opportunities/services/delete-opportunity';
import { RouteHandlerProps } from '@/types/next-page';

/**
 * Handles DELETE requests for removing opportunities.
 * 
 * This route allows authenticated users to delete existing opportunities.
 * It expects the opportunity ID in the URL.
 * 
 * User steps:
 * 1. Authenticate with the application.
 * 2. Send a DELETE request to this route with the opportunity ID in the URL.
 * 3. Receive a JSON response indicating the success or failure of the delete operation.
 * 
 * @param {NextRequest} req - Incoming request object from Next.js.
 * @param {RouteHandlerProps<{ id: string }>} context - The context object containing the route parameters.
 * @returns {Promise<NextResponse>} Response object indicating the result of the delete operation.
 */
export async function DELETE(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
): Promise<NextResponse> {
  console.log('API: /api/opportunities/delete/[id] - Starting DELETE request');

  try {
    // Authenticate and obtain user's session
    const session = await auth();

    // Check if the session and user exist
    if (!session || !session.user) {
      console.log('API: /api/opportunities/delete/[id] - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract the opportunity ID from the route params (Next.js 15 style)
    const params = await context.params;
    const { id } = params;
    
    if (!id) {
      console.log('API: /api/opportunities/delete/[id] - Missing or invalid ID parameter');
      return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 });
    }

    // Log user information for audit purposes
    console.log('API: /api/opportunities/delete/[id] - User attempting to delete opportunity', {
      userId: session.user.id,
      userRole: session.user.role,
      opportunityId: id
    });

    // Process the opportunity delete operation
    // Note: The deleteOpportunity service already handles authentication and permission checks internally
    const success = await deleteOpportunity(id);
    if (!success) {
      console.log('API: /api/opportunities/delete/[id] - Failed to delete opportunity');
      return NextResponse.json({ error: 'Failed to delete opportunity' }, { status: 400 });
    }

    // On successful delete
    console.log('API: /api/opportunities/delete/[id] - Opportunity deleted successfully');
    return NextResponse.json({ message: 'Opportunity deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error('API: /api/opportunities/delete/[id] - Unexpected error:', error);
    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes('You do not have permission')) {
        return NextResponse.json({ error: 'Access denied: Forbidden' }, { status: 403 });
      }
      if (error.message.includes('Opportunity with ID') && error.message.includes('not found')) {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
      // Log any other known errors
      console.error('API: /api/opportunities/delete/[id] - Error details:', error.message);
    }
    // Return a generic internal server error for unexpected cases
    return NextResponse.json({ error: 'Unable to delete opportunity: Internal Server Error' }, { status: 500 });
  }
}

/**
 * Prevent caching for this route
 */
export const dynamic = 'force-dynamic';

/**
 * Configuration for the API route.
 */
export const config = {
  runtime: 'nodejs',
};