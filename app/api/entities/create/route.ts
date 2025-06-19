import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createEntity } from '@/services/entities/create-entity';
import { Entity } from '@/features/entities/types';

/**
 * Handles POST requests for creating new entities.
 * 
 * This route allows authenticated users to create new entities.
 * It expects the entity data in the request body.
 * 
 * User steps:
 * 1. Authenticate with the application.
 * 2. Prepare the entity data.
 * 3. Send a POST request to this route with the entity data in the body.
 * 4. Receive a JSON response with the created entity or an error message.
 * 
 * @param {NextRequest} req - Incoming request object from Next.js.
 * @returns {Promise<NextResponse>} Response object containing the created entity or an error message.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('API: /api/entities/create - Starting POST request');

  try {
    // Authenticate and obtain user's session
    const session = await auth();

    // Check if the session and user exist
    if (!session || !session.user) {
      console.log('API: /api/entities/create - Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body
    let data: Omit<Entity, 'id' | 'onlineStatus' | 'lastOnline'>;
    try {
      data = await req.json();
      console.log('API: /api/entities/create - Request body parsed successfully');
    } catch (error) {
      console.error('API: /api/entities/create - Error parsing request body:', error);
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }

    // Create the new entity
    const newEntity = await createEntity(data);
    console.log('API: /api/entities/create - Entity created successfully', newEntity.id);

    return NextResponse.json(newEntity, { status: 201 });
  } catch (error) {
    console.error('API: /api/entities/create - Error creating entity:', error);
    if (error instanceof Error) {
      // Handle specific errors
      if (error.message.includes('Only ADMIN or CONFIDENTIAL users')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.includes('Only ADMIN, MEMBER, or CONFIDENTIAL users')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      // Log any other known errors
      console.error('API: /api/entities/create - Error details:', error.message);
    }
    // Return a generic internal server error for unexpected cases
    return NextResponse.json({ error: 'Failed to create entity: Internal Server Error' }, { status: 500 });
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