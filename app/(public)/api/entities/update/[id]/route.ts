import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth'; // Auth.js session handler
import { updateEntity } from  '@/features/entities/services/update-entity';
import { Entity } from '@/features/entities/types';
import { RouteHandlerProps } from '@/types/next-page';
import { z } from 'zod';
import { logger } from '@/lib/logger'

/**
 * Handles PATCH requests for updating entities.
 * 
 * This route allows authenticated users to update existing entities.
 * It expects the entity ID in the URL and the update data in the request body.
 * 
 * User steps:
 * 1. Authenticate with the application.
 * 2. Prepare the update data for the entity.
 * 3. Send a PATCH request to this route with the entity ID in the URL and update data in the body.
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
  console.log('API: /api/entities/update/[id] - Starting PATCH request');
  logger.info('api.entities.update.start')

  try {
    // Authenticate and obtain user's session
    const session = await auth();

    // Check if the session and user exist
    if (!session || !session.user) {
      console.log('API: /api/entities/update/[id] - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract the entity ID from the route params (Next.js 15 style)
    const params = await context.params;
    const { id } = params;
    
    console.log('API: /api/entities/update/[id] - Processing update for ID:', id);

    // Attempt to parse the request body as JSON
    const schema = z.object({
      name: z.string().min(1).optional(),
      type: z.string().min(1).optional(),
      shortDescription: z.string().min(1).optional(),
      visibility: z.enum(['public', 'subscriber', 'member', 'confidential']).optional(),
      isConfidential: z.boolean().optional(),
    }).passthrough();

    let data: Partial<Entity>;
    try {
      data = schema.parse(await req.json()) as any;
      logger.debug('api.entities.update.body.parsed')
    } catch (error) {
      console.error('API: /api/entities/update/[id] - Invalid body:', error);
      return NextResponse.json({ error: 'Invalid entity data' }, { status: 400 });
    }

    // Process the entity update operation
    const success = await updateEntity(id, data);
    if (!success) {
      console.log('API: /api/entities/update/[id] - Failed to update entity');
      return NextResponse.json({ error: 'Failed to update entity' }, { status: 400 });
    }

    // On successful update
    logger.info('api.entities.update.success', { entityId: id })
    return NextResponse.json({ message: 'Entity updated successfully' }, { status: 200 });

  } catch (error) {
    logger.error('api.entities.update.error', { error: error instanceof Error ? error.message : String(error) })
    if (error instanceof Error) {
      // Handle specific errors like permission denial
      if (error.message.includes('Access denied')) {
        return NextResponse.json({ error: 'Access denied: Forbidden' }, { status: 403 });
      }
      // Log any other known errors
      console.error('API: /api/entities/update/[id] - Error details:', error.message);
    }
    // Return a generic internal server error for unexpected cases
    return NextResponse.json({ error: 'Unable to update entity: Internal Server Error' }, { status: 500 });
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