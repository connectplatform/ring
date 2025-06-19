import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; // Auth.js session handler
import { updateOpportunity } from '@/services/opportunities/update-opportunity';
import { Opportunity } from '@/features/opportunities/types';
import { RouteHandlerProps } from '@/types/next-page';

/**
 * Handles PATCH requests for updating opportunities.
 * 
 * This route allows authenticated users to update existing opportunities.
 * It expects the opportunity ID in the URL and the update data in the request body.
 * 
 * User steps:
 * 1. Authenticate with the application.
 * 2. Prepare the update data for the opportunity.
 * 3. Send a PATCH request to this route with the opportunity ID in the URL and update data in the body.
 * 4. Receive a JSON response indicating the success or failure of the update operation.
 * 
 * @param req - Incoming request object from Next.js.
 * @param context - The context object containing the route parameters
 * @returns Response object indicating the result of the update operation.
 */
export async function PATCH(
  req: NextRequest,
  context: RouteHandlerProps<{ id: string }>
): Promise<NextResponse> {
  console.log('API: /api/opportunities/update/[id] - Starting PATCH request');

  try {
    // Authenticate and obtain user's session
    const session = await auth();

    // Check if the session and user exist
    if (!session || !session.user) {
      console.log('API: /api/opportunities/update/[id] - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract the opportunity ID from the route params (Next.js 15 style)
    const params = await context.params;
    const { id } = params;
    
    console.log('API: /api/opportunities/update/[id] - Processing update for ID:', id, 'by user:', session.user.id);

    // Attempt to parse the request body as JSON
    let data: Partial<Opportunity>;
    try {
      data = await req.json();
      console.log('API: /api/opportunities/update/[id] - Request body parsed successfully', {
        fields: Object.keys(data),
        opportunityId: id
      });
    } catch (error) {
      console.error('API: /api/opportunities/update/[id] - Error parsing request body:', error);
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }

    // Process the opportunity update operation
    const success = await updateOpportunity(id, data);
    if (!success) {
      console.log('API: /api/opportunities/update/[id] - Failed to update opportunity');
      return NextResponse.json({ error: 'Failed to update opportunity' }, { status: 400 });
    }

    // On successful update
    console.log('API: /api/opportunities/update/[id] - Opportunity updated successfully');
    return NextResponse.json({ message: 'Opportunity updated successfully' }, { status: 200 });

  } catch (error) {
    console.error('API: /api/opportunities/update/[id] - Unexpected error:', error);
    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes('You do not have permission') || error.message.includes('Access denied')) {
        return NextResponse.json({ error: 'Access denied: Forbidden' }, { status: 403 });
      }
      if (error.message.includes('Opportunity with ID') && error.message.includes('not found')) {
        return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
      }
      if (error.message.includes('confidential opportunity') && error.message.includes('permission')) {
        return NextResponse.json({ error: 'Cannot update confidential opportunity: Insufficient permissions' }, { status: 403 });
      }
      // Log any other known errors
      console.error('API: /api/opportunities/update/[id] - Error details:', error.message);
    }
    // Return a generic internal server error for unexpected cases
    return NextResponse.json({ error: 'Unable to update opportunity: Internal Server Error' }, { status: 500 });
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