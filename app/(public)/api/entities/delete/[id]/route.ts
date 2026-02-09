import { connection } from 'next/server'
  import { NextRequest, NextResponse } from 'next/server';
  import { auth } from '@/auth'; // Auth.js session handler
  import { deleteEntity } from '@/features/entities/services/delete-entity';
  import { RouteHandlerProps } from '@/types/next-page';

  /**
   * Handles DELETE requests for removing entities.
   * 
   * This route allows authenticated users to delete existing entities.
   * It expects the entity ID in the URL.
   * 
   * User steps:
   * 1. Authenticate with the application.
   * 2. Send a DELETE request to this route with the entity ID in the URL.
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
  await connection() // Next.js 16: opt out of prerendering

    console.log('API: /api/entities/delete/[id] - Starting DELETE request');

    try {
      // Authenticate and obtain user's session
      const session = await auth();

      // Check if the session and user exist
      if (!session || !session.user) {
        console.log('API: /api/entities/delete/[id] - Unauthorized access attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Extract the entity ID from the route params (Next.js 15 style)
      const params = await context.params;
      const { id } = params;
      
      if (!id) {
        console.log('API: /api/entities/delete/[id] - Missing or invalid ID parameter');
        return NextResponse.json({ error: 'Invalid ID parameter' }, { status: 400 });
      }

      // Process the entity delete operation
      const success = await deleteEntity(id);
      if (!success) {
        console.log('API: /api/entities/delete/[id] - Failed to delete entity');
        return NextResponse.json({ error: 'Failed to delete entity' }, { status: 400 });
      }

      // On successful delete
      console.log('API: /api/entities/delete/[id] - Entity deleted successfully');
      return NextResponse.json({ message: 'Entity deleted successfully' }, { status: 200 });

    } catch (error) {
      console.error('API: /api/entities/delete/[id] - Unexpected error:', error);
      if (error instanceof Error) {
        // Handle specific errors
        if (error.message.includes('You do not have permission')) {
          return NextResponse.json({ error: 'Access denied: Forbidden' }, { status: 403 });
        }
        if (error.message.includes('Entity with ID') && error.message.includes('not found')) {
          return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
        }
        // Log any other known errors
        console.error('API: /api/entities/delete/[id] - Error details:', error.message);
      }
      // Return a generic internal server error for unexpected cases
      return NextResponse.json({ error: 'Unable to delete entity: Internal Server Error' }, { status: 500 });
    }
  }

  /**
   * Prevent caching for this route
   */

  